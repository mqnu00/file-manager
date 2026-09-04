# Changelog

## 0.1.2 (2026-09-04)

### 🐛 Bug 修复

- **修复查看页打开方式切换下拉框丢失**：commit 94973a0 重构为服务化架构时删除了包含 ElSelect 下拉的 `page.ts`，导致各子插件的 `createViewerPage` 仅包含返回按钮和文件名，丢失了查看器切换能力。新建 `viewer-page-shell.ts` 共享查看页外壳，包含返回按钮、文件信息、ElSelect 下拉（列出全部已注册查看器）、子查看器组件渲染；7 个子插件优先使用全局 shell，降级兜底