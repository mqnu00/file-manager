/**
 * 吸底悬浮面板背景对位（panel replica alignment）。
 *
 * 背景：body 背景图按视口 center/cover + fixed 绘制；悬浮面板（如设置页
 * 吸底操作栏，标记 [data-panel-replica]）位于带 backdrop-filter 的卡片内，
 * Chromium 会把 background-attachment: fixed 的背景相对该祖先定位甚至不绘制，
 * 导致面板只剩半透明叠层、透出底下滚过的内容。
 *
 * 做法：CSS 只提供不透明基线（元素坐标、未校准）；这里按面板实时视口位置，
 * 用与 body 完全相同的 cover/center 几何算出图片绘制矩形，换算为面板自己的
 * background-position / background-size 写入内联样式，使面板透出的背景图
 * 与 body 背景逐像素对齐（钉住与随内容滚动两种状态都成立）。
 */

/** 与 theme.css --app-panel-replica 的层数一致：panel 暗色 / 径向光晕 / 背景图 */
const LAYER_COUNT = 4
/** body 背景图层的绘制几何与 theme.css html.hatsune-miku body 保持一致 */
const RADIAL_SIZE = '100vw 100vh'

interface ImageGeometry {
  url: string
  width: number
  height: number
}

let cachedGeometry: ImageGeometry | null = null
let pendingUrl: string | null = null
let rafId = 0
let started = false
const touched = new WeakSet<HTMLElement>()

/** 从 --miku-bg 变量值中提取 url(...) 的地址 */
function readMikuBgUrl(): string | null {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--miku-bg').trim()
  if (!raw) return null
  const match = raw.match(/^url\(['"]?([^'")]*)['"]?\)$/)
  return match ? match[1] : null
}

/** 加载图片取自然尺寸（同 URL 命中缓存；变化时重新加载） */
function ensureImageGeometry(url: string): ImageGeometry | null {
  if (cachedGeometry && cachedGeometry.url === url) return cachedGeometry
  if (pendingUrl === url) return null // 加载中
  pendingUrl = url
  const img = new Image()
  img.onload = () => {
    cachedGeometry = { url, width: img.naturalWidth, height: img.naturalHeight }
    pendingUrl = null
    schedule()
  }
  img.onerror = () => {
    pendingUrl = null
  }
  img.src = url
  return null
}

/** 面板 padding-box 原点的视口坐标（background 定位区原点） */
function paddingBoxOrigin(el: HTMLElement): { x: number; y: number } {
  const rect = el.getBoundingClientRect()
  const cs = getComputedStyle(el)
  return {
    x: rect.left + (parseFloat(cs.borderLeftWidth) || 0),
    y: rect.top + (parseFloat(cs.borderTopWidth) || 0),
  }
}

/** cover + center：背景图在视口中的绘制矩形（与 body 同一几何） */
function coverRect(vw: number, vh: number, iw: number, ih: number) {
  const scale = Math.max(vw / iw, vh / ih)
  const w = iw * scale
  const h = ih * scale
  return { w, h, x: (vw - w) / 2, y: (vh - h) / 2 }
}

function recompute(): void {
  // 仅在主题激活时校准；其余主题的复刻变量没有图片层
  if (!document.documentElement.classList.contains('hatsune-miku')) return

  const url = readMikuBgUrl()
  const geometry = url ? ensureImageGeometry(url) : cachedGeometry
  const vw = window.innerWidth
  const vh = window.innerHeight

  for (const el of Array.from(document.querySelectorAll<HTMLElement>('[data-panel-replica]'))) {
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) continue // 未挂载/隐藏

    if (!geometry || geometry.width === 0 || geometry.height === 0) {
      // 图片几何未知：保留 CSS 基线（不透明，仅未校准），不写内联样式
      continue
    }

    const { x: vx, y: vy } = paddingBoxOrigin(el)
    const { w, h, x: gx, y: gy } = coverRect(vw, vh, geometry.width, geometry.height)
    // 暗色/光晕层锚定视口原点；图片层对齐 body 的 cover 绘制矩形
    const positions = [
      '0px 0px',
      '0px 0px',
      `${-vx}px ${-vy}px`,
      `${gx - vx}px ${gy - vy}px`,
    ].join(', ')
    const sizes = ['auto', 'auto', RADIAL_SIZE, `${w}px ${h}px`].join(', ')

    el.style.backgroundPosition = positions
    el.style.backgroundSize = sizes
    el.style.backgroundAttachment = Array(LAYER_COUNT).fill('scroll').join(', ')
    touched.add(el)
  }
}

function schedule(): void {
  if (rafId) return
  rafId = requestAnimationFrame(() => {
    rafId = 0
    recompute()
  })
}

/** 启动对位校准；返回 teardown（移除监听并还原内联样式） */
export function setupPanelReplica(): () => void {
  if (started) return () => undefined
  started = true

  const onScroll = () => schedule()
  const onResize = () => schedule()
  // 路由切换挂载面板 / 主题或背景变量变化（html class、--miku-bg 内联样式）
  const bodyObserver = new MutationObserver(schedule)
  const htmlObserver = new MutationObserver(schedule)

  document.addEventListener('scroll', onScroll, { capture: true, passive: true })
  window.addEventListener('resize', onResize)
  bodyObserver.observe(document.body, { childList: true, subtree: true })
  htmlObserver.observe(document.documentElement, { attributes: true })

  schedule()

  return () => {
    document.removeEventListener('scroll', onScroll, { capture: true })
    window.removeEventListener('resize', onResize)
    bodyObserver.disconnect()
    htmlObserver.disconnect()
    if (rafId) cancelAnimationFrame(rafId)
    rafId = 0
    started = false
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('[data-panel-replica]'))) {
      if (!touched.has(el)) continue
      el.style.removeProperty('background-position')
      el.style.removeProperty('background-size')
      el.style.removeProperty('background-attachment')
    }
  }
}
