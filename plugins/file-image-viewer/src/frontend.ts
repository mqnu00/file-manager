/**
 * file-image-viewer：图片查看（缩放/旋转/适应窗口 + 文件夹内上一张/下一张切换 +
 * 缩略图图库：按名称排序分页展示当前文件夹图片缩略图，点击跳转）
 *
 * 通过平台 I/O 换取流令牌：
 *   POST /api/files/token  → 30 分钟令牌
 *   GET  /api/files/stream（Range 流式）→ <img src>
 *
 * 文件夹切换：拉取父目录图片列表（按名称升序），用 history.pushState +
 * PopStateEvent 改写查看页 URL（保留 mode），由 file-viewer 查看页壳重渲染。
 * 缩略图图库：复用同一名称升序列表，分页懒加载流令牌并以 CSS 缩放渲染缩略图。
 */

import type {
  FrontendPluginContext,
  FrontendPluginInstallFunction,
  FileItem,
} from '@mqn00/file-manager/plugin/frontend'
import { getRegistry, type FileViewerModule } from './registry'
import { parseImageMetadata, type ImageMetadata } from './metadata'
import { buildImageList, sortByName, currentIndex, parentOf, makeViewerUrl, paginate, pageOf } from './navigation'

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
/** 缩略图图库每页张数 */
const GALLERY_PAGE_SIZE = 6

function createImageViewer(ctx: FrontendPluginContext) {
  const { h, ref, computed, watch, onMounted, onBeforeUnmount } = ctx.Vue
  const { ElButton, ElAlert, ElTag, ElMessage, ElDialog, ElPagination } = ctx.ElementPlus

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
      /** 解析出的图片元数据（分辨率/DPI/位深度），空对象表示未知 */
      const meta = ref<ImageMetadata>({})
      /** 图片真实尺寸兜底（img 加载后可得，解析失败时使用） */
      let naturalW = 0
      let naturalH = 0

      // 当前文件夹内全部图片（按名称升序）与当前所处位置
      const images = ref<FileItem[]>([])
      const currentIndex_ = ref(-1)

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
        meta.value = {}
        naturalW = 0
        naturalH = 0
        try {
          token.value = await api.createToken(props.file.path)
        } catch (e) {
          error.value = `获取图片地址失败: ${e instanceof Error ? e.message : '未知错误'}`
        }
        void loadMetadata()
      }

      /** 读取文件头解析元数据（分辨率/DPI/位深度）；失败静默，仅分辨率可用 natural 尺寸兜底 */
      const loadMetadata = async () => {
        try {
          const dot = props.file.name.lastIndexOf('.')
          const ext =
            dot >= 0 && dot < props.file.name.length - 1
              ? props.file.name.slice(dot + 1).toLowerCase()
              : ''
          const res = await api.read(props.file.path, 0, 64 * 1024)
          const bytes = api.base64ToBytes(res.data)
          meta.value = parseImageMetadata(bytes, ext)
        } catch {
          /* 解析失败不影响查看 */
        }
      }

      /** 拉取当前文件夹图片列表并按名称排列、定位当前位置；失败禁用导航 */
      const loadSiblings = async () => {
        const parent = parentOf(props.file.path)
        try {
          // 与 file-viewer 核心查看页一致，直接走 HTTP 列表接口（ctx.api.file 的
          // 声明与运行时方法存在历史偏差，避免依赖其方法名）
          const res = await ctx.api.instance.get('/files', { params: { path: parent } })
          const files = (res.data?.files as FileItem[] | undefined) ?? []
          const list = sortByName(buildImageList(files, IMAGE_EXTENSIONS))
          images.value = list
          currentIndex_.value = currentIndex(list, props.file.path)
        } catch {
          images.value = []
          currentIndex_.value = -1
        }
      }

      /** 导航到目标图片（保持 mode，由查看页 parseFromRoute 接管重渲染） */
      const goTo = (target: FileItem | undefined) => {
        if (!target) return
        const q = ctx.router.currentRoute.value.query
        const mode = typeof q.mode === 'string' ? q.mode : undefined
        history.pushState(history.state ?? null, '', makeViewerUrl(target.path, mode))
        window.dispatchEvent(new PopStateEvent('popstate'))
      }
      const goPrev = () => goTo(images.value[currentIndex_.value - 1])
      const goNext = () => goTo(images.value[currentIndex_.value + 1])

      const canPrev = computed(() => currentIndex_.value > 0)
      const canNext = computed(
        () => currentIndex_.value >= 0 && currentIndex_.value < images.value.length - 1
      )

      // ─── 缩略图图库（分页展示当前文件夹图片缩略图，点击跳转） ───

      const galleryOpen = ref(false)
      const galleryPage = ref(1)
      /** path → 流令牌缓存（避免翻页/开关对话框重复请求） */
      const tokenMap = ref<Record<string, string>>({})
      /** 已确认加载失败的 path（显示占位） */
      const brokenPaths = ref<Set<string>>(new Set())

      const galleryTotal = computed(() => images.value.length)
      const galleryPageImages = computed(() =>
        paginate(images.value, galleryPage.value, GALLERY_PAGE_SIZE)
      )

      /** 为一批图片惰性签发流令牌（未缓存且未失败才请求） */
      const ensureTokens = async (items: FileItem[]) => {
        const todo = items.filter(
          (f) => !tokenMap.value[f.path] && !brokenPaths.value.has(f.path)
        )
        await Promise.all(
          todo.map(async (f) => {
            try {
              const t = await api.createToken(f.path)
              tokenMap.value = { ...tokenMap.value, [f.path]: t }
            } catch {
              brokenPaths.value = new Set(brokenPaths.value).add(f.path)
            }
          })
        )
      }

      const openGallery = () => {
        galleryPage.value = pageOf(currentIndex_.value, GALLERY_PAGE_SIZE)
        galleryOpen.value = true
        void ensureTokens(galleryPageImages.value)
      }
      const onGalleryPageChange = (p: number) => {
        galleryPage.value = p
        void ensureTokens(galleryPageImages.value)
      }
      const onPickThumb = (img: FileItem) => {
        galleryOpen.value = false
        goTo(img)
      }

      // 键盘 ←/→ 切换（忽略修饰键组合，避免与全局快捷键冲突）
      const onKeydown = (e: KeyboardEvent) => {
        if (e.metaKey || e.ctrlKey || e.altKey) return
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          goPrev()
        } else if (e.key === 'ArrowRight') {
          e.preventDefault()
          goNext()
        }
      }

      onMounted(() => {
        document.addEventListener('keydown', onKeydown)
        void loadToken()
        void loadSiblings()
      })
      watch(() => props.file.path, () => {
        void loadToken()
        void loadSiblings()
      })

      onBeforeUnmount(() => {
        token.value = ''
        document.removeEventListener('keydown', onKeydown)
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
        naturalW = img.naturalWidth
        naturalH = img.naturalHeight
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

      /** 元数据文本：分辨率 · DPI · 位深度（未知项省略） */
      const metaText = () => {
        const w = meta.value.width ?? naturalW
        const h = meta.value.height ?? naturalH
        const parts: string[] = []
        if (w && h) parts.push(`${w} × ${h}`)
        if (meta.value.dpi) parts.push(`${meta.value.dpi} DPI`)
        if (meta.value.bitDepth) parts.push(`${meta.value.bitDepth}-bit`)
        return parts.join(' · ')
      }

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
            ElTag,
            { size: 'small', type: 'info' },
            () => `${props.file.name.toUpperCase()} · ${fmtSize()}`
          ),
          metaText() ? h('span', { class: 'fiv-meta' }, metaText()) : null,
          h('span', { style: { flex: 1 } }),
          h(
            ElButton,
            {
              size: 'small',
              disabled: !canPrev.value,
              onClick: goPrev,
            },
            () => '‹ 上一张'
          ),
          h(
            ElTag,
            { size: 'small', type: 'info' },
            () =>
              `${images.value.length ? currentIndex_.value + 1 : 0} / ${images.value.length}`
          ),
          h(
            ElButton,
            {
              size: 'small',
              disabled: !canNext.value,
              onClick: goNext,
            },
            () => '下一张 ›'
          ),
          images.value.length > 0
            ? h(ElButton, { size: 'small', onClick: openGallery }, () => '图库')
            : null,
          h(
            ElButton,
            {
              size: 'small',
              type: isFitActive() ? 'primary' : '',
              onClick: fitToWindow,
            },
            () => '适应窗口'
          ),
          h(
            ElButton,
            { size: 'small', onClick: () => applyZoom(-ZOOM_STEP) },
            () => '缩小'
          ),
          h(
            ElButton,
            { size: 'small', onClick: () => applyZoom(ZOOM_STEP) },
            () => '放大'
          ),
          h(
            ElButton,
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
          h(ElButton, { size: 'small', onClick: download }, () => '下载图片'),
        ])

        let viewerNode
        if (error.value) {
          viewerNode = h('div', { class: 'fiv-viewer' }, [
            toolbar,
            h('div', { style: { height: '12px' } }),
            h(ElAlert, {
              type: 'error',
              showIcon: false,
              title: error.value,
              closable: false,
            }),
            h('div', { style: { height: '12px' } }),
            h(ElButton, { size: 'small', onClick: download }, () => '下载文件'),
          ])
        } else if (!token.value) {
          viewerNode = h('div', { class: 'fiv-viewer' }, [
            toolbar,
            h('div', { class: 'fiv-loading' }, '加载图片地址中…'),
          ])
        } else {
          const transform = getTransformStyle()
          viewerNode = h('div', { class: 'fiv-viewer' }, [
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

        const galleryDialog = h(
          ElDialog,
          {
            modelValue: galleryOpen.value,
            title: `缩略图（共 ${galleryTotal.value} 张）`,
            width: '720px',
            appendToBody: true,
            'onUpdate:modelValue': (v: boolean) => {
              if (!v) galleryOpen.value = false
            },
          },
          [
            galleryPageImages.value.length === 0
              ? h('div', { class: 'fiv-gallery-empty' }, '文件夹内无图片')
              : h('div', { class: 'fiv-gallery' }, [
                  ...galleryPageImages.value.map((img) => {
                    const t = tokenMap.value[img.path]
                    const broken = brokenPaths.value.has(img.path)
                    const isActive = img.path === props.file.path
                    const thumbSrc = t && !broken ? api.streamUrl(t) : ''
                    return h(
                      'div',
                      {
                        key: img.path,
                        class: 'fiv-thumb-wrap' + (isActive ? ' is-active' : ''),
                        onClick: () => onPickThumb(img),
                      },
                      [
                        broken || !thumbSrc
                          ? h('div', { class: 'fiv-thumb fiv-thumb-broken' }, '无预览')
                          : h('img', {
                              class: 'fiv-thumb',
                              src: thumbSrc,
                              loading: 'lazy',
                              alt: img.name,
                              draggable: false,
                              onError: () => {
                                brokenPaths.value = new Set(brokenPaths.value).add(img.path)
                              },
                            }),
                        h('span', { class: 'fiv-thumb-name' }, img.name),
                      ]
                    )
                  }),
                ]),
            h('div', { class: 'fiv-gallery-footer' }, [
              h(ElPagination, {
                small: true,
                layout: 'prev, pager, next',
                total: galleryTotal.value,
                currentPage: galleryPage.value,
                pageSize: GALLERY_PAGE_SIZE,
                onCurrentChange: onGalleryPageChange,
              }),
            ]),
          ]
        )

        return [viewerNode, galleryOpen.value ? galleryDialog : null]
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
.fiv-meta { color: var(--app-text-dim); font-size: 12px; white-space: nowrap; }
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
.fiv-gallery {
  display: flex; flex-wrap: wrap; gap: 12px; padding: 4px; justify-content: flex-start;
}
.fiv-thumb-wrap {
  width: 96px; cursor: pointer; border: 2px solid transparent; border-radius: 6px;
  padding: 4px; text-align: center; box-sizing: border-box;
}
.fiv-thumb-wrap:hover { border-color: var(--app-accent); }
.fiv-thumb-wrap.is-active { border-color: var(--app-accent); background: var(--app-accent-bg); }
.fiv-thumb {
  width: 96px; height: 96px; object-fit: cover; border-radius: 4px; display: block; background: #000;
}
.fiv-thumb-broken {
  display: flex; align-items: center; justify-content: center;
  color: var(--app-text-dim); background: var(--app-table-header-bg); font-size: 12px;
}
.fiv-thumb-name {
  display: block; max-width: 96px; overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap; font-size: 12px; color: var(--app-text-dim); margin-top: 4px;
}
.fiv-gallery-footer {
  display: flex; justify-content: center; margin-top: 12px;
  padding-top: 10px; border-top: 1px solid var(--app-border);
}
.fiv-gallery-empty { color: var(--app-text-dim); padding: 24px; text-align: center; }
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
