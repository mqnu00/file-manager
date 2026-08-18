/**
 * file-code-viewer：代码/纯文本查看与编辑（Monaco Editor）
 *
 * 流程：/read 载入文本 → 懒加载 Monaco → 按扩展名设语言/主题 → 编辑
 *       Ctrl+S 或保存按钮 → /write 写回。二进制/超限文件提示改用十六进制查看。
 */

import type {
  FrontendPluginContext,
  FrontendPluginInstallFunction,
  FileItem,
} from '@mqn00/file-manager/plugin/frontend'
import { getRegistry, type FileViewerModule } from './registry'
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

function createCodeViewer(ctx: FrontendPluginContext): unknown {
  const { h, ref, watch, onMounted, onBeforeUnmount } = ctx.Vue as unknown as {
    h: (type: unknown, props?: Record<string, unknown>, children?: unknown) => unknown
    ref: <T>(v: T | null) => { value: T | null }
    watch: (src: unknown, cb: () => void) => unknown
    onMounted: (cb: () => void) => void
    onBeforeUnmount: (cb: () => void) => void
  }
  const { ElButton, ElAlert, ElTag } = ctx.ElementPlus as unknown as {
    ElButton: never
    ElAlert: never
    ElTag: never
  }
  const ElMessage = (ctx.ElementPlus as unknown as {
    ElMessage: { success: (m: string) => void; error: (m: string) => void }
  }).ElMessage

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
          await api.write(props.file.path, editor.getValue())
          dirty.value = false
          ElMessage.success('保存成功')
        } catch (e) {
          ElMessage.error(`保存失败: ${e instanceof Error ? e.message : '未知错误'}`)
        }
      }

      const boot = async () => {
        try {
          const read = await api.read(props.file.path)
          if (!read.isText) {
            if (read.reason === 'too-large') tooLarge.value = true
            else binary.value = true
            return
          }
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
            value: read.content ?? '',
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
        const bar = h('div', { class: 'code-bar' }, [
          h(ElTag as never, { size: 'small', type: 'info' }, () =>
            `${extOf(props.file.name).toUpperCase()} · ${ctx.utils.formatSize(props.file.size)}`
          ),
          dirty.value
            ? h(ElTag as never, { size: 'small', type: 'warning' }, () => '未保存')
            : h(ElTag as never, { size: 'small', type: 'success' }, () => '已保存'),
          h('span', { style: { flex: 1 } }),
          h(ElButton as never, {
            size: 'small',
            type: 'primary',
            disabled: !booted || readOnly.value,
            onClick: save,
          }, () => '保存 (Ctrl+S)'),
          h(ElButton as never, { size: 'small', onClick: download }, () => '下载文件'),
        ])

        if (error.value) {
          return h('div', { class: 'code-viewer' }, [
            bar,
            h('div', { style: { height: '12px' } }),
            h(ElAlert as never, { type: 'error', showIcon: false, title: error.value, closable: false }),
          ])
        }
        if (tooLarge.value) {
          return h('div', { class: 'code-viewer' }, [
            bar,
            h('div', { style: { height: '12px' } }),
            h(ElAlert as never, {
              type: 'warning',
              showIcon: false,
              title: '文件超过 8MB，不适合编辑器直接打开，请改用十六进制查看或下载',
              closable: false,
            }),
          ])
        }
        if (binary.value) {
          return h('div', { class: 'code-viewer' }, [
            bar,
            h('div', { style: { height: '12px' } }),
            h(ElAlert as never, {
              type: 'warning',
              showIcon: false,
              title: '该文件为二进制内容，请改用十六进制查看器',
              closable: false,
            }),
          ])
        }

        return h('div', { class: 'code-viewer' }, [
          bar,
          loading.value ? h('div', { class: 'code-loading' }, '加载 Monaco 编辑器中…') : null,
          h('div', { class: 'code-editor', ref: containerRef, style: { height: 'calc(100% - 42px)' } }),
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
.code-viewer { height: 100%; display: flex; flex-direction: column; }
.code-bar { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
.code-loading { color: var(--app-text-dim); padding: 24px; }
.code-editor { border: 1px solid var(--app-border); border-radius: 6px; overflow: hidden; }
`
  document.head.appendChild(style)
}

export const install: FrontendPluginInstallFunction = (ctx) => {
  injectStyles()
  const registry = getRegistry()
  if (!registry) {
    console.warn('[file-code-viewer] 未找到 file-viewer 核心注册表，跳过注册')
    return
  }
  const module: FileViewerModule = {
    id: 'code',
    label: '代码编辑器',
    extensions: EXTENSIONS,
    editable: true,
    component: createCodeViewer(ctx),
  }
  registry.register(module)

  console.log('[file-code-viewer] 前端已加载：代码模块已注册')
}