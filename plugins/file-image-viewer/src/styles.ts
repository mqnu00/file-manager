/**
 * file-image-viewer 样式注入
 */

import { STYLE_ID } from './constants'

const CSS = `
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
/* 缩略图填满 wrap 内容盒（96px - 边框2*2 - 内边距4*2 = 84px），width:100% + aspect-ratio 保持方形，
   避免固定宽高溢出遮住 wrap 的边框（尤其右侧） */
.fiv-thumb {
  width: 100%; aspect-ratio: 1 / 1; object-fit: cover; border-radius: 4px;
  display: block; background: #000; box-sizing: border-box;
}
.fiv-thumb-broken {
  display: flex; align-items: center; justify-content: center;
  color: var(--app-text-dim); background: var(--app-table-header-bg); font-size: 12px;
}
.fiv-thumb-name {
  display: block; max-width: 84px; overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap; font-size: 12px; color: var(--app-text-dim); margin-top: 4px;
}
.fiv-gallery-footer {
  display: flex; justify-content: center; margin-top: 12px;
  padding-top: 10px; border-top: 1px solid var(--app-border);
}
.fiv-gallery-empty { color: var(--app-text-dim); padding: 24px; text-align: center; }
`

/** 注入 <style>（幂等，按 STYLE_ID 防重） */
export function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = CSS
  document.head.appendChild(style)
}
