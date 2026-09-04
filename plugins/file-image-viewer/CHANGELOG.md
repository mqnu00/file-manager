# Changelog

## 0.2.1 (2026-09-04)

### 🐛 Bug 修复

- **修复上一张/下一张跳转路径错误**：`makeViewerUrl` 函数硬编码生成 `/plugin/file-viewer/view` 路径，但实际注册的路由是 `/plugin/image/view`，导致点击上一张/下一张时跳转失败。修改 `navigation.ts` 返回正确路径，同步更新测试用例