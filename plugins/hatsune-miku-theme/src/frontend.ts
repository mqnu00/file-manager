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

/** 插件后端 API 前缀（图片静态资源由插件自己提供） */
const API_BASE = '/api/hatsune-miku-theme'
const LOGO_URL = `${API_BASE}/logo`

/** localStorage 键：用户选择的背景图（与主题存储机制一致，按浏览器持久化） */
const STORAGE_KEY_BG = 'hatsune-miku-theme-bg'

/** localStorage 键：面板黑色半透明程度（alpha 百分比 0-100） */
const STORAGE_KEY_PANEL_OPACITY = 'hatsune-miku-theme-panel-opacity'

/** 面板透明度默认值（与主题 CSS 默认 --app-panel 的 alpha 一致） */
const DEFAULT_PANEL_OPACITY = 55

/** localStorage 键：面板背景模糊度（px 0-30） */
const STORAGE_KEY_PANEL_BLUR = 'hatsune-miku-theme-panel-blur'

/** 面板模糊度默认值（px，与主题 CSS 默认 --app-blur 一致） */
const DEFAULT_PANEL_BLUR = 4

/** 内置背景图（来自 DB_Hatsune-Miku-Theme/media，logo3.png 不适合做背景故排除） */
const BUILTIN_BG_FILES = ['f3DwR01P.png', 'o_1dmto233h1ap1grj1kn511qn1oim1o.jpg']
const DEFAULT_BG_ID = BUILTIN_BG_FILES[0]

interface BackgroundInfo {
  id: string
  label: string
  url: string
  builtin: boolean
}

/** 后端不可用时的兜底列表（仅内置图） */
function builtinFallback(): BackgroundInfo[] {
  return BUILTIN_BG_FILES.map((f) => ({
    id: f,
    label: f,
    url: `${API_BASE}/bg/${f}`,
    builtin: true,
  }))
}

/** 根据 id 查找背景定义；未知 id 回退列表第一项 */
function findBackground(bgs: BackgroundInfo[], id: string | null): BackgroundInfo {
  return bgs.find((b) => b.id === id) ?? bgs[0]
}

/** 读取当前生效的背景 id（未选择或损坏时返回默认） */
function currentBackgroundId(bgs: BackgroundInfo[]): string {
  let stored: string | null = null
  try {
    stored = localStorage.getItem(STORAGE_KEY_BG)
  } catch {
    // localStorage not available
  }
  return findBackground(bgs, stored).id
}

/**
 * 应用背景图：写入 localStorage 并通过 html 内联 --miku-bg 覆盖主题 CSS 默认值。
 * 选择默认图时清除内联属性，由主题 CSS 中的默认 URL 生效。
 */
function applyBackground(id: string, bgs: BackgroundInfo[]): void {
  const bg = findBackground(bgs, id)
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

/** 读取当前面板透明度（0-100 整数，未配置或损坏时返回默认值） */
function currentPanelOpacity(): number {
  let stored: string | null = null
  try {
    stored = localStorage.getItem(STORAGE_KEY_PANEL_OPACITY)
  } catch {
    // localStorage not available
  }
  const n = stored === null ? Number.NaN : Number(stored)
  if (Number.isFinite(n)) {
    return Math.min(100, Math.max(0, Math.round(n)))
  }
  return DEFAULT_PANEL_OPACITY
}

/** 面板效果独立 <style>：规则限定在 html.hatsune-miku 内，切换其他主题自动失效 */
const PANEL_SETTINGS_STYLE_ID = 'hatsune-miku-panel-settings'

/**
 * 预览面板效果（透明度 + 模糊度）：写入限定 html.hatsune-miku 作用域的独立 <style>，
 * 不写入 localStorage。值等于默认值时省略对应声明，由主题 CSS 默认值生效。
 * 注意：不能写 <html> 内联变量——内联样式优先级高于所有主题样式表，会把
 * --app-blur（各主题共用）泄漏到赛博/白天主题。
 */
function previewPanelSettings(opacity: number, blur: number): void {
  const o = Math.min(100, Math.max(0, Math.round(opacity)))
  const b = Math.min(30, Math.max(0, Math.round(blur)))
  const decls: string[] = []
  if (o !== DEFAULT_PANEL_OPACITY) decls.push(`--app-panel-opacity: ${o}%`)
  if (b !== DEFAULT_PANEL_BLUR) decls.push(`--app-blur: blur(${b}px)`)
  let style = document.getElementById(PANEL_SETTINGS_STYLE_ID) as HTMLStyleElement | null
  if (!style) {
    style = document.createElement('style')
    style.id = PANEL_SETTINGS_STYLE_ID
    document.head.appendChild(style)
  }
  style.textContent = decls.length > 0 ? `html.hatsune-miku { ${decls.join('; ')} }` : ''
}

/** 持久化面板透明度（写入 localStorage，点击「保存面板效果」时调用） */
function savePanelOpacity(opacity: number): void {
  const value = Math.min(100, Math.max(0, Math.round(opacity)))
  try {
    localStorage.setItem(STORAGE_KEY_PANEL_OPACITY, String(value))
  } catch {
    // localStorage not available
  }
}

/** 读取当前面板模糊度（0-30 整数 px，未配置或损坏时返回默认值） */
function currentPanelBlur(): number {
  let stored: string | null = null
  try {
    stored = localStorage.getItem(STORAGE_KEY_PANEL_BLUR)
  } catch {
    // localStorage not available
  }
  const n = stored === null ? Number.NaN : Number(stored)
  if (Number.isFinite(n)) {
    return Math.min(30, Math.max(0, Math.round(n)))
  }
  return DEFAULT_PANEL_BLUR
}

/** 持久化面板模糊度（写入 localStorage，点击「保存面板效果」时调用） */
function savePanelBlur(px: number): void {
  const value = Math.min(30, Math.max(0, Math.round(px)))
  try {
    localStorage.setItem(STORAGE_KEY_PANEL_BLUR, String(value))
  } catch {
    // localStorage not available
  }
}

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
  const { h, ref, defineComponent, onUnmounted } = ctx.Vue
  const { ElButton, ElDivider, ElMessage, ElMessageBox, ElSlider, ElTag } = ctx.ElementPlus

  ctx.composables.useTheme().registerTheme({
    name: 'hatsune-miku',
    label: '初音未来',
    className: 'hatsune-miku',
    css: THEME_CSS,
  })

  injectPageStyles()

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

  // 插件主页：背景图切换 + 自定义背景上传/删除 + 面板透明度/模糊度配置（先预览后保存）
  const BackgroundView = defineComponent({
    name: 'HatsuneMikuThemeView',
    setup() {
      const selectedId = ref(currentBackgroundId(backgrounds.value))
      const uploading = ref(false)
      const fileInputRef = ref<HTMLInputElement | null>(null)
      const panelOpacity = ref(currentPanelOpacity())
      const panelBlur = ref(currentPanelBlur())
      // 已保存的配置（localStorage 中的值），用于判断是否存在未保存修改
      const savedOpacity = ref(panelOpacity.value)
      const savedBlur = ref(panelBlur.value)

      function select(id: string) {
        applyBackground(id, backgrounds.value)
        selectedId.value = id
        ElMessage.success('背景图已切换')
      }

      async function handleFileChange(event: Event) {
        const input = event.target as HTMLInputElement
        const file = input.files?.[0]
        input.value = ''
        if (!file) return
        const formData = new FormData()
        formData.append('file', file)
        uploading.value = true
        try {
          const res = await ctx.api.instance.post('/hatsune-miku-theme/backgrounds', formData)
          const uploaded = res.data as { id?: string; url?: string }
          ElMessage.success('背景图已上传')
          await refreshBackgrounds()
          if (uploaded?.id) {
            applyBackground(uploaded.id, backgrounds.value)
            selectedId.value = uploaded.id
          }
        } catch (err: unknown) {
          const msg =
            err && typeof err === 'object' && 'response' in err
              ? ((err as { response?: { data?: { error?: string } } }).response?.data?.error ??
                '上传失败')
              : '上传失败'
          ElMessage.error(msg)
        } finally {
          uploading.value = false
        }
      }

      async function confirmDelete(bg: BackgroundInfo) {
        try {
          await ElMessageBox.confirm(`确定删除背景图 "${bg.label}" 吗？`, '删除确认', {
            confirmButtonText: '删除',
            cancelButtonText: '取消',
            type: 'warning',
          })
        } catch {
          return // 用户取消
        }
        try {
          await ctx.api.instance.delete(
            `/hatsune-miku-theme/backgrounds/${encodeURIComponent(bg.id)}`
          )
          ElMessage.success('背景图已删除')
          if (selectedId.value === bg.id) {
            applyBackground(DEFAULT_BG_ID, backgrounds.value)
            selectedId.value = DEFAULT_BG_ID
          }
          await refreshBackgrounds()
        } catch {
          ElMessage.error('删除失败')
        }
      }

      /** 保存面板效果：写入 localStorage 并作为新的已保存基准 */
      function savePanelSettings() {
        savePanelOpacity(panelOpacity.value)
        savePanelBlur(panelBlur.value)
        savedOpacity.value = panelOpacity.value
        savedBlur.value = panelBlur.value
        ElMessage.success('面板效果已保存')
      }

      // 离开插件主页时还原未保存的预览（仅预览不保存的修改会被丢弃）
      onUnmounted(() => {
        previewPanelSettings(savedOpacity.value, savedBlur.value)
      })

      return () => {
        const children: any[] = []
        children.push(
          h('div', { style: { paddingTop: '10px', paddingLeft: '10px' } }, [
            h(
              ElButton,
              { text: true, class: 'back-btn', onClick: () => window.history.back() },
              () => '← 返回'
            ),
          ])
        )

        const m: any[] = []
        m.push(
          h('div', { class: 'miku-bg-header' }, [
            h('h3', { class: 'miku-bg-title' }, '初音未来主题'),
          ])
        )
        m.push(
          h(
            'p',
            { class: 'miku-bg-sub' },
            '选择主界面背景图，切换后立即生效并自动保存。可上传自定义背景图。'
          )
        )
        m.push(
          h(ElDivider, { contentPosition: 'left' }, () =>
            h('span', { class: 'miku-bg-divider' }, '背景图')
          )
        )

        const items = backgrounds.value.map((bg) => {
          const active = bg.id === selectedId.value
          const name = h('div', { class: 'miku-bg-name' }, [
            h('span', bg.label),
            bg.builtin
              ? null
              : h(
                  ElButton,
                  {
                    size: 'small',
                    text: true,
                    type: 'danger',
                    onClick: (e: MouseEvent) => {
                      e.stopPropagation()
                      confirmDelete(bg)
                    },
                  },
                  () => '删除'
                ),
          ])
          return h(
            'div',
            {
              class: ['miku-bg-item', active ? 'active' : ''],
              onClick: () => select(bg.id),
            },
            [
              h('img', { class: 'miku-bg-thumb', src: bg.url, alt: bg.label, loading: 'lazy' }),
              name,
            ]
          )
        })
        m.push(h('div', { class: 'miku-bg-grid' }, items))

        m.push(
          h('div', { class: 'miku-bg-upload' }, [
            h('input', {
              ref: fileInputRef,
              type: 'file',
              accept: 'image/*',
              style: { display: 'none' },
              onChange: handleFileChange,
            }),
            h(
              ElButton,
              {
                type: 'primary',
                loading: uploading.value,
                onClick: () => fileInputRef.value?.click(),
              },
              () => '上传背景图'
            ),
            h('span', { class: 'miku-bg-upload-tip' }, '支持 png / jpg / webp / gif，最大 10MB'),
          ])
        )

        const hasChanges =
          panelOpacity.value !== savedOpacity.value || panelBlur.value !== savedBlur.value

        m.push(
          h(ElDivider, { contentPosition: 'left' }, () =>
            h('span', { class: 'miku-bg-divider' }, '面板效果')
          )
        )
        m.push(
          h('div', { class: 'miku-config-row' }, [
            h('div', { class: 'miku-config-label' }, [
              h('span', '面板黑色半透明程度'),
              h('span', { class: 'miku-config-value' }, `${panelOpacity.value}%`),
            ]),
            h('div', { class: 'miku-config-slider' }, [
              h(ElSlider, {
                min: 0,
                max: 100,
                modelValue: panelOpacity.value,
                'onUpdate:modelValue': (v: number | number[]) => {
                  const value = Array.isArray(v) ? v[0] : v
                  panelOpacity.value = value
                  previewPanelSettings(value, panelBlur.value)
                },
              }),
              h(
                ElButton,
                {
                  size: 'small',
                  text: true,
                  disabled: panelOpacity.value === DEFAULT_PANEL_OPACITY,
                  onClick: () => {
                    panelOpacity.value = DEFAULT_PANEL_OPACITY
                    previewPanelSettings(DEFAULT_PANEL_OPACITY, panelBlur.value)
                  },
                },
                () => '重置默认'
              ),
            ]),
            h(
              'p',
              { class: 'miku-bg-upload-tip' },
              '数值越大面板越不透明，默认 55%，拖动实时预览，点击下方「保存面板效果」后生效。'
            ),
          ])
        )
        m.push(
          h('div', { class: 'miku-config-row' }, [
            h('div', { class: 'miku-config-label' }, [
              h('span', '面板背景模糊度'),
              h(
                'span',
                { class: 'miku-config-value' },
                panelBlur.value === 0 ? '无模糊' : `${panelBlur.value}px`
              ),
            ]),
            h('div', { class: 'miku-config-slider' }, [
              h(ElSlider, {
                min: 0,
                max: 30,
                modelValue: panelBlur.value,
                'onUpdate:modelValue': (v: number | number[]) => {
                  const value = Array.isArray(v) ? v[0] : v
                  panelBlur.value = value
                  previewPanelSettings(panelOpacity.value, value)
                },
              }),
              h(
                ElButton,
                {
                  size: 'small',
                  text: true,
                  disabled: panelBlur.value === DEFAULT_PANEL_BLUR,
                  onClick: () => {
                    panelBlur.value = DEFAULT_PANEL_BLUR
                    previewPanelSettings(panelOpacity.value, DEFAULT_PANEL_BLUR)
                  },
                },
                () => '重置默认'
              ),
            ]),
            h(
              'p',
              { class: 'miku-bg-upload-tip' },
              '数值越大背景越模糊，默认 4px，拖动实时预览，点击下方「保存面板效果」后生效。'
            ),
          ])
        )
        m.push(
          h('div', { class: 'miku-config-save' }, [
            h(
              ElButton,
              {
                type: 'primary',
                disabled: !hasChanges,
                onClick: savePanelSettings,
              },
              () => '保存面板效果'
            ),
            h(
              'span',
              { class: 'miku-bg-upload-tip' },
              hasChanges ? '有未保存的修改，点击保存后真正生效' : '当前已保存，无未保存修改'
            ),
          ])
        )

        m.push(
          h(ElDivider, { contentPosition: 'left' }, () =>
            h('span', { class: 'miku-bg-divider' }, '标签预览')
          )
        )
        m.push(
          h('div', { class: 'miku-tag-preview' }, [
            h(ElTag, { type: 'primary' }, () => 'primary'),
            h(ElTag, { type: 'success' }, () => 'success'),
            h(ElTag, { type: 'info' }, () => 'info'),
            h(ElTag, { type: 'warning' }, () => 'warning'),
            h(ElTag, { type: 'danger' }, () => 'danger'),
          ])
        )

        m.push(
          h(ElDivider, { contentPosition: 'left' }, () =>
            h('span', { class: 'miku-bg-divider' }, '消息预览')
          )
        )
        m.push(
          h('div', { class: 'miku-message-preview' }, [
            h(
              ElButton,
              {
                size: 'small',
                type: 'primary',
                onClick: () => ElMessage({ type: 'primary', message: 'primary 消息' }),
              },
              () => 'primary'
            ),
            h(
              ElButton,
              { size: 'small', type: 'success', onClick: () => ElMessage.success('success 消息') },
              () => 'success'
            ),
            h(
              ElButton,
              { size: 'small', type: 'info', onClick: () => ElMessage.info('info 消息') },
              () => 'info'
            ),
            h(
              ElButton,
              { size: 'small', type: 'warning', onClick: () => ElMessage.warning('warning 消息') },
              () => 'warning'
            ),
            h(
              ElButton,
              { size: 'small', type: 'danger', onClick: () => ElMessage.error('error 消息') },
              () => 'error'
            ),
          ])
        )

        children.push(h('div', { style: { padding: '20px 36px' } }, m))
        return h('div', { class: 'miku-bg-container' }, [
          h('div', { class: 'miku-bg-card' }, children),
        ])
      }
    },
  })

  ctx.router.addRoute({ path: '/plugin/hatsune-miku-theme', component: BackgroundView })
  console.log(
    '[Hatsune Miku Theme] Frontend loaded — theme "hatsune-miku" registered, page at /plugin/hatsune-miku-theme'
  )
}
