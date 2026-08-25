/**
 * system-info 插件样式注入（fci- 前缀，颜色只用主题令牌带 fallback）
 */

const STYLE_ID = 'fci-style'

const CSS = `
.fci-container {
  height: 100vh;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 40px;
  overflow-y: auto;
}
.fci-card {
  width: 800px;
  background: var(--app-panel);
  border: 1px solid var(--app-border);
  border-radius: 12px;
  box-shadow: var(--app-glow), var(--app-shadow);
  backdrop-filter: var(--app-blur);
  margin-bottom: 40px;
}
.fci-title {
  margin: 0;
  font-size: 20px;
  color: var(--app-text-bright);
}
.fci-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}
.fci-back {
  color: var(--app-text-dim);
  padding: 4px 8px;
}
.fci-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}
.fci-info-card {
  background: var(--app-accent-bg) !important;
  border: 1px solid var(--app-accent-border) !important;
}
.fci-info-card .el-card__header {
  padding: 12px 16px !important;
  border-bottom: 1px solid var(--app-accent-border) !important;
}
.fci-info-card .el-card__body {
  padding: 16px !important;
}
.fci-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: var(--app-accent);
}
.fci-disk-select {
  margin-left: auto;
  width: 200px;
}
.fci-disk-select .el-input__wrapper {
  background: var(--app-accent-bg) !important;
  border: 1px solid var(--app-accent-border) !important;
  box-shadow: none !important;
}
.fci-disk-select .el-input__inner {
  color: var(--app-text-bright) !important;
}
.fci-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.fci-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.fci-label {
  color: var(--app-text-dim);
  font-size: 13px;
}
.fci-value {
  color: var(--app-text-bright);
  font-size: 13px;
  text-align: right;
  word-break: break-all;
}
.fci-version {
  max-width: 250px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.fci-disk-progress {
  flex-direction: column;
  align-items: stretch;
  gap: 4px;
}
.fci-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--app-text-dim);
  gap: 16px;
}
.fci-state p { margin: 0; }
`

export function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = CSS
  document.head.appendChild(style)
}