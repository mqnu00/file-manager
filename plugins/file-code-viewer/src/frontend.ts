/**
 * file-code-viewer：代码/纯文本查看与编辑（Monaco Editor）
 *
 * 流程：read 拉取二进制 → 应用侧判文本/大小 → TextDecoder 解码 → 懒加载
 *       Monaco → 按扩展名设语言/主题 → 编辑；Ctrl+S 或保存按钮 →
 *       TextEncoder 编码后 write 写回。二进制/超限文件提示改用十六进制查看。
 */

import type {
  FrontendPluginContext,
  FrontendPluginInstallFunction,
  FileItem,
} from '@mqn00/file-manager/plugin/frontend'
import { loadMonaco, resolveLanguage, type MonacoLike } from './monaco-loader'

/** 支持查看/编辑的后缀 */
const EXTENSIONS = [
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'vue', 'json', 'jsonc',
  'yaml', 'yml', 'md', 'txt', 'log', 'ini', 'toml', 'xml', 'svg',
  'py', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'go', 'rs', 'rb', 'php',
  'sh', 'bash', 'zsh', 'ps1', 'bat', 'kt', 'swift', 'm', 'mm', 'sql',
  'html', 'htm', 'css', 'scss', 'less', 'sass', 'graphql', 'proto',
  'dockerfile', 'makefile',
]

const VS_BASE = '/plugins-assets/file-code-viewer/assets/vs'

/** 编辑器可打开的最大字节数（应用侧自判；平台只做二进制透传，不替应用判断） */
const CODE_LIMIT = 8 * 1024 * 1024

interface MonacoEditorHandle {
  getValue(): string
  setValue(v: string): void
  onDidChangeModelContent(cb: () => void): { dispose(): void }
  addCommand(keybinding: number, cb: () => void): void
  dispose(): void
}

function extOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot >= 0 && dot < name.length - 1 ? name.slice(dot + 1).toLowerCase() : ''
}

function createCodeViewer(ctx: FrontendPluginContext) {
  const { h, ref, watch, onMounted, onBeforeUnmount } = ctx.Vue
  const { ElButton, ElAlert, ElTag, ElMessage } = ctx.ElementPlus

  // 平台文件 I/O（主项目 /api/files/* + ctx.api.fileIO），与 file-viewer 解耦
  const api = ctx.api.fileIO
  const theme = ctx.composables.useTheme()

  return ctx.Vue.defineComponent({
    name: 'FileCodeViewer',
    props: {
      file: { type: Object, required: true },
    },
    setup(props: { file: FileItem }) {
      const containerRef = ref<HTMLElement | null>(null)
      const loading = ref(true)
      const error = ref('')
      const tooLarge = ref(false)
      const binary = ref(false)
      const dirty = ref(false)
      const readOnly = ref(false)
      let editor: MonacoEditorHandle | null = null
      let monaco: MonacoLike | null = null
      let contentDisposable: { dispose(): void } | null = null
      let booted = false

      const setTheme = () => {
        if (!monaco) return
        monaco.editor.setTheme(theme.activeTheme.value.name === 'light' ? 'vs' : 'vs-dark')
      }

      // 主应用主题切换联动
      watch(() => theme.activeTheme.value.name, () => setTheme())

      const save = async () => {
        if (!editor || !booted) return
        try {
          await api.write(props.file.path, new TextEncoder().encode(editor.getValue()))
          dirty.value = false
          ElMessage.success('保存成功')
        } catch (e) {
          ElMessage.error(`保存失败: ${e instanceof Error ? e.message : '未知错误'}`)
        }
      }

      const boot = async () => {
        try {
          // 平台只透传二进制；是否超限、是否文本由本应用自行判断
          const r = await api.read(props.file.path)
          if (r.size > CODE_LIMIT) {
            tooLarge.value = true
            return
          }
          const bytes = api.base64ToBytes(r.data)
          if (bytes.subarray(0, 8192).includes(0)) {
            binary.value = true
            return
          }
          const text = new TextDecoder('utf-8').decode(bytes)
          // 等待编辑器容器挂载完成
          await new Promise<void>((resolve) => {
            const tick = () => {
              if (containerRef.value) resolve()
              else setTimeout(tick, 30)
            }
            tick()
          })
          monaco = await loadMonaco(VS_BASE)
          const el = containerRef.value
          if (!el) return
          setTheme()
          const handle = monaco.editor.create(el, {
            value: text,
            language: resolveLanguage(monaco, extOf(props.file.name)),
            readOnly: readOnly.value,
            automaticLayout: true,
            fontSize: 13,
            lineNumbers: 'on',
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
          })
          editor = handle as unknown as MonacoEditorHandle
          booted = true
          contentDisposable = editor.onDidChangeModelContent(() => {
            dirty.value = true
          })
          // Ctrl+S 保存
          const KeyMod = (monaco as unknown as { KeyMod?: { CtrlCmd?: number } }).KeyMod
          const KeyCode = (monaco as unknown as { KeyCode?: { KeyS?: number } }).KeyCode
          if (KeyMod?.CtrlCmd !== undefined && KeyCode?.KeyS !== undefined) {
            editor.addCommand(KeyMod.CtrlCmd | KeyCode.KeyS, () => save())
          }
        } catch (e) {
          error.value = `加载失败: ${e instanceof Error ? e.message : '未知错误'}`
        } finally {
          loading.value = false
        }
      }

      onMounted(() => {
        setTimeout(boot, 50)
      })

      onBeforeUnmount(() => {
        contentDisposable?.dispose()
        editor?.dispose()
        editor = null
      })

      const download = async () => {
        try {
          const resp = await ctx.api.instance.get(`/files/download/${encodeURIComponent(props.file.path)}`, {
            responseType: 'blob',
          })
          const url = URL.createObjectURL(resp.data as Blob)
          const a = document.createElement('a')
          a.href = url
          a.download = props.file.name
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(url)
        } catch (e) {
          ElMessage.error(`下载失败: ${e instanceof Error ? e.message : '未知错误'}`)
        }
      }

      return () => {
        const bar = h('div', { class: 'fcv-bar' }, [
          h(ElTag, { size: 'small', type: 'info' }, () =>
            `${extOf(props.file.name).toUpperCase()} · ${ctx.utils.formatSize(props.file.size)}`
          ),
          dirty.value
            ? h(ElTag, { size: 'small', type: 'warning' }, () => '未保存')
            : h(ElTag, { size: 'small', type: 'success' }, () => '已保存'),
          h('span', { style: { flex: 1 } }),
          h(ElButton, {
            size: 'small',
            type: 'primary',
            disabled: !booted || readOnly.value,
            onClick: save,
          }, () => '保存 (Ctrl+S)'),
          h(ElButton, { size: 'small', onClick: download }, () => '下载文件'),
        ])

        if (error.value) {
          return h('div', { class: 'fcv-viewer' }, [
            bar,
            h('div', { style: { height: '12px' } }),
            h(ElAlert, { type: 'error', showIcon: false, title: error.value, closable: false }),
          ])
        }
        if (tooLarge.value) {
          return h('div', { class: 'fcv-viewer' }, [
            bar,
            h('div', { style: { height: '12px' } }),
            h(ElAlert, {
              type: 'warning',
              showIcon: false,
              title: '文件超过 8MB，不适合编辑器直接打开，请改用十六进制查看或下载',
              closable: false,
            }),
          ])
        }
        if (binary.value) {
          return h('div', { class: 'fcv-viewer' }, [
            bar,
            h('div', { style: { height: '12px' } }),
            h(ElAlert, {
              type: 'warning',
              showIcon: false,
              title: '该文件为二进制内容，请改用十六进制查看器',
              closable: false,
            }),
          ])
        }

        return h('div', { class: 'fcv-viewer' }, [
          bar,
          loading.value ? h('div', { class: 'fcv-loading' }, '加载 Monaco 编辑器中…') : null,
          h('div', { class: 'fcv-editor', ref: containerRef, style: { height: 'calc(100% - 42px)' } }),
        ])
      }
    },
  })
}

function injectStyles(): void {
  if (document.getElementById('file-code-viewer-style')) return
  const style = document.createElement('style')
  style.id = 'file-code-viewer-style'
  style.textContent = `
.fcv-viewer { height: 100%; display: flex; flex-direction: column; }
.fcv-bar { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
.fcv-loading { color: var(--app-text-dim); padding: 24px; }
.fcv-editor { border: 1px solid var(--app-border); border-radius: 6px; overflow: hidden; }
`
  document.head.appendChild(style)
}

/** 查看页外壳：优先使用 file-viewer 共享外壳（含查看器切换下拉），否则降级为简易外壳 */
function resolveViewerPage(ctx: FrontendPluginContext, component: unknown) {
  const shellFactory = (window as unknown as Record<string, unknown>).__fm_create_viewer_page_shell as
    | ((ctx: FrontendPluginContext, component: unknown, name?: string) => unknown)
    | undefined
  if (shellFactory) {
    return shellFactory(ctx, component, 'CodeViewerPage')
  }
  // 降级：file-viewer 未加载时使用简易外壳（无切换下拉）
  const { h, computed, defineComponent } = ctx.Vue as unknown as {
    h: (...args: unknown[]) => unknown
    computed: <T>(fn: () => T) => { value: T }
    defineComponent: (opts: { name: string; setup: () => () => unknown }) => unknown
  }
  const { ElButton } = ctx.ElementPlus as unknown as { ElButton: unknown }
  const basename = (p: string) => p.split('/').pop() || p

  return defineComponent({
    name: 'CodeViewerPage',
    setup() {
      const route = ctx.router.currentRoute
      const file = computed(() => {
        const p = typeof route.value.query.path === 'string' ? route.value.query.path : ''
        if (!p) return null
        const existing = ctx.stores.file.files.find((f: FileItem) => f.path === p)
        return existing ?? ({ name: basename(p), path: p, isDirectory: false, size: 0, modified: '' } as FileItem)
      })
      return () => {
        if (!file.value) {
          return h('div', { style: { padding: '48px', textAlign: 'center', color: 'var(--app-text-dim)' } }, '未指定文件')
        }
        return h('div', { style: { height: '100%', display: 'flex', flexDirection: 'column', padding: '16px 20px', boxSizing: 'border-box' } }, [
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' } }, [
            h(ElButton as never, { text: true, onClick: () => window.history.back() }, () => '← 返回'),
            h('span', { style: { fontWeight: 600, color: 'var(--app-text-bright)' } }, file.value!.name),
            h('span', { style: { color: 'var(--app-text-dim)', fontSize: '12px', marginLeft: '8px' } }, file.value!.path),
          ]),
          h('div', { style: { flex: 1, minHeight: 0, overflow: 'auto' } }, [
            h(component as never, { file: file.value }),
          ]),
        ])
      }
    },
  })
}

export const install: FrontendPluginInstallFunction = (ctx) => {
  injectStyles()
  const codeComponent = createCodeViewer(ctx)
  const viewerPage = resolveViewerPage(ctx, codeComponent)

  ctx.router.addRoute({
    path: '/plugin/code/view',
    component: viewerPage as never,
    meta: { requiresAuth: true },
  })

  console.log('[file-code-viewer] 前端已加载：查看页路由 /plugin/code/view 已注册')

  // teardown 契约：卸载/重载时移除注入样式（路由清理由平台负责）
  return () => {
    document.getElementById('file-code-viewer-style')?.remove()
  }
}