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
  font-family:
    'Segoe UI',
    -apple-system,
    BlinkMacSystemFont,
    'Helvetica Neue',
    Arial,
    sans-serif;
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
  --app-panel: #fff;
  --app-panel-solid: #fff;
  --app-border: #e4e7ed;
  --app-shadow: 0 2px 8px rgb(0 0 0 / 6%);
  --app-glow: none;
  --app-text: #606266;
  --app-text-dim: #909399;
  --app-text-bright: #303133;
  --app-accent: #409eff;
  --app-accent-bg: rgb(64 158 255 / 4%);
  --app-accent-bg-hover: rgb(64 158 255 / 8%);
  --app-accent-bg-subtle: rgb(64 158 255 / 4%);
  --app-accent-border: rgb(64 158 255 / 20%);
  --app-accent-border-light: rgb(64 158 255 / 15%);
  --app-input-bg: #fff;
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
  --app-mask-bg: rgb(255 255 255 / 70%);
  --app-select-caret: #c0c4cc;
  --app-scrollbar-width: 6px;
  --app-scrollbar-track: transparent;
  --app-scrollbar-thumb: #c0c4cc;
  --app-scrollbar-thumb-hover: #909399;
}

html.cyber {
  --app-bg: #060b1a;
  --app-panel: rgb(10 18 40 / 35%);
  --app-panel-solid: rgb(10 18 40 / 60%);
  --app-border: rgb(0 240 255 / 20%);
  --app-shadow: none;
  --app-glow: 0 0 12px rgb(0 240 255 / 30%);
  --app-text: #e0e8ff;
  --app-text-dim: #6a7a99;
  --app-text-bright: #f0f4ff;
  --app-accent: #00f0ff;
  --app-accent-bg: rgb(0 240 255 / 6%);
  --app-accent-bg-hover: rgb(0 240 255 / 8%);
  --app-accent-bg-subtle: rgb(0 240 255 / 6%);
  --app-accent-border: rgb(0 240 255 / 20%);
  --app-accent-border-light: rgb(0 240 255 / 15%);
  --app-input-bg: rgb(6 11 26 / 50%);
  --app-table-header-bg: rgb(0 240 255 / 6%);
  --app-table-header-border: rgb(0 240 255 / 20%);
  --app-table-row-hover: rgb(0 240 255 / 6%);
  --app-table-cell-border: rgb(0 240 255 / 6%);
  --app-blur: blur(6px);
  --app-text-shadow: 0 0 6px rgb(0 240 255 / 40%);
  --app-text-glow: 0 0 4px rgb(0 240 255 / 30%);
  --app-text-glow-hover: 0 0 10px rgb(0 240 255 / 60%);
  --app-checkbox-border: rgb(0 240 255 / 30%);
  --app-checkbox-shadow: 0 0 6px rgb(0 240 255 / 50%);
  --app-mask-bg: rgb(6 11 26 / 70%);
  --app-select-caret: #00f0ff;
  --app-scrollbar-width: 6px;
  --app-scrollbar-track: rgb(6 11 26 / 50%);
  --app-scrollbar-thumb: rgb(0 240 255 / 25%);
  --app-scrollbar-thumb-hover: rgb(0 240 255 / 40%);
}

html.cyber .el-dialog {
  --el-dialog-bg-color: var(--app-panel-solid);
  --el-dialog-box-shadow: var(--app-glow), 0 8px 32px rgb(0 0 0 / 40%);

  background: var(--app-panel-solid) !important;
  border: 1px solid var(--app-border) !important;
  border-radius: 12px !important;
  backdrop-filter: blur(8px);
}

html.cyber .el-dialog__header {
  border-bottom: 1px solid var(--app-border) !important;
  padding: 16px 20px !important;
}

html.cyber .el-dialog__title {
  color: var(--app-accent) !important;
  font-weight: 600 !important;
  text-shadow: 0 0 8px rgb(0 240 255 / 30%);
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
  --el-button-hover-bg-color: rgb(0 240 255 / 8%);
  --el-button-hover-border-color: var(--app-accent);
  --el-button-hover-text-color: var(--app-accent);

  background: transparent !important;
  border-color: var(--app-border) !important;
  color: var(--app-accent) !important;
}

html.cyber .el-button--default:hover {
  border-color: var(--app-accent) !important;
  box-shadow: 0 0 10px rgb(0 240 255 / 20%);
}

html.cyber .el-button--primary {
  --el-button-bg-color: rgb(0 240 255 / 15%);
  --el-button-border-color: var(--app-accent);
  --el-button-text-color: var(--app-accent);
  --el-button-hover-bg-color: rgb(0 240 255 / 25%);
  --el-button-hover-border-color: var(--app-accent);

  background: rgb(0 240 255 / 15%) !important;
  border-color: var(--app-accent) !important;
  color: var(--app-accent) !important;
}

html.cyber .el-button--primary:hover {
  box-shadow: 0 0 16px rgb(0 240 255 / 30%);
}

html.cyber .el-button--success {
  --el-button-bg-color: rgb(0 255 100 / 12%);
  --el-button-border-color: rgb(0 255 100 / 40%);

  background: rgb(0 255 100 / 12%) !important;
  border-color: rgb(0 255 100 / 40%) !important;
  color: #00ff64 !important;
}

html.cyber .el-button--danger {
  --el-button-bg-color: rgb(255 0 80 / 12%);
  --el-button-border-color: rgb(255 0 80 / 40%);

  background: rgb(255 0 80 / 12%) !important;
  border-color: rgb(255 0 80 / 40%) !important;
  color: #f36 !important;
}

html.cyber .el-button--danger:hover {
  box-shadow: 0 0 12px rgb(255 0 80 / 25%);
}

html.cyber .el-button--warning {
  --el-button-bg-color: rgb(255 160 0 / 12%);
  --el-button-border-color: rgb(255 160 0 / 40%);

  background: rgb(255 160 0 / 12%) !important;
  border-color: rgb(255 160 0 / 40%) !important;
  color: #ffa000 !important;
}

html.cyber .el-input__wrapper {
  background: var(--app-input-bg) !important;
  border: 1px solid var(--app-border) !important;
  box-shadow: none !important;
  border-radius: 6px !important;
}

html.cyber .el-input__wrapper:hover {
  border-color: rgb(0 240 255 / 40%) !important;
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
}

html.cyber .el-message--success {
  --el-message-bg-color: rgb(0 255 100 / 10%);
  --el-message-border-color: rgb(0 255 100 / 30%);
  --el-message-text-color: #00ff64;
}

html.cyber .el-message--warning {
  --el-message-bg-color: rgb(255 160 0 / 10%);
  --el-message-border-color: rgb(255 160 0 / 30%);
  --el-message-text-color: #ffa000;
}

html.cyber .el-message--error {
  --el-message-bg-color: rgb(255 0 80 / 10%);
  --el-message-border-color: rgb(255 0 80 / 30%);
  --el-message-text-color: #f36;
}

html.cyber .el-message--info {
  --el-message-bg-color: rgb(0 240 255 / 8%);
  --el-message-border-color: var(--app-border);
  --el-message-text-color: var(--app-text);
}

html.cyber .el-message-box {
  background: var(--app-panel-solid) !important;
  border: 1px solid var(--app-border) !important;
  border-radius: 12px !important;
  backdrop-filter: blur(8px);
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
  background: rgb(0 240 255 / 6%) !important;
  border-radius: 4px !important;
}

html.cyber .el-progress-bar__inner {
  background: linear-gradient(90deg, var(--app-accent), #35f) !important;
  border-radius: 4px !important;
  box-shadow: 0 0 8px rgb(0 240 255 / 40%);
}

html.cyber .el-tree {
  background: transparent !important;
  color: var(--app-text) !important;
}

html.cyber .el-tree-node__content:hover {
  background: var(--app-accent-bg-hover) !important;
}

html.cyber .el-tree-node.is-current > .el-tree-node__content {
  background: rgb(0 240 255 / 10%) !important;
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
  background: rgb(6 11 26 / 50%);
  border-radius: 3px;
}

html.cyber ::-webkit-scrollbar-thumb {
  background: rgb(0 240 255 / 25%);
  border-radius: 3px;
}

html.cyber ::-webkit-scrollbar-thumb:hover {
  background: rgb(0 240 255 / 40%);
}
</style>
