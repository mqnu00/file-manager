/**
 * file-image-viewer：图片查看（缩放/旋转/适应窗口 + 文件夹内上一张/下一张切换 +
 * 缩略图图库：按名称排序分页展示缩略图并点击跳转）
 *
 * 本文件为薄编排层：组合各 composable（useSource/useViewControls/useFolderNavigation/
 * useGallery）得到 ViewerVM，再交给纯展示层 render/view.ts 渲染。
 * 平台 I/O：POST /api/files/token 换 30 分钟流令牌 → GET /api/files/stream（Range）→ <img src>。
 */

import type {
  FrontendPluginContext,
  FrontendPluginInstallFunction,
  FileItem,
} from '@mqn00/file-manager/plugin/frontend'
import { getRegistry, type FileViewerModule } from './registry'
import { injectStyles } from './styles'
import { IMAGE_EXTENSIONS, STYLE_ID } from './constants'
import type { ViewerVM } from './types'
import { renderViewer } from './render/view'
import { useSource } from './composables/useSource'
import { useViewControls } from './composables/useViewControls'
import { useFolderNavigation } from './composables/useFolderNavigation'
import { useGallery } from './composables/useGallery'

function createImageViewer(ctx: FrontendPluginContext) {
  const { defineComponent, onMounted, onBeforeUnmount, watch } = ctx.Vue
  const { ElMessage } = ctx.ElementPlus

  return defineComponent({
    name: 'FileImageViewer',
    props: {
      file: { type: Object, required: true },
    },
    setup(props: { file: FileItem }) {
      const source = useSource(ctx, props)
      const view = useViewControls(ctx)
      const nav = useFolderNavigation(ctx, props)
      const gallery = useGallery(ctx, props, {
        images: nav.images,
        currentIndex: nav.currentIndex,
        goTo: nav.goTo,
      })

      // ─── 事件回调（供 render 层绑定） ───
      const download = async () => {
        try {
          const resp = await ctx.api.instance.get(
            `/files/download/${encodeURIComponent(props.file.path)}`,
            { responseType: 'blob' }
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

      const vm: ViewerVM = {
        file: props.file,
        source,
        view,
        nav: { images: nav.images, currentIndex: nav.currentIndex, canPrev: nav.canPrev, canNext: nav.canNext },
        gallery,
        handlers: {
          goPrev: nav.goPrev,
          goNext: nav.goNext,
          openGallery: gallery.openGallery,
          download,
          onImageError: () => {
            source.error.value = '图片加载失败：该文件可能不是有效的图片'
          },
        },
      }

      // ─── 键盘 ←/→ 切换（忽略修饰键组合，避免与全局快捷键冲突） ───
      const onKeydown = (e: KeyboardEvent) => {
        if (e.metaKey || e.ctrlKey || e.altKey) return
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          nav.goPrev()
        } else if (e.key === 'ArrowRight') {
          e.preventDefault()
          nav.goNext()
        }
      }

      onMounted(() => {
        document.addEventListener('keydown', onKeydown)
        view.reset()
        void source.load()
        void nav.load()
      })
      watch(() => props.file.path, () => {
        view.reset()
        void source.load()
        void nav.load()
      })
      onBeforeUnmount(() => {
        document.removeEventListener('keydown', onKeydown)
      })

      return () => [
        renderViewer(ctx, vm),
        gallery.open.value ? gallery.renderDialog() : null,
      ]
    },
  })
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
  const unregister = registry.register(module)

  console.log('[file-image-viewer] 前端已加载：图片模块已注册')

  // teardown 契约：卸载/重载时注销查看器模块并移除注入样式
  return () => {
    unregister()
    document.getElementById(STYLE_ID)?.remove()
  }
}
