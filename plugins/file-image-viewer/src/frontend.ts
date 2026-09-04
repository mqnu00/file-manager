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
import { injectStyles } from './styles'
import { STYLE_ID } from './constants'
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

/** 查看页外壳：优先使用 file-viewer 共享外壳（含查看器切换下拉），否则降级为简易外壳 */
function resolveViewerPage(ctx: FrontendPluginContext, component: unknown) {
  const shellFactory = (window as unknown as Record<string, unknown>).__fm_create_viewer_page_shell as
    | ((ctx: FrontendPluginContext, component: unknown, name?: string) => unknown)
    | undefined
  if (shellFactory) {
    return shellFactory(ctx, component, 'ImageViewerPage')
  }
  const { h, computed, defineComponent } = ctx.Vue as unknown as {
    h: (...args: unknown[]) => unknown
    computed: <T>(fn: () => T) => { value: T }
    defineComponent: (opts: { name: string; setup: () => () => unknown }) => unknown
  }
  const { ElButton } = ctx.ElementPlus as unknown as { ElButton: unknown }
  const basename = (p: string) => p.split('/').pop() || p

  return defineComponent({
    name: 'ImageViewerPage',
    setup() {
      const route = ctx.router.currentRoute
      const file = computed(() => {
        const p = typeof route.value.query.path === 'string' ? route.value.query.path : ''
        if (!p) return null
        const existing = ctx.stores.file.files.find((f: FileItem) => f.path === p)
        return existing ?? ({ name: basename(p), path: p, isDirectory: false, size: 0, modified: '' } as FileItem)
      })
      return () => {
        if (!file.value) {
          return h('div', { style: { padding: '48px', textAlign: 'center', color: 'var(--app-text-dim)' } }, '未指定文件')
        }
        return h('div', { style: { height: '100%', display: 'flex', flexDirection: 'column', padding: '16px 20px', boxSizing: 'border-box' } }, [
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' } }, [
            h(ElButton as never, { text: true, onClick: () => window.history.back() }, () => '← 返回'),
            h('span', { style: { fontWeight: 600, color: 'var(--app-text-bright)' } }, file.value!.name),
            h('span', { style: { color: 'var(--app-text-dim)', fontSize: '12px', marginLeft: '8px' } }, file.value!.path),
          ]),
          h('div', { style: { flex: 1, minHeight: 0, overflow: 'auto' } }, [
            h(component as never, { file: file.value }),
          ]),
        ])
      }
    },
  })
}

export const install: FrontendPluginInstallFunction = (ctx) => {
  injectStyles()
  const imageComponent = createImageViewer(ctx)
  const viewerPage = resolveViewerPage(ctx, imageComponent)

  ctx.router.addRoute({
    path: '/plugin/image/view',
    component: viewerPage as never,
    meta: { requiresAuth: true },
  })

  console.log('[file-image-viewer] 前端已加载：查看页路由 /plugin/image/view 已注册')

  // teardown 契约：卸载/重载时移除注入样式（路由清理由平台负责）
  return () => {
    document.getElementById(STYLE_ID)?.remove()
  }
}
