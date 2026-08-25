/**
 * file-markdown-viewer：Markdown 只读预览
 *
 * 使用 marked 解析 Markdown 为 HTML，highlight.js 为围栏代码块提供语法高亮。
 * 所有样式使用主题令牌，支持亮色/暗色主题切换。
 */

import type {
  FrontendPluginContext,
  FrontendPluginInstallFunction,
  FileItem,
} from '@mqn00/file-manager/plugin/frontend'
import { Marked } from 'marked'
import { markedHighlight } from 'marked-highlight'
import hljs from 'highlight.js'
import { getRegistry, type FileViewerModule } from './registry'

const EXTENSIONS = ['md', 'markdown', 'mdown', 'mkd']

// ==================== Markdown 渲染器 ====================

const marked = new Marked(
  markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code: string, lang: string) {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value
      }
      return hljs.highlightAuto(code).value
    },
  }),
)

// ==================== 工具函数 ====================

function extOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot >= 0 && dot < name.length - 1 ? name.slice(dot + 1).toLowerCase() : ''
}

// ==================== Vue 组件 ====================

function createMarkdownViewer(ctx: FrontendPluginContext) {
  const { h, ref, onMounted } = ctx.Vue
  const { ElTag, ElAlert, ElMessage } = ctx.ElementPlus

  const io = ctx.api.fileIO

  return ctx.Vue.defineComponent({
    name: 'FileMarkdownViewer',
    props: {
      file: { type: Object, required: true },
    },
    setup(props: { file: FileItem }) {
      const ext = extOf(props.file.name)
      const loading = ref(true)
      const error = ref('')
      const html = ref('')
      const containerRef = ref<HTMLElement | null>(null)

      const render = async () => {
        loading.value = true
        error.value = ''
        html.value = ''
        try {
          const result = await io.read(props.file.path)
          const bytes = io.base64ToBytes(result.data)
          const text = new TextDecoder('utf-8').decode(bytes)
          html.value = marked.parse(text) as string
        } catch (e) {
          error.value = `预览失败: ${e instanceof Error ? e.message : '未知错误'}`
          ElMessage.error(error.value)
        } finally {
          loading.value = false
        }
      }

      onMounted(render)

      return () => {
        const bar = h('div', { class: 'fmv-bar' }, [
          h(ElTag, { size: 'small', type: 'info' }, () => `Markdown 预览（只读）`),
          loading.value ? h('span', { class: 'fmv-loading' }, '加载中…') : null,
          h('span', { style: { flex: '1' } }),
        ])

        if (error.value) {
          return h('div', { class: 'fmv-viewer' }, [
            bar,
            h('div', { style: { height: '12px' } }),
            h(ElAlert, { type: 'error', showIcon: false, title: error.value, closable: false }),
          ])
        }

        return h('div', { class: 'fmv-viewer' }, [
          bar,
          h('div', {
            ref: containerRef,
            class: 'fmv-content',
            innerHTML: html.value,
          }),
        ])
      }
    },
  })
}

// ==================== 样式注入 ====================

function injectStyles(): void {
  if (document.getElementById('file-markdown-viewer-style')) return
  const style = document.createElement('style')
  style.id = 'file-markdown-viewer-style'
  style.textContent = `
/* ===== Markdown 查看器基础布局 ===== */
.fmv-viewer { height: 100%; display: flex; flex-direction: column; }
.fmv-bar { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
.fmv-loading { color: var(--app-text-dim); font-size: 12px; }

/* ===== Markdown 内容区（主题令牌） ===== */
.fmv-content {
  overflow: auto; flex: 1;
  background: var(--app-panel-solid, #fff);
  color: var(--app-text, #333);
  padding: 24px 32px;
  border-radius: 6px;
  line-height: 1.7;
  word-break: break-word;
}

/* 标题 */
.fmv-content h1, .fmv-content h2, .fmv-content h3,
.fmv-content h4, .fmv-content h5, .fmv-content h6 {
  color: var(--app-text-bright, #111);
  margin-top: 1.4em;
  margin-bottom: 0.6em;
  line-height: 1.3;
}
.fmv-content h1 { font-size: 1.8em; border-bottom: 2px solid var(--app-border, #e5e5e5); padding-bottom: 0.3em; }
.fmv-content h2 { font-size: 1.5em; border-bottom: 1px solid var(--app-border, #e5e5e5); padding-bottom: 0.25em; }
.fmv-content h3 { font-size: 1.25em; }
.fmv-content h4 { font-size: 1.1em; }
.fmv-content h5, .fmv-content h6 { font-size: 1em; }

/* 段落与行内 */
.fmv-content p { margin: 0.8em 0; }
.fmv-content a { color: var(--app-accent, #409eff); text-decoration: none; }
.fmv-content a:hover { text-decoration: underline; }
.fmv-content strong { color: var(--app-text-bright, #111); }
.fmv-content em { font-style: italic; }
.fmv-content del { text-decoration: line-through; opacity: 0.6; }

/* 行内代码 */
.fmv-content code {
  background: var(--app-input-bg, #f5f5f5);
  color: var(--app-text, #333);
  padding: 0.15em 0.4em;
  border-radius: 4px;
  font-size: 0.9em;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
}

/* 代码块 */
.fmv-content pre {
  background: var(--app-bg, #f8f8f8);
  border: 1px solid var(--app-border, #e5e5e5);
  border-radius: 6px;
  padding: 16px;
  overflow-x: auto;
  margin: 1em 0;
  line-height: 1.5;
}
.fmv-content pre code {
  background: none;
  padding: 0;
  border-radius: 0;
  font-size: 0.85em;
}

/* 引用 */
.fmv-content blockquote {
  border-left: 4px solid var(--app-accent, #409eff);
  color: var(--app-text-dim, #666);
  margin: 1em 0;
  padding: 0.5em 1em;
  background: var(--app-accent-bg-subtle, rgba(64, 158, 255, 0.05));
  border-radius: 0 4px 4px 0;
}
.fmv-content blockquote p { margin: 0.4em 0; }

/* 列表 */
.fmv-content ul, .fmv-content ol {
  padding-left: 2em;
  margin: 0.8em 0;
}
.fmv-content li { margin: 0.3em 0; }
.fmv-content li > ul, .fmv-content li > ol { margin: 0.2em 0; }
.fmv-content input[type="checkbox"] {
  margin-right: 0.4em;
}

/* 表格 */
.fmv-content table {
  border-collapse: collapse;
  margin: 1em 0;
  width: 100%;
  overflow-x: auto;
  display: block;
}
.fmv-content th, .fmv-content td {
  border: 1px solid var(--app-border, #e5e5e5);
  padding: 6px 12px;
  text-align: left;
}
.fmv-content th {
  background: var(--app-table-header-bg, #f5f5f5);
  font-weight: 600;
  color: var(--app-text-bright, #111);
}
.fmv-content tr:nth-child(even) {
  background: var(--app-table-stripe-bg, rgba(0,0,0,0.02));
}

/* 水平线 */
.fmv-content hr {
  border: none;
  border-top: 2px solid var(--app-border, #e5e5e5);
  margin: 1.5em 0;
}

/* 图片 */
.fmv-content img {
  max-width: 100%;
  border-radius: 4px;
  margin: 0.5em 0;
}

/* highlight.js 行内高亮标记 */
.fmv-content mark {
  background: var(--app-accent-bg, rgba(64, 158, 255, 0.15));
  padding: 0.1em 0.2em;
  border-radius: 2px;
}
`
  document.head.appendChild(style)
}

// ==================== 插件安装 ====================

export const install: FrontendPluginInstallFunction = (ctx) => {
  injectStyles()
  const registry = getRegistry()
  if (!registry) {
    console.warn('[file-markdown-viewer] 未找到 file-viewer 核心注册表，跳过注册')
    return
  }
  const module: FileViewerModule = {
    id: 'markdown',
    label: 'Markdown 查看器',
    extensions: EXTENSIONS,
    editable: false,
    component: createMarkdownViewer(ctx),
  }
  const unregister = registry.register(module)
  console.log('[file-markdown-viewer] 前端已加载：markdown 模块已注册')

  // teardown 契约：卸载/重载时注销查看器模块并移除注入样式
  return () => {
    unregister()
    document.getElementById('file-markdown-viewer-style')?.remove()
  }
}
