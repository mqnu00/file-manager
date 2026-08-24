/**
 * 缩略图图库：分页展示当前文件夹图片缩略图（按名称升序，与上一张/下一张同顺序），
 * 点击跳转到对应图片；令牌按 path 缓存、按页懒加载，翻页/开关对话框复用。
 */

import type { FrontendPluginContext, FileItem } from '@mqn00/file-manager/plugin/frontend'
import type { RefLike } from '../types'
import { GALLERY_PAGE_SIZE } from '../constants'
import { paginate, pageOf } from '../navigation'

/** 依赖的最小接口（来自 useFolderNavigation 的返回值） */
export interface GalleryDeps {
  images: RefLike<FileItem[]>
  currentIndex: RefLike<number>
  goTo(target?: FileItem): void
}

export function useGallery(ctx: FrontendPluginContext, props: { file: FileItem }, deps: GalleryDeps) {
  const { h, ref, computed } = ctx.Vue
  const { ElDialog, ElPagination } = ctx.ElementPlus
  const api = ctx.api.fileIO

  const galleryOpen = ref(false)
  const galleryPage = ref(1)
  /** path → 流令牌缓存（避免翻页/开关对话框重复请求） */
  const tokenMap = ref<Record<string, string>>({})
  /** 已确认加载失败的 path（显示占位） */
  const brokenPaths = ref<Set<string>>(new Set())

  const total = computed(() => deps.images.value.length)
  const pageImages = computed(() => paginate(deps.images.value, galleryPage.value, GALLERY_PAGE_SIZE))

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
    galleryPage.value = pageOf(deps.currentIndex.value, GALLERY_PAGE_SIZE)
    galleryOpen.value = true
    void ensureTokens(pageImages.value)
  }
  const onPageChange = (p: number) => {
    galleryPage.value = p
    void ensureTokens(pageImages.value)
  }
  const onPickThumb = (img: FileItem) => {
    galleryOpen.value = false
    deps.goTo(img)
  }

  /** 自包含的图库对话框渲染 */
  const renderDialog = () =>
    h(
      ElDialog,
      {
        modelValue: galleryOpen.value,
        title: `缩略图（共 ${total.value} 张）`,
        width: '720px',
        appendToBody: true,
        'onUpdate:modelValue': (v: boolean) => {
          if (!v) galleryOpen.value = false
        },
      },
      [
        pageImages.value.length === 0
          ? h('div', { class: 'fiv-gallery-empty' }, '文件夹内无图片')
          : h('div', { class: 'fiv-gallery' }, [
              ...pageImages.value.map((img) => {
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
            total: total.value,
            currentPage: galleryPage.value,
            pageSize: GALLERY_PAGE_SIZE,
            onCurrentChange: onPageChange,
          }),
        ]),
      ]
    )

  return {
    open: galleryOpen,
    page: galleryPage,
    tokenMap,
    broken: brokenPaths,
    total,
    pageImages,
    openGallery,
    onPageChange,
    onPickThumb,
    renderDialog,
  }
}
