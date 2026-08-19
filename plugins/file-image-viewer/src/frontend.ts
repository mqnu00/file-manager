/**
 * file-image-viewer：图片查看（缩放/旋转/适应窗口）
 *
 * 通过平台 I/O 换取流令牌：
 *   POST /api/files/token  → 30 分钟令牌
 *   GET  /api/files/stream（Range 流式）→ <img src>
 */

import type {
  FrontendPluginContext,
  FrontendPluginInstallFunction,
  FileItem,
} from '@mqn00/file-manager/plugin/frontend'
import { getRegistry, type FileViewerModule } from './registry'

const IMAGE_EXTENSIONS = [
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'svg',
  'bmp',
  'ico',
  'avif',
  'apng',
  'jfif',
  'tif',
  'tiff',
  'heic',
  'heif',
]

/** 缩放步进 */
const ZOOM_STEP = 0.25
/** 滚轮缩放步进 */
const WHEEL_ZOOM_STEP = 0.1

function createImageViewer(ctx: FrontendPluginContext): unknown {
  const { h, ref, watch, onMounted, onBeforeUnmount } = ctx.Vue as unknown as {
    h: (type: unknown, props?: Record<string, unknown>, children?: unknown) => unknown
    ref: <T>(v: T) => { value: T }
    watch: (src: unknown, cb: (v: unknown) => void) => unknown
    onMounted: (cb: () => void) => void
    onBeforeUnmount: (cb: () => void) => void
  }
  const { ElButton, ElAlert, ElTag } = ctx.ElementPlus as unknown as {
    ElButton: never
    ElAlert: never
    ElTag: never
  }
  const ElMessage = (
    ctx.ElementPlus as unknown as {
      ElMessage: { error: (m: string) => void }
    }
  ).ElMessage

  const api = ctx.api.fileIO

  return ctx.Vue.defineComponent({
    name: 'FileImageViewer',
    props: {
      file: { type: Object, required: true },
    },
    setup(props: { file: FileItem }) {
      const token = ref('')
      const error = ref('')
      const scale = ref(1)
      const rotate = ref(0)
      const offsetX = ref(0)
      const offsetY = ref(0)
      /** 图片适配窗口时的真实缩放比（百分比），进入适应状态时 scale = fitScale / 100 */
      const fitScale = ref(100)

      // 拖拽状态（不用 ref，避免触发渲染）
      let dragging = false
      let dragStartX = 0
      let dragStartY = 0
      let dragOriginOffsetX = 0
      let dragOriginOffsetY = 0

      const loadToken = async () => {
        token.value = ''
        error.value = ''
        scale.value = 1
        rotate.value = 0
        offsetX.value = 0
        offsetY.value = 0
        fitScale.value = 100
        try {
          token.value = await api.createToken(props.file.path)
        } catch (e) {
          error.value = `获取图片地址失败: ${e instanceof Error ? e.message : '未知错误'}`
        }
      }

      onMounted(loadToken)
      watch(() => props.file.path, loadToken)

      onBeforeUnmount(() => {
        token.value = ''
      })

      // ─── 缩放 ───

      const applyZoom = (delta: number) => {
        scale.value = Math.min(10, Math.max(0.1, Number((scale.value + delta).toFixed(2))))
      }

      /** 以鼠标位置为中心缩放 */
      const zoomAtPoint = (
        delta: number,
        clientX: number,
        clientY: number,
        stageEl: HTMLElement
      ) => {
        const rect = stageEl.getBoundingClientRect()
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

      // ─── 滚轮缩放 ───

      const handleWheel = (e: WheelEvent) => {
        e.preventDefault()
        const stageEl = e.currentTarget as HTMLElement
        const delta = e.deltaY > 0 ? -WHEEL_ZOOM_STEP : WHEEL_ZOOM_STEP
        zoomAtPoint(delta, e.clientX, e.clientY, stageEl)
      }

      // ─── 拖拽 ───

      /** 稳定的 ref 回调，挂载时绑定事件，卸载时重置标记 */
      let stageBound = false
      let stageEl: HTMLElement | null = null
      const setupStageRef = (el: HTMLElement | null) => {
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

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)

      onBeforeUnmount(() => {
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
      })

      // ─── 下载 ───

      const download = async () => {
        try {
          const resp = await ctx.api.instance.get(
            `/files/download/${encodeURIComponent(props.file.path)}`,
            {
              responseType: 'blob',
            }
          )
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

      const fmtSize = () => ctx.utils.formatSize(props.file.size)

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

      return () => {
        const toolbar = h('div', { class: 'fiv-bar' }, [
          h(
            ElTag as never,
            { size: 'small', type: 'info' },
            () => `${props.file.name.toUpperCase()} · ${fmtSize()}`
          ),
          h('span', { style: { flex: 1 } }),
          h(
            ElButton as never,
            {
              size: 'small',
              type: isFitActive() ? 'primary' : '',
              onClick: fitToWindow,
            },
            () => '适应窗口'
          ),
          h(
            ElButton as never,
            { size: 'small', onClick: () => applyZoom(-ZOOM_STEP) },
            () => '缩小'
          ),
          h(
            ElButton as never,
            { size: 'small', onClick: () => applyZoom(ZOOM_STEP) },
            () => '放大'
          ),
          h(
            ElButton as never,
            {
              size: 'small',
              onClick: () => {
                rotate.value = (rotate.value + 90) % 360
              },
            },
            () => '旋转'
          ),
          h(
            'span',
            { class: 'fiv-zoom-info' },
            isFitActive()
              ? `适应 ${fitScale.value}% · ${rotate.value}°`
              : `${Math.round(scale.value * 100)}% · ${rotate.value}°`
          ),
          h(ElButton as never, { size: 'small', onClick: download }, () => '下载图片'),
        ])

        if (error.value) {
          return h('div', { class: 'fiv-viewer' }, [
            toolbar,
            h('div', { style: { height: '12px' } }),
            h(ElAlert as never, {
              type: 'error',
              showIcon: false,
              title: error.value,
              closable: false,
            }),
            h('div', { style: { height: '12px' } }),
            h(ElButton as never, { size: 'small', onClick: download }, () => '下载文件'),
          ])
        }

        if (!token.value) {
          return h('div', { class: 'fiv-viewer' }, [
            toolbar,
            h('div', { class: 'fiv-loading' }, '加载图片地址中…'),
          ])
        }

        const transform = getTransformStyle()

        return h('div', { class: 'fiv-viewer' }, [
          toolbar,
          h(
            'div',
            {
              ref: setupStageRef,
              class: 'fiv-stage fiv-stage-draggable',
            },
            [
              h('img', {
                class: 'fiv-zoom',
                src: api.streamUrl(token.value),
                alt: props.file.name,
                draggable: false,
                style: { transform },
                onLoad: onImgLoad,
                onError: () => {
                  error.value = '图片加载失败：该文件可能不是有效的图片'
                },
              }),
            ]
          ),
        ])
      }
    },
  })
}

function injectStyles(): void {
  if (document.getElementById('file-image-viewer-style')) return
  const style = document.createElement('style')
  style.id = 'file-image-viewer-style'
  style.textContent = `
.fiv-viewer { height: 100%; display: flex; flex-direction: column; }
.fiv-bar { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; }
.fiv-zoom-info { color: var(--app-text-dim); font-size: 12px; min-width: 70px; text-align: center; }
.fiv-loading { color: var(--app-text-dim); }
.fiv-stage {
  flex: 1; min-height: 0; overflow: hidden; display: flex;
  align-items: center; justify-content: center;
  padding: 12px; border: 1px solid var(--app-border); border-radius: 6px;
  position: relative;
}
.fiv-stage-draggable {
  cursor: grab;
}
.fiv-stage-draggable:active {
  cursor: grabbing;
}
.fiv-zoom {
  transform-origin: center center;
  max-width: none;
  max-height: none;
  object-fit: contain;
  will-change: transform;
}
`
  document.head.appendChild(style)
}

export const install: FrontendPluginInstallFunction = (ctx) => {
  injectStyles()
  const registry = getRegistry()
  if (!registry) {
    console.warn('[file-image-viewer] 未找到 file-viewer 核心注册表，跳过注册')
    return
  }
  const module: FileViewerModule = {
    id: 'image',
    label: '图片查看器',
    extensions: IMAGE_EXTENSIONS,
    editable: false,
    component: createImageViewer(ctx),
  }
  registry.register(module)

  console.log('[file-image-viewer] 前端已加载：图片模块已注册')
}
