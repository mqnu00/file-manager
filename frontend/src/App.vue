<template>
  <SciFiBackground v-if="isCyber" />
  <router-view />
</template>

<script setup lang="ts">
import SciFiBackground from './components/SciFiBackground.vue'
import { useTheme } from './composables/useTheme'

const { isCyber } = useTheme()
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif;
  background: var(--app-bg);
  color: var(--app-text);
  overflow: hidden;
}

#app {
  width: 100%;
  height: 100vh;
  position: relative;
  z-index: 1;
}

:root {
  --app-bg: #f5f7fa;
  --app-panel: #ffffff;
  --app-panel-solid: #ffffff;
  --app-border: #e4e7ed;
  --app-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  --app-glow: none;
  --app-text: #606266;
  --app-text-dim: #909399;
  --app-text-bright: #303133;
  --app-accent: #409eff;
  --app-accent-bg: rgba(64, 158, 255, 0.04);
  --app-accent-bg-hover: rgba(64, 158, 255, 0.08);
  --app-accent-bg-subtle: rgba(64, 158, 255, 0.04);
  --app-accent-border: rgba(64, 158, 255, 0.2);
  --app-accent-border-light: rgba(64, 158, 255, 0.15);
  --app-input-bg: #ffffff;
  --app-table-header-bg: #f5f7fa;
  --app-table-header-border: #ebeef5;
  --app-table-row-hover: #f5f7fa;
  --app-table-cell-border: #ebeef5;
  --app-blur: none;
  --app-text-shadow: none;
  --app-text-glow: none;
  --app-text-glow-hover: none;
  --app-checkbox-border: #dcdfe6;
  --app-checkbox-shadow: none;
  --app-mask-bg: rgba(255, 255, 255, 0.7);
  --app-select-caret: #c0c4cc;
  --app-scrollbar-width: 6px;
  --app-scrollbar-track: transparent;
  --app-scrollbar-thumb: #c0c4cc;
  --app-scrollbar-thumb-hover: #909399;
}

html.cyber {
  --app-bg: #060b1a;
  --app-panel: rgba(10, 18, 40, 0.35);
  --app-panel-solid: rgba(10, 18, 40, 0.6);
  --app-border: rgba(0, 240, 255, 0.2);
  --app-shadow: none;
  --app-glow: 0 0 12px rgba(0, 240, 255, 0.3);
  --app-text: #e0e8ff;
  --app-text-dim: #6a7a99;
  --app-text-bright: #f0f4ff;
  --app-accent: #00f0ff;
  --app-accent-bg: rgba(0, 240, 255, 0.06);
  --app-accent-bg-hover: rgba(0, 240, 255, 0.08);
  --app-accent-bg-subtle: rgba(0, 240, 255, 0.06);
  --app-accent-border: rgba(0, 240, 255, 0.2);
  --app-accent-border-light: rgba(0, 240, 255, 0.15);
  --app-input-bg: rgba(6, 11, 26, 0.5);
  --app-table-header-bg: rgba(0, 240, 255, 0.06);
  --app-table-header-border: rgba(0, 240, 255, 0.2);
  --app-table-row-hover: rgba(0, 240, 255, 0.06);
  --app-table-cell-border: rgba(0, 240, 255, 0.06);
  --app-blur: blur(6px);
  --app-text-shadow: 0 0 6px rgba(0, 240, 255, 0.4);
  --app-text-glow: 0 0 4px rgba(0, 240, 255, 0.3);
  --app-text-glow-hover: 0 0 10px rgba(0, 240, 255, 0.6);
  --app-checkbox-border: rgba(0, 240, 255, 0.3);
  --app-checkbox-shadow: 0 0 6px rgba(0, 240, 255, 0.5);
  --app-mask-bg: rgba(6, 11, 26, 0.7);
  --app-select-caret: #00f0ff;
  --app-scrollbar-width: 6px;
  --app-scrollbar-track: rgba(6, 11, 26, 0.5);
  --app-scrollbar-thumb: rgba(0, 240, 255, 0.25);
  --app-scrollbar-thumb-hover: rgba(0, 240, 255, 0.4);
}

html.cyber .el-dialog {
  --el-dialog-bg-color: var(--app-panel-solid);
  --el-dialog-box-shadow: var(--app-glow), 0 8px 32px rgba(0, 0, 0, 0.4);
  background: var(--app-panel-solid) !important;
  border: 1px solid var(--app-border) !important;
  border-radius: 12px !important;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

html.cyber .el-dialog__header {
  border-bottom: 1px solid var(--app-border) !important;
  padding: 16px 20px !important;
}

html.cyber .el-dialog__title {
  color: var(--app-accent) !important;
  font-weight: 600 !important;
  text-shadow: 0 0 8px rgba(0, 240, 255, 0.3);
}

html.cyber .el-dialog__body {
  color: var(--app-text) !important;
  padding: 20px !important;
}

html.cyber .el-dialog__footer {
  border-top: 1px solid var(--app-border) !important;
  padding: 12px 20px !important;
}

html.cyber .el-dialog__headerbtn .el-dialog__close {
  color: var(--app-text-dim) !important;
}

html.cyber .el-dialog__headerbtn .el-dialog__close:hover {
  color: var(--app-accent) !important;
}

html.cyber .el-button {
  border-radius: 6px !important;
  font-weight: 500 !important;
}

html.cyber .el-button--default {
  --el-button-bg-color: transparent;
  --el-button-border-color: var(--app-border);
  --el-button-text-color: var(--app-accent);
  --el-button-hover-bg-color: rgba(0, 240, 255, 0.08);
  --el-button-hover-border-color: var(--app-accent);
  --el-button-hover-text-color: var(--app-accent);
  background: transparent !important;
  border-color: var(--app-border) !important;
  color: var(--app-accent) !important;
}

html.cyber .el-button--default:hover {
  border-color: var(--app-accent) !important;
  box-shadow: 0 0 10px rgba(0, 240, 255, 0.2);
}

html.cyber .el-button--primary {
  --el-button-bg-color: rgba(0, 240, 255, 0.15);
  --el-button-border-color: var(--app-accent);
  --el-button-text-color: var(--app-accent);
  --el-button-hover-bg-color: rgba(0, 240, 255, 0.25);
  --el-button-hover-border-color: var(--app-accent);
  background: rgba(0, 240, 255, 0.15) !important;
  border-color: var(--app-accent) !important;
  color: var(--app-accent) !important;
}

html.cyber .el-button--primary:hover {
  box-shadow: 0 0 16px rgba(0, 240, 255, 0.3);
}

html.cyber .el-button--success {
  --el-button-bg-color: rgba(0, 255, 100, 0.12);
  --el-button-border-color: rgba(0, 255, 100, 0.4);
  background: rgba(0, 255, 100, 0.12) !important;
  border-color: rgba(0, 255, 100, 0.4) !important;
  color: #00ff64 !important;
}

html.cyber .el-button--danger {
  --el-button-bg-color: rgba(255, 0, 80, 0.12);
  --el-button-border-color: rgba(255, 0, 80, 0.4);
  background: rgba(255, 0, 80, 0.12) !important;
  border-color: rgba(255, 0, 80, 0.4) !important;
  color: #ff3366 !important;
}

html.cyber .el-button--danger:hover {
  box-shadow: 0 0 12px rgba(255, 0, 80, 0.25);
}

html.cyber .el-button--warning {
  --el-button-bg-color: rgba(255, 160, 0, 0.12);
  --el-button-border-color: rgba(255, 160, 0, 0.4);
  background: rgba(255, 160, 0, 0.12) !important;
  border-color: rgba(255, 160, 0, 0.4) !important;
  color: #ffa000 !important;
}

html.cyber .el-input__wrapper {
  background: var(--app-input-bg) !important;
  border: 1px solid var(--app-border) !important;
  box-shadow: none !important;
  border-radius: 6px !important;
}

html.cyber .el-input__wrapper:hover {
  border-color: rgba(0, 240, 255, 0.4) !important;
}

html.cyber .el-input__inner {
  color: var(--app-text-bright) !important;
}

html.cyber .el-input__inner::placeholder {
  color: var(--app-text-dim) !important;
}

html.cyber .el-message {
  background: var(--app-panel-solid) !important;
  border: 1px solid var(--app-border) !important;
  border-radius: 8px !important;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

html.cyber .el-message--success {
  --el-message-bg-color: rgba(0, 255, 100, 0.1);
  --el-message-border-color: rgba(0, 255, 100, 0.3);
  --el-message-text-color: #00ff64;
}

html.cyber .el-message--warning {
  --el-message-bg-color: rgba(255, 160, 0, 0.1);
  --el-message-border-color: rgba(255, 160, 0, 0.3);
  --el-message-text-color: #ffa000;
}

html.cyber .el-message--error {
  --el-message-bg-color: rgba(255, 0, 80, 0.1);
  --el-message-border-color: rgba(255, 0, 80, 0.3);
  --el-message-text-color: #ff3366;
}

html.cyber .el-message--info {
  --el-message-bg-color: rgba(0, 240, 255, 0.08);
  --el-message-border-color: var(--app-border);
  --el-message-text-color: var(--app-text);
}

html.cyber .el-message-box {
  background: var(--app-panel-solid) !important;
  border: 1px solid var(--app-border) !important;
  border-radius: 12px !important;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

html.cyber .el-message-box__title {
  color: var(--app-accent) !important;
}

html.cyber .el-message-box__message {
  color: var(--app-text) !important;
}

html.cyber .el-message-box__headerbtn .el-message-box__close {
  color: var(--app-text-dim) !important;
}

html.cyber .el-progress-bar__outer {
  background: rgba(0, 240, 255, 0.06) !important;
  border-radius: 4px !important;
}

html.cyber .el-progress-bar__inner {
  background: linear-gradient(90deg, var(--app-accent), #3355ff) !important;
  border-radius: 4px !important;
  box-shadow: 0 0 8px rgba(0, 240, 255, 0.4);
}

html.cyber .el-tree {
  background: transparent !important;
  color: var(--app-text) !important;
}

html.cyber .el-tree-node__content:hover {
  background: var(--app-accent-bg-hover) !important;
}

html.cyber .el-tree-node.is-current > .el-tree-node__content {
  background: rgba(0, 240, 255, 0.1) !important;
  color: var(--app-accent) !important;
}

html.cyber .el-tree-node__expand-icon {
  color: var(--app-text-dim) !important;
}

html.cyber .el-tree-node__expand-icon.is-leaf {
  color: transparent !important;
}

html.cyber .el-select-dropdown {
  background: var(--app-panel-solid) !important;
  border: 1px solid var(--app-border) !important;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

html.cyber .el-select-dropdown__item {
  color: var(--app-text) !important;
}

html.cyber .el-select-dropdown__item.hover,
html.cyber .el-select-dropdown__item:hover {
  background: var(--app-accent-bg-hover) !important;
  color: var(--app-accent) !important;
}

html.cyber .el-select-dropdown__item.selected {
  color: var(--app-accent) !important;
  font-weight: 600;
}

html.cyber .el-loading-spinner .circular {
  color: var(--app-accent) !important;
}

html.cyber .el-loading-spinner .el-loading-text {
  color: var(--app-text) !important;
}

html.cyber ::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

html.cyber ::-webkit-scrollbar-track {
  background: rgba(6, 11, 26, 0.5);
  border-radius: 3px;
}

html.cyber ::-webkit-scrollbar-thumb {
  background: rgba(0, 240, 255, 0.25);
  border-radius: 3px;
}

html.cyber ::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 240, 255, 0.4);
}
</style>