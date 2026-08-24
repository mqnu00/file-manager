/**
 * 文件夹导航：识别当前文件夹图片（按名称升序）、定位当前位置，并提供
 * 上一张/下一张（SPA 改写查看页 URL，由 file-viewer 查看页壳重渲染）。
 */

import type { FrontendPluginContext, FileItem } from '@mqn00/file-manager/plugin/frontend'
import { IMAGE_EXTENSIONS } from '../constants'
import { parentOf, buildImageList, sortByName, currentIndex, makeViewerUrl } from '../navigation'

export function useFolderNavigation(ctx: FrontendPluginContext, props: { file: FileItem }) {
  const { ref, computed } = ctx.Vue

  const images = ref<FileItem[]>([])
  const currentIndex_ = ref(-1)

  /** 拉取当前文件夹图片列表并按名称排列、定位当前位置；失败置空 */
  const load = async () => {
    const parent = parentOf(props.file.path)
    try {
      // 直接走 HTTP 列表接口（ctx.api.file 的声明与运行时方法存在历史偏差，避免依赖其方法名）
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

  return { images, currentIndex: currentIndex_, load, goTo, goPrev, goNext, canPrev, canNext }
}
