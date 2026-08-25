/**
 * compress 插件压缩对话框
 *
 * 由工具栏「压缩」操作触发（openCompressDialog），用 ctx.Vue.createApp 挂载到
 * document.body（插件无法 import 主应用 .vue 组件，故自建对话框与文件夹选择器）。
 *
 * 流程：选择输出文件夹（默认当前浏览文件夹）→ 权限预检（POST /check，
 * 源读取权限 + 输出目录写入权限 + 目录包含防护）→ 全部通过才可「开始压缩」→
 * POST /zip 创建后台任务（推入主项目任务系统）→ 对话框关闭，任务卡片出现在
 * 后台任务面板（进度/取消/完成由主项目 TaskPanel 承接）→ 完成后条件刷新输出目录。
 */
import type {
  FrontendPluginContext,
  FileItem,
  TaskInfo,
} from '@mqn00/file-manager/plugin/frontend'

/** 与主应用 window.__fm_bulk_actions 的 BulkActionContext 结构一致 */
export interface CompressPayload {
  selected: string[]
  infos: FileItem[]
  currentPath: string
}

interface SourceCheck {
  path: string
  name: string
  kind: 'file' | 'dir'
  exists: boolean
  readable: boolean
  error?: string
}

interface OutputCheck {
  path: string
  exists: boolean
  isDir: boolean
  writable: boolean
  error?: string
}

interface CheckResult {
  ok: boolean
  items: SourceCheck[]
  output: OutputCheck
  targetPath: string
  forbidden: boolean
  forbiddenMessage?: string
}

const HOST_ID = 'fcp-dialog-host'

/** 当前挂载中的对话框实例（单例，供插件 teardown 统一关闭） */
interface ActiveDialog {
  /** Vue App 实例（unmount 关闭对话框） */
  app: { unmount: () => void }
  host: HTMLElement
}
let activeDialog: ActiveDialog | null = null

/**
 * 关闭并卸载当前打开的压缩对话框（插件 teardown 调用）。
 * 幂等：未打开时 no-op。
 */
export function closeCompressDialog(): void {
  if (!activeDialog) return
  try {
    activeDialog.app.unmount()
  } catch {
    // 忽略卸载异常
  }
  try {
    activeDialog.host.remove()
  } catch {
    // 忽略宿主移除异常
  }
  activeDialog = null
}

function parentOf(pathStr: string): string {
  const parts = pathStr.split('/').filter(Boolean)
  parts.pop()
  return parts.join('/')
}

function displayPath(pathStr: string): string {
  return pathStr || '/'
}

/**
 * 文件夹图标（内联 SVG，取 Element Plus Folder 图标的 path）。
 * 插件上下文不暴露图标包，故自绘；颜色用主题强调色令牌随主题换肤。
 */
function renderFolderIcon(h: any) {
  return h(
    'svg',
    {
      viewBox: '0 0 1024 1024',
      width: '16',
      height: '16',
      'aria-hidden': 'true',
      style: { display: 'block' },
    },
    [
      h('path', {
        d: 'M880 298.4H521L403.7 186.2a8.16 8.16 0 0 0-5.5-2.2H144c-17.7 0-32 14.3-32 32v592c0 17.7 14.3 32 32 32h736c17.7 0 32-14.3 32-32V330.4c0-17.7-14.3-32-32-32z',
        fill: 'currentColor',
      }),
    ]
  )
}

export function openCompressDialog(ctx: FrontendPluginContext, payload: CompressPayload): void {
  const { createApp, defineComponent, h, ref, computed, watch } = ctx.Vue
  const { ElDialog, ElButton, ElInput, ElAlert, ElTag, ElMessage } = ctx.ElementPlus
  const formatSize = ctx.utils.formatSize
  const api = ctx.api.instance

  // 复用宿主节点，避免重复打开时叠加多个对话框（同时卸载旧实例）
  closeCompressDialog()
  const host = document.createElement('div')
  host.id = HOST_ID
  document.body.appendChild(host)

  const EllipsisPath = defineComponent({
    name: 'EllipsisPath',
    props: { path: { type: String, default: '' } },
    setup(props) {
      return () => h('span', { class: 'fcp-sel-name', style: { flex: 1 } }, displayPath(props.path))
    },
  })

  const CompressDialog = defineComponent({
    name: 'CompressDialog',
    setup() {
      const visible = ref(true)
      // 根目录时 currentPath 为 ''，归一化为 '/'（与 displayPath 显示一致，后端也按根目录解析）
      const outputDir = ref(payload.currentPath || '/')
      const checkResult = ref<CheckResult | null>(null)
      const checking = ref(false)

      // ─── 权限预检 ───
      const runCheck = async () => {
        checking.value = true
        checkResult.value = null
        try {
          // ctx.api.instance 的 baseURL 为 '/api'，路径不带 /api 前缀
          const resp = await api.post('/plugin/compress/check', {
            paths: payload.selected,
            outputDir: outputDir.value,
          })
          checkResult.value = resp.data as CheckResult
        } catch (e: any) {
          const msg = e?.response?.data?.message
          ElMessage.error(msg || '权限检查失败')
          checkResult.value = null
        } finally {
          checking.value = false
        }
      }

      watch(() => outputDir.value, runCheck)
      void runCheck()

      const canStart = computed(
        () =>
          !!checkResult.value?.ok &&
          !checking.value &&
          payload.selected.length > 0
      )

      // ─── 刷新当前目录列表（压缩完成后触发） ───
      const refreshCurrentDir = async () => {
        try {
          const resp = await api.get('/files', {
            params: { path: ctx.stores.file.currentPath },
          })
          ctx.stores.file.setFiles(resp.data.files)
        } catch {
          // 刷新失败不阻塞关闭
        }
      }

      // ─── 创建压缩后台任务 ───
      const startCompress = async () => {
        if (!canStart.value) return
        try {
          // ctx.api.instance 的 baseURL 为 '/api'，路径不带 /api 前缀
          const resp = await api.post('/plugin/compress/zip', {
            paths: payload.selected,
            outputDir: outputDir.value,
          })
          const { taskId } = resp.data as { taskId: string }

          // 乐观插入后台任务（进度/取消/完成由主项目任务面板承接）
          const info: TaskInfo = {
            id: taskId,
            type: 'compress',
            status: 'running',
            phase: 'compress',
            progress: 0,
            speed: 0,
            totalSize: 0,
            startTime: Date.now(),
            metadata: {
              paths: payload.selected.slice(),
              names: payload.infos.map((i) => i.name),
              outputDir: outputDir.value,
              targetPath: checkResult.value?.targetPath || '',
            },
            completedCount: 0,
            totalCount: payload.selected.length,
            totalItemCount: 0,
            processedItemCount: 0,
          }
          ctx.stores.task.attachTask(taskId, info, makeConditionalRefresh())

          ElMessage.success('压缩任务已推送到后台')
          visible.value = false
        } catch (e: any) {
          ElMessage.error(e?.response?.data?.message || '创建压缩任务失败')
        }
      }

      /**
       * 压缩完成后的条件刷新回调：zip 落在输出目录，
       * 仅当用户当前仍停留在该目录时刷新列表（与移动任务语义一致）。
       * 回调注册在 task store 单例中，对话框关闭后依然有效。
       */
      const makeConditionalRefresh = () => {
        const outputDirSnapshot = outputDir.value
        return () => {
          // 根目录时 currentPath 为 ''，与 outputDir 的 '/' 归一化对齐后再比较
          const current = ctx.stores.file.currentPath || '/'
          if (current === outputDirSnapshot) {
            void refreshCurrentDir()
          }
        }
      }

      // ─── 文件夹选择器 ───
      const pickerVisible = ref(false)
      const pickerPath = ref(payload.currentPath || '/')
      const pickerFolders = ref<string[]>([])
      const pickerLoading = ref(false)

      const loadPickerFolders = async (p: string) => {
        pickerLoading.value = true
        try {
          const resp = await api.get('/files', { params: { path: p } })
          pickerFolders.value = ((resp.data?.files as FileItem[]) || [])
            .filter((f) => f.isDirectory && !f.broken)
            .map((f) => f.path)
        } catch {
          pickerFolders.value = []
        } finally {
          pickerLoading.value = false
        }
      }

      const openPicker = () => {
        pickerPath.value = outputDir.value
        pickerVisible.value = true
        void loadPickerFolders(pickerPath.value)
      }

      const pickerUp = () => {
        pickerPath.value = parentOf(pickerPath.value)
        void loadPickerFolders(pickerPath.value)
      }

      const pickerEnter = (p: string) => {
        pickerPath.value = p
        void loadPickerFolders(p)
      }

      const pickerConfirm = () => {
        outputDir.value = pickerPath.value
        pickerVisible.value = false
      }

      // ─── 渲染 ───
      return () => {
        const selectedRows = payload.infos.map((info) =>
          h('div', { class: 'fcp-sel-item', key: info.path }, [
            h('span', { class: 'fcp-sel-name' }, info.name),
            h(
              'span',
              { class: 'fcp-sel-meta' },
              info.isDirectory ? '文件夹' : formatSize(info.size)
            ),
          ])
        )

        const statusChildren: any[] = []
        if (checkResult.value) {
          for (const item of checkResult.value.items) {
            const ok = item.exists && item.readable
            statusChildren.push(
              h('div', { class: 'fcp-status-row', key: item.path }, [
                h(
                  'span',
                  { class: 'fcp-status-name' },
                  `${item.name}${item.kind === 'dir' ? '（文件夹）' : ''}`
                ),
                h(ElTag, { type: ok ? 'success' : 'danger', size: 'small', effect: 'plain' }, () =>
                  !item.exists ? '不存在' : ok ? '可读' : '不可读'
                ),
              ])
            )
          }
          const out = checkResult.value.output
          const outOk = out.exists && out.isDir && out.writable
          statusChildren.push(
            h('div', { class: 'fcp-status-row', key: '__output__' }, [
              h('span', { class: 'fcp-status-name' }, '输出文件夹'),
              h(
                ElTag,
                { type: outOk ? 'success' : 'danger', size: 'small', effect: 'plain' },
                () => (!out.exists ? '不存在' : outOk ? '可写' : '不可写')
              ),
            ])
          )
        }

        const forbiddenAlert =
          checkResult.value?.forbidden && checkResult.value.forbiddenMessage
            ? h(
                ElAlert as never,
                {
                  title: checkResult.value.forbiddenMessage,
                  type: 'warning',
                  showIcon: true,
                  closable: false,
                  style: { marginTop: '8px' },
                } as never
              )
            : null

        const pickerDialog = h(
          ElDialog,
          {
            modelValue: pickerVisible.value,
            title: '选择输出文件夹',
            width: '460px',
            appendToBody: true,
            'onUpdate:modelValue': (v: boolean) => {
              pickerVisible.value = v
            },
          },
          {
            default: () => [
              h('div', { class: 'fcp-picker-path' }, [
                h(EllipsisPath, { path: pickerPath.value }),
                h(
                  ElButton,
                  {
                    size: 'small',
                    disabled: !pickerPath.value || pickerPath.value === '/',
                    onClick: pickerUp,
                  },
                  () => '上级'
                ),
              ]),
              pickerLoading.value
                ? h('div', { class: 'fcp-dim' }, '加载中…')
                : pickerFolders.value.length === 0
                  ? h('div', { class: 'fcp-picker-empty' }, '（该文件夹下没有子文件夹）')
                  : h(
                      'div',
                      { class: 'fcp-picker-list' },
                      pickerFolders.value.map((p) =>
                        h(
                          'div',
                          { class: 'fcp-picker-row', key: p, onClick: () => pickerEnter(p) },
                          [
                            h('span', { class: 'fcp-picker-icon' }, [renderFolderIcon(h)]),
                            h('span', { class: 'fcp-sel-name' }, p.split('/').pop() || p),
                          ]
                        )
                      )
                    ),
            ],
            footer: () => [
              h(
                ElButton,
                { size: 'small', onClick: () => (pickerVisible.value = false) },
                () => '取消'
              ),
              h(ElButton, { size: 'small', type: 'primary', onClick: pickerConfirm }, () => '选择'),
            ],
          }
        )

        return h(
          ElDialog,
          {
            modelValue: visible.value,
            title: `压缩（${payload.infos.length} 项）`,
            width: '560px',
            appendToBody: true,
            closeOnClickModal: false,
            'onUpdate:modelValue': (v: boolean) => {
              visible.value = v
              if (!v) close()
            },
          },
          {
            default: () => [
              h('div', { class: 'fcp-dialog-body' }, [
                h('div', { class: 'fcp-sec-title' }, '已选条目'),
                h('div', { class: 'fcp-sel-list' }, selectedRows),
                h('div', { class: 'fcp-sec-title' }, '输出位置'),
                h('div', { class: 'fcp-out-row' }, [
                  h(ElInput, {
                    modelValue: displayPath(outputDir.value),
                    readonly: true,
                    placeholder: '请选择输出文件夹',
                    style: { flex: 1 },
                  }),
                  h(ElButton, { size: 'default', onClick: openPicker }, () => '选择'),
                ]),
                checkResult.value?.targetPath
                  ? h('div', { class: 'fcp-target' }, `输出文件：${checkResult.value.targetPath}`)
                  : null,
                h('div', { class: 'fcp-sec-title' }, '权限检查'),
                checking.value
                  ? h('div', { class: 'fcp-dim' }, '正在检查权限…')
                  : checkResult.value
                    ? h('div', { class: 'fcp-status-list' }, statusChildren)
                    : h('div', { class: 'fcp-dim' }, '权限检查失败'),
                forbiddenAlert,
              ]),
              pickerDialog,
            ],
            footer: () => [
              h(ElButton, { onClick: () => (visible.value = false) }, () => '关闭'),
              h(
                ElButton,
                { type: 'primary', disabled: !canStart.value, onClick: startCompress },
                () => '开始压缩'
              ),
            ],
          }
        )
      }
    },
  })

  const rootApp = createApp(CompressDialog)
  rootApp.mount(host)
  activeDialog = { app: rootApp, host }
}
