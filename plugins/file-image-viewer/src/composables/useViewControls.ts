/**
 * 视图控制：缩放 / 旋转 / 平移 / 适应窗口 / 滚轮 / 拖拽 / transform。
 *
 * 管理舞台（stage）上的交互与视图状态，并通过 setupStageRef 绑定舞台元素事件、
 * onImgLoad 计算适配比例；document 级 mousemove/mouseup 在挂载/卸载时维护。
 */

import type { FrontendPluginContext } from '@mqn00/file-manager/plugin/frontend'
import { WHEEL_ZOOM_STEP } from '../constants'

export function useViewControls(ctx: FrontendPluginContext) {
  const { ref, onMounted, onBeforeUnmount } = ctx.Vue

  const scale = ref(1)
  const rotate = ref(0)
  const offsetX = ref(0)
  const offsetY = ref(0)
  const fitScale = ref(100)
  const naturalW = ref(0)
  const naturalH = ref(0)

  // 拖拽状态（不用 ref，避免触发渲染）
  let dragging = false
  let dragStartX = 0
  let dragStartY = 0
  let dragOriginOffsetX = 0
  let dragOriginOffsetY = 0

  // 舞台元素（setupStageRef 绑定）
  let stageBound = false
  let stageEl: HTMLElement | null = null

  /** 重置视图（路径切换/初始加载时调用） */
  const reset = () => {
    scale.value = 1
    rotate.value = 0
    offsetX.value = 0
    offsetY.value = 0
    fitScale.value = 100
    naturalW.value = 0
    naturalH.value = 0
  }

  const applyZoom = (delta: number) => {
    scale.value = Math.min(10, Math.max(0.1, Number((scale.value + delta).toFixed(2))))
  }

  /** 以鼠标位置为中心缩放 */
  const zoomAtPoint = (
    delta: number,
    clientX: number,
    clientY: number,
    stage: HTMLElement
  ) => {
    const rect = stage.getBoundingClientRect()
    const mouseX = clientX - rect.left
    const mouseY = clientY - rect.top
    const imgCenterX = rect.width / 2 + offsetX.value
    const imgCenterY = rect.height / 2 + offsetY.value

    const oldScale = scale.value
    const newScale = Math.min(10, Math.max(0.1, Number((oldScale + delta).toFixed(2))))
    if (newScale === oldScale) return

    const ratio = newScale / oldScale
    const dx = mouseX - imgCenterX
    const dy = mouseY - imgCenterY
    offsetX.value -= dx * (ratio - 1)
    offsetY.value -= dy * (ratio - 1)

    scale.value = newScale
  }

  /** 适应窗口：scale 直接设为图片适配窗口的真实比例 */
  const fitToWindow = () => {
    scale.value = fitScale.value / 100
    rotate.value = 0
    offsetX.value = 0
    offsetY.value = 0
  }

  /** 当前是否处于适应状态（scale 等于适配比例） */
  const isFitActive = () => Math.abs(scale.value - fitScale.value / 100) < 0.005

  const handleWheel = (e: WheelEvent) => {
    e.preventDefault()
    const stage = e.currentTarget as HTMLElement
    const delta = e.deltaY > 0 ? -WHEEL_ZOOM_STEP : WHEEL_ZOOM_STEP
    zoomAtPoint(delta, e.clientX, e.clientY, stage)
  }

  /** 稳定的 ref 回调，挂载时绑定事件，卸载时重置标记 */
  const setupStageRef = (el: any) => {
    stageEl = el
    if (el) {
      if (!stageBound) {
        el.addEventListener('mousedown', onMouseDown)
        el.addEventListener('wheel', handleWheel, { passive: false })
      }
      stageBound = true
    } else {
      stageBound = false
    }
  }

  /** img 加载后：按视口尺寸计算适配比例，图片初始即处于适应状态 */
  const onImgLoad = (e: Event) => {
    const img = e.target as HTMLImageElement
    if (img.naturalWidth <= 0 || !stageEl) return
    naturalW.value = img.naturalWidth
    naturalH.value = img.naturalHeight
    const contentW = stageEl.clientWidth - 24 // 减去 12px padding * 2
    const contentH = stageEl.clientHeight - 24
    const f = Math.min(contentW / img.naturalWidth, contentH / img.naturalHeight)
    fitScale.value = Math.round(f * 100)
    scale.value = fitScale.value / 100
    offsetX.value = 0
    offsetY.value = 0
  }

  const onMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return
    dragging = true
    dragStartX = e.clientX
    dragStartY = e.clientY
    dragOriginOffsetX = offsetX.value
    dragOriginOffsetY = offsetY.value
  }

  const onMouseMove = (e: MouseEvent) => {
    if (!dragging) return
    offsetX.value = dragOriginOffsetX + (e.clientX - dragStartX)
    offsetY.value = dragOriginOffsetY + (e.clientY - dragStartY)
  }

  const onMouseUp = () => {
    if (!dragging) return
    dragging = false
  }

  onMounted(() => {
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  })
  onBeforeUnmount(() => {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  })

  const getTransformStyle = () => {
    const parts: string[] = []
    if (offsetX.value || offsetY.value) {
      parts.push(`translate(${offsetX.value}px, ${offsetY.value}px)`)
    }
    if (scale.value !== 1) {
      parts.push(`scale(${scale.value})`)
    }
    if (rotate.value) {
      parts.push(`rotate(${rotate.value}deg)`)
    }
    return parts.join(' ')
  }

  return {
    scale,
    rotate,
    offsetX,
    offsetY,
    fitScale,
    naturalW,
    naturalH,
    reset,
    applyZoom,
    fitToWindow,
    isFitActive,
    getTransformStyle,
    setupStageRef,
    onImgLoad,
  }
}
