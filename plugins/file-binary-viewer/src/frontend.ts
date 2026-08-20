/**
 * file-binary-viewer：十六进制查看/编辑（兜底模块）
 *
 * 通过平台 I/O 分页读写：
 *   GET  /api/files/read（offset/length）       读一页
 *   POST /api/files/write（offset 定位写入）     保存一页
 *
 * 功能：offset | 16 字节 hex | ASCII 栅格视图；页导航（上一页/下一页/跳转/跳到底）；
 * 单元格编辑（hex 两位/ASCII 单字符，校验输入）；脏页整页提交保存；>512MB 只读。
 */

import type {
  FrontendPluginContext,
  FrontendPluginInstallFunction,
  FileItem,
} from '@mqn00/file-manager/plugin/frontend'
import { getRegistry, type FileViewerModule } from './registry'

const PAGE_SIZE = 256 * 1024
const EDIT_LIMIT = 512 * 1024 * 1024

// ==================== 纯逻辑 ====================

export interface Cell {
  byte: number
  /** hex 草稿（两位十六进制字符串）或 null */
  hex: string | null
  /** ASCII 草稿（单字符）或 null */
  ascii: string | null
}

/** 将字节页解析为单元格数组（草稿为空） */
export function toCells(bytes: Uint8Array): Cell[] {
  return Array.from(bytes, (byte) => ({ byte, hex: null, ascii: null }))
}

/** 校验 hex 输入（两位十六进制） */
export function isValidHex(s: string): boolean {
  return /^[0-9a-fA-F]{2}$/.test(s)
}

/** 校验 ASCII 输入（单个可打印字符） */
export function isValidAscii(s: string): boolean {
  if (s.length !== 1) return false
  const code = s.charCodeAt(0)
  return code >= 0x20 && code <= 0x7e
}

/** 应用单元格草稿到字节页，返回新字节页（非法草稿忽略） */
export function applyDrafts(base: Uint8Array, cells: Cell[]): Uint8Array {
  const next = new Uint8Array(base)
  cells.forEach((cell, i) => {
    if (i >= next.length) return
    if (cell.hex !== null && isValidHex(cell.hex)) {
      next[i] = parseInt(cell.hex, 16)
    } else if (cell.ascii !== null && isValidAscii(cell.ascii)) {
      next[i] = cell.ascii.charCodeAt(0)
    }
  })
  return next
}

/** 判断当前页是否有草稿（hex 或 ascii 任一非 null） */
export function hasDrafts(cells: Cell[]): boolean {
  return cells.some((c) => c.hex !== null || c.ascii !== null)
}

/** 渲染字符为可打印 ASCII 或 '.' */
function printableChar(byte: number): string {
  return byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : '.'
}

// ==================== 查看组件 ====================

function createHexViewer(ctx: FrontendPluginContext): unknown {
  const { h, ref, computed, onMounted } = ctx.Vue
  const { ElButton, ElInput, ElTag, ElAlert, ElMessage } = ctx.ElementPlus

  // 平台文件 I/O（主项目 /api/files/* + ctx.api.fileIO），与 file-viewer 解耦
  const api = ctx.api.fileIO

  return ctx.Vue.defineComponent({
    name: 'FileBinaryViewer',
    props: {
      file: { type: Object, required: true },
    },
    setup(props: { file: FileItem }) {
      const pageOffset = ref(0)
      const fileSize = ref(0)
      const pageBytes = ref<Uint8Array>(new Uint8Array(0))
      const cells = ref<Cell[]>([])
      const loading = ref(false)
      const readOnly = ref(false)
      const goToOffsetRaw = ref('')

      const totalPages = computed(() => Math.max(1, Math.ceil(fileSize.value / PAGE_SIZE)))
      const currentPage = computed(() => Math.floor(pageOffset.value / PAGE_SIZE) + 1)
      const dirty = computed(() => hasDrafts(cells.value))

      const loadPage = async (offset: number) => {
        loading.value = true
        try {
          const res = await api.read(props.file.path, offset, PAGE_SIZE)
          fileSize.value = res.size
          readOnly.value = res.size > EDIT_LIMIT
          pageOffset.value = offset
          pageBytes.value = api.base64ToBytes(res.data)
          cells.value = toCells(pageBytes.value)
        } catch (e) {
          ElMessage.error(`读取失败: ${e instanceof Error ? e.message : '未知错误'}`)
        } finally {
          loading.value = false
        }
      }

      const applyDraft = (index: number, field: 'hex' | 'ascii', raw: string) => {
        const cell = cells.value[index]
        if (!cell) return
        if (field === 'hex') {
          const v = raw.replace(/[^0-9a-fA-F]/g, '').slice(0, 2)
          cell.hex = v.length > 0 ? v : null
        } else {
          const v = raw.length > 0 ? raw[raw.length - 1] : ''
          cell.ascii = v.length > 0 ? v : null
        }
      }

      const savePage = async () => {
        try {
          const next = applyDrafts(pageBytes.value, cells.value)
          await api.write(props.file.path, next, pageOffset.value)
          pageBytes.value = next
          cells.value = toCells(next)
          ElMessage.success('保存成功')
        } catch (e) {
          ElMessage.error(`保存失败: ${e instanceof Error ? e.message : '未知错误'}`)
        }
      }

      const goToPage = (page: number) => {
        const p = Math.min(Math.max(1, Math.floor(page)), totalPages.value)
        loadPage((p - 1) * PAGE_SIZE)
      }

      const goToOffset = () => {
        const v = parseInt(goToOffsetRaw.value, 10)
        if (Number.isNaN(v) || v < 0 || v >= fileSize.value) {
          ElMessage.warning('请输入有效偏移（0 ~ 文件大小-1）')
          return
        }
        loadPage(v)
      }

      const jumpToEnd = () => {
        loadPage(Math.max(0, fileSize.value - PAGE_SIZE))
      }

      onMounted(() => loadPage(0))

      return () => {
        const rows: any[] = []
        const count = cells.value.length
        for (let i = 0; i < count; i += 16) {
          const rowCells = cells.value.slice(i, i + 16)
          rows.push(
            h('div', { class: 'fbv-row', key: pageOffset.value + i }, [
              h(
                'span',
                { class: 'fbv-offset' },
                (pageOffset.value + i).toString(16).padStart(8, '0')
              ),
              ...rowCells.map((cell, j) => {
                const index = i + j
                return h(
                  ElTag,
                  {
                    size: 'small',
                    type: cell.hex !== null ? 'warning' : 'info',
                    class: 'fbv-cell',
                  },
                  () =>
                    h('input', {
                      class: 'fbv-input',
                      value: cell.hex ?? cell.byte.toString(16).padStart(2, '0').toUpperCase(),
                      maxlength: 2,
                      spellcheck: false,
                      onInput: (e: Event) =>
                        applyDraft(index, 'hex', (e.target as HTMLInputElement).value),
                    })
                )
              }),
              ...Array.from({ length: 16 - rowCells.length }, () =>
                h('span', { class: 'fbv-void' }, '')
              ),
              '  ',
              ...rowCells.map((cell, j) => {
                const index = i + j
                return h(
                  ElTag,
                  {
                    size: 'small',
                    type: cell.ascii !== null ? 'warning' : 'info',
                    class: 'fbv-ascii-cell',
                  },
                  () =>
                    h('input', {
                      class: 'fbv-input ascii',
                      value: cell.ascii ?? printableChar(cell.byte),
                      maxlength: 1,
                      spellcheck: false,
                      onInput: (e: Event) =>
                        applyDraft(index, 'ascii', (e.target as HTMLInputElement).value),
                    })
                )
              }),
            ])
          )
        }

        return h('div', { class: 'fbv-viewer' }, [
          h('div', { class: 'fbv-bar' }, [
            h(
              ElButton,
              {
                size: 'small',
                disabled: loading.value || currentPage.value <= 1,
                onClick: () => goToPage(currentPage.value - 1),
              },
              () => '上一页'
            ),
            h(
              ElButton,
              {
                size: 'small',
                disabled: loading.value || currentPage.value >= totalPages.value,
                onClick: () => goToPage(currentPage.value + 1),
              },
              () => '下一页'
            ),
            h(ElButton, { size: 'small', disabled: loading.value, onClick: jumpToEnd }, () =>
              '跳到底'
            ),
            h('span', { class: 'fbv-page-info' }, () =>
              `第 ${currentPage.value} / ${totalPages.value} 页 · ${ctx.utils.formatSize(fileSize.value)}`
            ),
            h(ElInput, {
              modelValue: goToOffsetRaw.value,
              placeholder: '跳转偏移',
              size: 'small',
              class: 'fbv-offset-input',
              onUpdate: (v: string) => {
                goToOffsetRaw.value = v
              },
            }),
            h(ElButton, { size: 'small', disabled: loading.value, onClick: goToOffset }, () =>
              '跳转'
            ),
            h(
              ElButton,
              {
                size: 'small',
                type: 'primary',
                disabled: !dirty.value || readOnly.value,
                onClick: savePage,
              },
              () => (dirty.value ? '保存本页' : '已保存')
            ),
          ]),
          readOnly.value
            ? h(ElAlert, {
                type: 'warning',
                showIcon: false,
                title: '文件超过 512MB，仅可查看不可编辑',
                closable: false,
              })
            : null,
          h('div', { class: 'fbv-grid', style: { opacity: loading.value ? 0.5 : 1 } }, [
            ...(rows.length > 0 ? rows : [h('div', { class: 'fbv-empty' }, '（空文件）')]),
          ]),
        ])
      }
    },
  })
}

// ==================== 插件入口 ====================

function injectStyles(): void {
  if (document.getElementById('file-binary-viewer-style')) return
  const style = document.createElement('style')
  style.id = 'file-binary-viewer-style'
  style.textContent = `
.fbv-viewer { height: 100%; display: flex; flex-direction: column; }
.fbv-bar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
.fbv-grid { flex: 1; font-family: 'JetBrains Mono', Consolas, Menlo, monospace; font-size: 12px; line-height: 2; overflow: auto; }
.fbv-row { display: flex; align-items: center; gap: 3px; white-space: nowrap; }
.fbv-offset { color: var(--app-text-dim); min-width: 74px; user-select: none; }
.fbv-input { width: 24px; border: none; outline: none; background: transparent; color: var(--app-text); font: inherit; text-align: center; padding: 0; }
.fbv-input.ascii { width: 12px; }
.fbv-void { min-width: 14px; }
.fbv-page-info { color: var(--app-text-dim); font-size: 12px; }
.fbv-empty { color: var(--app-text-dim); padding: 24px; }
.fbv-offset-input { width: 140px; }
`
  document.head.appendChild(style)
}

export const install: FrontendPluginInstallFunction = (ctx) => {
  injectStyles()
  const registry = getRegistry()
  if (!registry) {
    console.warn('[file-binary-viewer] 未找到 file-viewer 核心注册表，跳过注册')
    return
  }
  const module: FileViewerModule = {
    id: 'hex',
    label: '十六进制查看器',
    extensions: ['bin', 'dat', 'hex'],
    editable: true,
    component: createHexViewer(ctx),
  }
  registry.register(module)

  console.log('[file-binary-viewer] 前端已加载：hex 兜底模块已注册')
}