/**
 * compress 插件样式注入（fcp- 前缀，颜色只用主题令牌带 fallback）
 */

const STYLE_ID = 'fcp-style'

const CSS = `
.fcp-dialog-body { padding: 4px 0; }
.fcp-sec-title { color: var(--app-text-dim, #888); font-size: 12px; margin: 10px 0 6px; }
.fcp-sel-list {
  max-height: 140px; overflow-y: auto;
  border: 1px solid var(--app-border, #ccc); border-radius: 4px;
  padding: 6px 8px; background: var(--app-accent-bg, transparent);
}
.fcp-sel-item {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  padding: 2px 0; font-size: 13px; color: var(--app-text, #333);
}
.fcp-sel-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.fcp-sel-meta { flex-shrink: 0; color: var(--app-text-dim, #888); font-size: 12px; }
.fcp-out-row { display: flex; align-items: center; gap: 8px; }
.fcp-target { font-size: 12px; color: var(--app-text-dim, #888); margin-top: 6px; word-break: break-all; }
.fcp-status-list { display: flex; flex-direction: column; gap: 4px; margin-top: 6px; max-height: 180px; overflow-y: auto; }
.fcp-status-row {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  font-size: 13px; color: var(--app-text, #333);
  padding: 2px 0;
}
.fcp-status-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fcp-dim { color: var(--app-text-dim, #888); font-size: 12px; }
.fcp-picker-path { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.fcp-picker-list {
  max-height: 320px; overflow-y: auto;
  border: 1px solid var(--app-border, #ccc); border-radius: 4px; padding: 4px;
  background: var(--app-accent-bg, transparent);
}
.fcp-picker-row {
  display: flex; align-items: center; gap: 8px; padding: 6px 8px;
  cursor: pointer; border-radius: 4px; font-size: 13px; color: var(--app-text, #333);
}
.fcp-picker-icon {
  display: flex; align-items: center; flex-shrink: 0;
  color: var(--app-accent, #409eff);
}
.fcp-picker-row:hover { background: var(--app-accent-bg-hover, var(--app-accent-bg, #f0f0f0)); }
.fcp-picker-empty { color: var(--app-text-dim, #888); font-size: 12px; padding: 8px; }
`

export function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = CSS
  document.head.appendChild(style)
}