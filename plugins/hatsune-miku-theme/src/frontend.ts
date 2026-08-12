/**
 * Hatsune Miku Theme — 前端入口
 *
 * 浏览器运行时通过 import() 动态加载，接收 ctx 访问所有前端公共资源。
 * 通过 ctx.composables.useTheme().registerTheme() 注册主题，
 * 安装插件后主项目工具栏主题下拉框自动出现"初音未来"选项。
 *
 * 配色改编自 DB_Hatsune-Miku-Theme（Discord 初音未来主题）：
 *   https://github.com/Hatsune-Mikun/DB_Hatsune-Miku-Theme
 * 深黑蓝背景 + 青绿霓虹高亮（#00f2ff / #0abdc6）+ 蓝/红粉点缀。
 * 整体背景图取自 DB_Hatsune-Miku-Theme/media（logo3.png 除外），
 * 可在插件主页（/plugin/hatsune-miku-theme）切换，选择按浏览器持久化。
 *
 * 类型由 @mqn00/file-manager/plugin/frontend 提供。
 */

import type { FrontendPluginInstallFunction } from '@mqn00/file-manager/plugin/frontend'

/** 静态资源前缀：/plugins-assets/<短名>/assets/ 由主项目静态服务提供 */
const ASSETS_URL = '/plugins-assets/hatsune-miku-theme/assets'
const LOGO_URL = `${ASSETS_URL}/logo.png`
const BG_URL_PREFIX = `${ASSETS_URL}/bg`

/** localStorage 键：用户选择的背景图（与主题存储机制一致，按浏览器持久化） */
const STORAGE_KEY_BG = 'hatsune-miku-theme-bg'

/** 可选背景图（来自 DB_Hatsune-Miku-Theme/media，logo3.png 不适合做背景故排除） */
const BACKGROUNDS = [
  { id: 'f3DwR01P.png', label: 'f3DwR01P.png', url: `${BG_URL_PREFIX}/f3DwR01P.png` },
  { id: 'o_1dmto233h1ap1grj1kn511qn1oim1o.jpg', label: 'o_1dmto233h1ap1grj1kn511qn1oim1o.jpg', url: `${BG_URL_PREFIX}/o_1dmto233h1ap1grj1kn511qn1oim1o.jpg` },
]
const DEFAULT_BG_ID = BACKGROUNDS[0].id

/** 根据 id 查找背景定义；未知 id 回退默认 */
function findBackground(id: string | null): (typeof BACKGROUNDS)[number] {
  return BACKGROUNDS.find((b) => b.id === id) ?? BACKGROUNDS[0]
}

/** 读取当前生效的背景 id（未选择或损坏时返回默认） */
function currentBackgroundId(): string {
  let stored: string | null = null
  try {
    stored = localStorage.getItem(STORAGE_KEY_BG)
  } catch {
    // localStorage not available
  }
  return findBackground(stored).id
}

/**
 * 应用背景图：写入 localStorage 并通过 html 内联 --miku-bg 覆盖主题 CSS 默认值。
 * 选择默认图时清除内联属性，由主题 CSS 中的默认 URL 生效。
 */
function applyBackground(id: string): void {
  const bg = findBackground(id)
  try {
    localStorage.setItem(STORAGE_KEY_BG, bg.id)
  } catch {
    // localStorage not available
  }
  if (bg.id === DEFAULT_BG_ID) {
    document.documentElement.style.removeProperty('--miku-bg')
  } else {
    document.documentElement.style.setProperty('--miku-bg', `url('${bg.url}')`)
  }
}

const THEME_CSS = `
html.hatsune-miku {
  --miku-bg: url('${BACKGROUNDS[0].url}');
  --app-bg: #040405;
  --app-panel: rgb(10 10 14 / 55%);
  --app-panel-solid: #0a0a0f;
  --app-border: rgb(0 242 255 / 22%);
  --app-shadow: 0 2px 8px rgb(0 0 0 / 60%);
  --app-glow: 0 0 12px rgb(0 242 255 / 30%);
  --app-text: #dcddde;
  --app-text-dim: #7d8a99;
  --app-text-bright: #ffffff;
  --app-accent: #00f2ff;
  --app-accent-bg: rgb(0 242 255 / 8%);
  --app-accent-bg-hover: rgb(0 242 255 / 12%);
  --app-accent-bg-subtle: rgb(0 242 255 / 6%);
  --app-accent-border: rgb(0 242 255 / 22%);
  --app-accent-border-light: rgb(0 242 255 / 15%);
  --app-input-bg: rgb(10 10 14 / 60%);
  --app-table-header-bg: rgb(0 242 255 / 6%);
  --app-table-header-border: rgb(0 242 255 / 18%);
  --app-table-row-hover: rgb(0 242 255 / 6%);
  --app-table-cell-border: rgb(0 242 255 / 8%);
  --app-blur: blur(4px);
  --app-text-shadow: none;
  --app-text-glow: 0 0 6px rgb(0 242 255 / 45%);
  --app-text-glow-hover: 0 0 12px rgb(0 242 255 / 70%);
  --app-checkbox-border: rgb(0 242 255 / 35%);
  --app-checkbox-shadow: 0 0 6px rgb(0 242 255 / 50%);
  --app-mask-bg: rgb(4 4 5 / 70%);
  --app-select-caret: #00f2ff;
  --app-scrollbar-width: 6px;
  --app-scrollbar-track: rgb(4 4 5 / 50%);
  --app-scrollbar-thumb: rgb(0 242 255 / 25%);
  --app-scrollbar-thumb-hover: rgb(0 242 255 / 45%);

  /* Element Plus 主题变量覆盖 */
  --el-color-primary-light-9: rgb(0 242 255 / 10%);
  --el-color-danger: #f40303;
}

/* 整体背景图：默认使用 --miku-bg，用户在插件主页切换后以 html 内联变量覆盖；
   深色半透明渐变叠加保证前景文字可读性 */
html.hatsune-miku body {
  background-color: var(--app-bg);
  background-image: linear-gradient(rgb(4 4 5 / 45%), rgb(4 4 5 / 45%)), var(--miku-bg);
  background-size: cover;
  background-position: center;
  background-attachment: fixed;
  background-repeat: no-repeat;
}

/* 登录卡片：logo 显示在"文件管理器"标题上方，按原始比例（7529×836）自动缩放 */
html.hatsune-miku .login-header::before {
  content: '';
  display: block;
  width: 240px;
  aspect-ratio: 7529 / 836;
  margin: 0 auto 14px;
  background: url('${LOGO_URL}') no-repeat center / contain;
}
`

/** 插件主页样式（跟随当前主题变量，任何主题下均可渲染） */
const PAGE_STYLE_ID = 'hatsune-miku-theme-page-styles'
const PAGE_CSS = `
.miku-bg-container { height: 100vh; display: flex; align-items: flex-start; justify-content: center; padding-top: 60px; overflow-y: auto; }
.miku-bg-card { width: 760px; background: var(--app-panel); border: 1px solid var(--app-border); border-radius: 12px; box-shadow: var(--app-glow), var(--app-shadow); backdrop-filter: var(--app-blur); }
.miku-bg-card .back-btn { color: var(--app-text-dim); padding: 4px 8px; }
.miku-bg-title { margin: 0; font-size: 20px; color: var(--app-text-bright); }
.miku-bg-header { display: flex; align-items: center; gap: 12px; margin-bottom: 4px; }
.miku-bg-sub { font-size: 13px; color: var(--app-text-dim); margin: 4px 0 0; }
.miku-bg-divider { font-size: 14px; font-weight: 600; color: var(--app-text-bright); }
.miku-bg-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; margin-top: 12px; }
.miku-bg-item { border: 2px solid var(--app-border); border-radius: 8px; overflow: hidden; cursor: pointer; background: var(--app-bg); transition: border-color 0.2s, box-shadow 0.2s; }
.miku-bg-item:hover { border-color: var(--app-accent); }
.miku-bg-item.active { border-color: var(--app-accent); box-shadow: var(--app-glow); }
.miku-bg-thumb { width: 100%; height: 120px; object-fit: cover; display: block; }
.miku-bg-name { font-size: 12px; color: var(--app-text-dim); padding: 6px 8px; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.miku-bg-item.active .miku-bg-name { color: var(--app-accent); }
`

function injectPageStyles(): void {
  if (document.getElementById(PAGE_STYLE_ID)) return
  const style = document.createElement('style')
  style.id = PAGE_STYLE_ID
  style.textContent = PAGE_CSS
  document.head.appendChild(style)
}

export const install: FrontendPluginInstallFunction = (ctx) => {
  const { h, ref, defineComponent } = ctx.Vue
  const { ElButton, ElDivider, ElMessage } = ctx.ElementPlus

  ctx.composables.useTheme().registerTheme({
    name: 'hatsune-miku',
    label: '初音未来',
    className: 'hatsune-miku',
    css: THEME_CSS,
  })

  // 恢复用户上次选择的背景图（默认图无需内联覆盖）
  applyBackground(currentBackgroundId())

  injectPageStyles()

  // 插件主页：背景图切换
  const BackgroundView = defineComponent({
    name: 'HatsuneMikuThemeView',
    setup() {
      const selectedId = ref(currentBackgroundId())

      function select(id: string) {
        applyBackground(id)
        selectedId.value = id
        ElMessage.success('背景图已切换')
      }

      return () => {
        const children: any[] = []
        children.push(
          h('div', { style: { paddingTop: '10px', paddingLeft: '10px' } }, [
            h(ElButton, { text: true, class: 'back-btn', onClick: () => window.history.back() }, () => '← 返回'),
          ])
        )

        const m: any[] = []
        m.push(h('div', { class: 'miku-bg-header' }, [h('h3', { class: 'miku-bg-title' }, '初音未来主题')]))
        m.push(h('p', { class: 'miku-bg-sub' }, '选择主界面背景图，切换后立即生效并自动保存。'))
        m.push(
          h(ElDivider, { contentPosition: 'left' }, () => h('span', { class: 'miku-bg-divider' }, '背景图')),
          h('div', { class: 'miku-bg-grid' }, BACKGROUNDS.map((bg) => {
            const active = bg.id === selectedId.value
            return h('div', {
              class: ['miku-bg-item', active ? 'active' : ''],
              onClick: () => select(bg.id),
            }, [
              h('img', { class: 'miku-bg-thumb', src: bg.url, alt: bg.label, loading: 'lazy' }),
              h('div', { class: 'miku-bg-name' }, bg.label),
            ])
          }))
        )

        children.push(h('div', { style: { padding: '20px 36px' } }, m))
        return h('div', { class: 'miku-bg-container' }, [h('div', { class: 'miku-bg-card' }, children)])
      }
    },
  })

  ctx.router.addRoute({ path: '/plugin/hatsune-miku-theme', component: BackgroundView })
  console.log('[Hatsune Miku Theme] Frontend loaded — theme "hatsune-miku" registered, page at /plugin/hatsune-miku-theme')
}
