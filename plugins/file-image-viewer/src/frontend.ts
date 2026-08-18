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
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg',
  'bmp', 'ico', 'avif', 'apng', 'jfif',
  'tif', 'tiff', 'heic', 'heif',
]

/** 缩放步进 */
const ZOOM_STEP = 0.25

function createImageViewer(ctx: FrontendPluginContext): unknown {
  const { h, ref, watch, onMounted, onBeforeUnmount } = ctx.Vue as unknown as {
    h: (type: unknown, props?: Record<string, unknown>, children?: unknown) => unknown
    ref: <T>(v: T) => { value: T }
    watch: (src: unknown, cb: (v: unknown) => void) => unknown
    onMounted: (cb: () => void) => void
    onBeforeUnmount: (cb: () => void) => void
  }
  const { ElButton, ElAlert, ElSlider, ElTag } = ctx.ElementPlus as unknown as {
    ElButton: never
    ElAlert: never
    ElSlider: never
    ElTag: never
  }
  const ElMessage = (ctx.ElementPlus as unknown as {
    ElMessage: { error: (m: string) => void }
  }).ElMessage

  // 平台文件 I/O（主项目 /api/files/* + ctx.api.fileIO），与 file-viewer 解耦
  const api = ctx.api.fileIO

  return ctx.Vue.defineComponent({
    name: 'FileImageViewer',
    props: {
      file: { type: Object, required: true },
    },
    setup(props: { file: FileItem }) {
      const token = ref('')
      const error = ref('')
      const scale = ref(1) // 1 = 100%
      const rotate = ref(0)
      const fitWindow = ref(true)

      const loadToken = async () => {
        token.value = ''
        error.value = ''
        // 切换文件时重置视图
        scale.value = 1
        rotate.value = 0
        fitWindow.value = true
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

      const zoom = (delta: number) => {
        fitWindow.value = false
        scale.value = Math.min(8, Math.max(0.1, Number((scale.value + delta).toFixed(2))))
      }

      const toggleFit = () => {
        fitWindow.value = !fitWindow.value
        if (fitWindow.value) {
          scale.value = 1
          rotate.value = 0
        }
      }

      const download = async () => {
        try {
          // 主应用鉴权为 Bearer header，下载走带认证的 axios 请求再触发浏览器保存
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

      const fmtSize = () => ctx.utils.formatSize(props.file.size)

      return () => {
        // 工具栏
        const toolbar = h('div', { class: 'img-bar' }, [
          h(ElTag as never, { size: 'small', type: 'info' }, () =>
            `${props.file.name.toUpperCase()} · ${fmtSize()}`
          ),
          h('span', { style: { flex: 1 } }),
          h(ElButton as never, {
            size: 'small',
            type: fitWindow.value ? 'primary' : '',
            onClick: toggleFit,
          }, () => '适应窗口'),
          h(ElButton as never, { size: 'small', onClick: () => zoom(-ZOOM_STEP) }, () => '缩小'),
          h(ElButton as never, { size: 'small', onClick: () => zoom(ZOOM_STEP) }, () => '放大'),
          h(ElButton as never, { size: 'small', onClick: () => { rotate.value = (rotate.value + 90) % 360 } }, () => '旋转'),
          // 原生元素 children 不能用函数（会被静默丢弃），用字符串
          h('span', { class: 'img-zoom-info' }, `${Math.round(scale.value * 100)}% · ${rotate.value}°`),
          h(ElSlider as never, {
            modelValue: scale.value,
            min: 0.1,
            max: 4,
            step: ZOOM_STEP,
            class: 'img-zoom-slider',
            onUpdate: (v: number | number[]) => {
              fitWindow.value = false
              scale.value = typeof v === 'number' ? v : (v[0] ?? 1)
            },
          }),
          h(ElButton as never, { size: 'small', onClick: download }, () => '下载图片'),
        ])

        if (error.value) {
          return h('div', { class: 'img-viewer' }, [
            toolbar,
            h('div', { style: { height: '12px' } }),
            h(ElAlert as never, { type: 'error', showIcon: false, title: error.value, closable: false }),
            h('div', { style: { height: '12px' } }),
            h(ElButton as never, { size: 'small', onClick: download }, () => '下载文件'),
          ])
        }

        if (!token.value) {
          return h('div', { class: 'img-viewer' }, [
            toolbar,
            h('div', { class: 'img-loading' }, '加载图片地址中…'),
          ])
        }

        const transform = fitWindow.value
          ? ''
          : `scale(${scale.value}) rotate(${rotate.value}deg)`

        return h('div', { class: 'img-viewer' }, [
          toolbar,
          h('div', { class: 'img-stage' }, [
            h('img', {
              class: fitWindow.value ? 'img-fit' : 'img-zoom',
              src: api.streamUrl(token.value),
              alt: props.file.name,
              draggable: false,
              style: { transform },
            }),
          ]),
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
.img-viewer { height: 100%; display: flex; flex-direction: column; }
.img-bar { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; }
.img-zoom-info { color: var(--app-text-dim); font-size: 12px; min-width: 70px; text-align: center; }
.img-zoom-slider { width: 160px !important; }
.img-loading { color: var(--app-text-dim); }
.img-stage {
  flex: 1; min-height: 0; overflow: auto; display: flex;
  align-items: flex-start; justify-content: center;
  padding: 12px; border: 1px solid var(--app-border); border-radius: 6px;
}
.img-fit { max-width: 100%; max-height: 100%; object-fit: contain; }
.img-zoom { transform-origin: top left; }
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