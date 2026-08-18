/**
 * Monaco 懒加载器
 *
 * monaco-editor 的 worker 体系无法用 esbuild 简单打包，因此构建时将
 * node_modules/monaco-editor/min/vs 整体拷贝到本包 assets/vs/，经静态资源
 * /plugins-assets/file-code-viewer/assets/vs/ 提供，运行时先用 AMD loader 加载
 * editor.main，再配置 MonacoEnvironment 让 worker 以 importScripts 方式加载，
 * 获得完整的高亮/编辑/智能提示能力。
 */

export interface MonacoLike {
  editor: {
    create(dom: HTMLElement, options: Record<string, unknown>): unknown
    setTheme(theme: string): void
  }
  languages: {
    getLanguages(): Array<{ id: string; extensions?: string[] }>
  }
}

let monacoPromise: Promise<MonacoLike> | null = null

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`)
    if (existing) {
      if (existing.dataset.loaded === 'true') {
        resolve()
        return
      }
      existing.addEventListener('load', () => resolve(), { once: true })
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.dataset.loaded = 'false'
    script.onload = () => {
      script.dataset.loaded = 'true'
      resolve()
    }
    script.onerror = () => reject(new Error(`加载失败: ${src}`))
    document.head.appendChild(script)
  })
}

/** 加载 Monaco 编辑器样式（editor.main.css）。Monaco 内部尺寸严重依赖
 *  该样式表，缺失时编辑器 DOM 塌陷为 0 尺寸，表现为空白无内容。 */
function loadStyle(href: string): Promise<void> {
  return new Promise((resolve) => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = href
    link.onload = () => resolve()
    link.onerror = () => resolve() // 样式失败不阻塞初始化（仍有 JS 渲染）
    document.head.appendChild(link)
  })
}

/** 加载 monaco（幂等，返回全局 monaco 命名空间） */
export function loadMonaco(baseUrl: string): Promise<MonacoLike> {
  if (monacoPromise) return monacoPromise

  monacoPromise = (async () => {
    const win = window as unknown as {
      monaco?: MonacoLike
      require?: {
        config(opts: { paths: Record<string, string> }): void
        (deps: string[], ready: () => void, error?: (err: unknown) => void): void
      }
      MonacoEnvironment?: { getWorkerUrl?: () => string }
    }

    if (win.monaco?.editor) return win.monaco

    // 样式先行：editor.main.css 决定 Monaco 全部内部尺寸
    await Promise.all([
      loadScript(`${baseUrl}/loader.js`),
      loadStyle(`${baseUrl}/editor/editor.main.css`),
    ])

    const loader = win.require
    if (!loader) throw new Error('Monaco loader 未就绪')

    loader.config({ paths: { vs: baseUrl } })

    // worker 支持：指向构建期生成的同源 worker-hook.js。
    // （blob worker 内 importScripts 绝对 URL 会被浏览器判为 invalid，
    //   改用静态脚本由 workerMain.js 负责从 baseUrl 用 AMD 流加载各语言 worker。）
    win.MonacoEnvironment = {
      getWorkerUrl: () => `${baseUrl}/worker-hook.js`,
    }

    await new Promise<void>((resolve, reject) => {
      loader(['vs/editor/editor.main'], () => resolve(), (err: unknown) => reject(err))
    })

    if (!win.monaco) throw new Error('monaco 未初始化')
    return win.monaco
  })()

  return monacoPromise
}

/** 按扩展名解析 monaco 语言 id（无匹配返回 plaintext） */
export function resolveLanguage(monaco: MonacoLike, ext: string): string {
  const key = ext.toLowerCase().replace(/^\./, '')
  if (!key) return 'plaintext'
  const lang = monaco.languages.getLanguages().find((l) => (l.extensions ?? []).includes(`.${key}`))
  return lang?.id ?? 'plaintext'
}