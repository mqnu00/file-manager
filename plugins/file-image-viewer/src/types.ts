/**
 * file-image-viewer 共享类型
 *
 * render 层与各 composable 之间通过「视图模型」解耦：组件把各 composable 返回的
 * ref/computed/方法聚合为一个 ViewerVM 传入纯展示函数，避免大量散参数。
 */

import type { FileItem } from '@mqn00/file-manager/plugin/frontend'
import type { ImageMetadata } from './metadata'

/** 最小 ref 结构（避免插件直接依赖 vue 的类型包，运行期仍为 Vue ref） */
export type RefLike<T> = { value: T }
export type ComputedLike<T> = { value: T }

/** 组件最终聚合给 render 层的视图模型 */
export interface ViewerVM {
  /** 当前图片 */
  file: FileItem
  /** 源加载（token/错误/元数据） */
  source: {
    token: RefLike<string>
    error: RefLike<string>
    meta: RefLike<ImageMetadata>
  }
  /** 视图控制（缩放/旋转/平移/适应/舞台） */
  view: {
    scale: RefLike<number>
    rotate: RefLike<number>
    offsetX: RefLike<number>
    offsetY: RefLike<number>
    fitScale: RefLike<number>
    naturalW: RefLike<number>
    naturalH: RefLike<number>
    reset(): void
    applyZoom(delta: number): void
    fitToWindow(): void
    isFitActive(): boolean
    getTransformStyle(): string
    setupStageRef(el: unknown): void
    onImgLoad(e: Event): void
  }
  /** 文件夹导航 */
  nav: {
    images: RefLike<FileItem[]>
    currentIndex: RefLike<number>
    canPrev: ComputedLike<boolean>
    canNext: ComputedLike<boolean>
  }
  /** 缩略图图库（含自包含的对话框渲染） */
  gallery: {
    open: RefLike<boolean>
    page: RefLike<number>
    tokenMap: RefLike<Record<string, string>>
    broken: RefLike<Set<string>>
    total: ComputedLike<number>
    pageImages: ComputedLike<FileItem[]>
    onPageChange(p: number): void
    onPickThumb(img: FileItem): void
    renderDialog(): unknown
  }
  /** 事件回调（供 render 绑定） */
  handlers: {
    goPrev(): void
    goNext(): void
    openGallery(): void
    download(): void
    onImageError(): void
  }
}
