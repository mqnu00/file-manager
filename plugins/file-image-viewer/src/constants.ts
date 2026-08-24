/**
 * file-image-viewer 常量
 */

/** 支持的图片扩展名（小写、不含点） */
export const IMAGE_EXTENSIONS = [
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
export const ZOOM_STEP = 0.25
/** 滚轮缩放步进 */
export const WHEEL_ZOOM_STEP = 0.1
/** 缩略图图库每页张数 */
export const GALLERY_PAGE_SIZE = 6

/** 注入样式的 <style> 元素 id（防重复注入） */
export const STYLE_ID = 'file-image-viewer-style'
