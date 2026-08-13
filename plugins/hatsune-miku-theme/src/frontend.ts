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
 * 图片静态资源（内置背景图 + logo + 用户上传背景图）由插件后端
 * /api/hatsune-miku-theme 提供，不依赖主项目 /plugins-assets。
 *
 * 类型由 @mqn00/file-manager/plugin/frontend 提供。
 */

import type { FrontendPluginInstallFunction } from '@mqn00/file-manager/plugin/frontend'
import rawThemeCss from './theme.css'
import pageCss from './page.css'
import {
  API_BASE,
  LOGO_URL,
  DEFAULT_BG_ID,
  builtinFallback,
  currentBackgroundId,
  applyBackground,
} from './backgrounds'
import type { BackgroundInfo } from './backgrounds'
import { currentPanelOpacity, currentPanelBlur, previewPanelSettings } from './panel-settings'
import { setupTooltipFixedBackground } from './tooltip-fixed-background'
import { createBackgroundView } from './background-view'

const THEME_CSS = rawThemeCss
  .replace(/__MIKU_DEFAULT_BG_URL__/g, `${API_BASE}/bg/${DEFAULT_BG_ID}`)
  .replace(/__MIKU_LOGO_URL__/g, LOGO_URL)

/** 插件主页样式（跟随当前主题变量，任何主题下均可渲染） */
const PAGE_STYLE_ID = 'hatsune-miku-theme-page-styles'

function injectPageStyles(): void {
  if (document.getElementById(PAGE_STYLE_ID)) return
  const style = document.createElement('style')
  style.id = PAGE_STYLE_ID
  style.textContent = pageCss
  document.head.appendChild(style)
}

export const install: FrontendPluginInstallFunction = async (ctx) => {
  const { ref } = ctx.Vue

  ctx.composables.useTheme().registerTheme({
    name: 'hatsune-miku',
    label: '初音未来',
    className: 'hatsune-miku',
    css: THEME_CSS,
  })

  injectPageStyles()
  setupTooltipFixedBackground()

  /** 背景列表（内置 + 自定义），失败时保持内置兜底 */
  const backgrounds = ref<BackgroundInfo[]>(builtinFallback())

  async function refreshBackgrounds(): Promise<void> {
    try {
      const res = await ctx.api.instance.get('/hatsune-miku-theme/backgrounds')
      const list = res.data?.backgrounds
      if (Array.isArray(list) && list.length > 0) {
        backgrounds.value = list
      }
    } catch {
      // 后端不可用：保持内置兜底列表
    }
  }

  // 恢复用户上次选择的背景图与面板透明度/模糊度（默认值无需额外声明）
  await refreshBackgrounds()
  applyBackground(currentBackgroundId(backgrounds.value), backgrounds.value)
  previewPanelSettings(currentPanelOpacity(), currentPanelBlur())

  const BackgroundView = createBackgroundView(ctx, { backgrounds, refreshBackgrounds })

  ctx.router.addRoute({ path: '/plugin/hatsune-miku-theme', component: BackgroundView })
  console.log(
    '[Hatsune Miku Theme] Frontend loaded — theme "hatsune-miku" registered, page at /plugin/hatsune-miku-theme'
  )
}
