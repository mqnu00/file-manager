<template>
  <SciFiBackground />
  <router-view />
</template>

<script setup lang="ts">
import SciFiBackground from './components/SciFiBackground.vue'
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif;
  background: #060b1a;
  color: #e0e6f0;
  overflow: hidden;
}

#app {
  width: 100%;
  height: 100vh;
  position: relative;
  z-index: 1;
}

:root {
  --cyber-cyan: #00f0ff;
  --cyber-magenta: #ff00ff;
  --cyber-blue: #3355ff;
  --cyber-dark: #0a0f1e;
  --cyber-panel: rgba(10, 18, 40, 0.35);
  --cyber-panel-solid: rgba(10, 18, 40, 0.6);
  --cyber-border: rgba(0, 240, 255, 0.2);
  --cyber-glow-cyan: 0 0 12px rgba(0, 240, 255, 0.3);
  --cyber-glow-magenta: 0 0 12px rgba(255, 0, 255, 0.3);
  --cyber-text: #e0e8ff;
  --cyber-text-dim: #6a7a99;
  --cyber-text-bright: #f0f4ff;
}

.el-dialog {
  --el-dialog-bg-color: var(--cyber-panel-solid);
  --el-dialog-box-shadow: var(--cyber-glow-cyan), 0 8px 32px rgba(0, 0, 0, 0.4);
  background: var(--cyber-panel-solid) !important;
  border: 1px solid var(--cyber-border) !important;
  border-radius: 12px !important;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.el-dialog__header {
  border-bottom: 1px solid var(--cyber-border) !important;
  padding: 16px 20px !important;
}

.el-dialog__title {
  color: var(--cyber-cyan) !important;
  font-weight: 600 !important;
  text-shadow: 0 0 8px rgba(0, 240, 255, 0.3);
}

.el-dialog__body {
  color: var(--cyber-text) !important;
  padding: 20px !important;
}

.el-dialog__footer {
  border-top: 1px solid var(--cyber-border) !important;
  padding: 12px 20px !important;
}

.el-dialog__headerbtn .el-dialog__close {
  color: var(--cyber-text-dim) !important;
}

.el-dialog__headerbtn .el-dialog__close:hover {
  color: var(--cyber-cyan) !important;
}

.el-button {
  border-radius: 6px !important;
  font-weight: 500 !important;
}

.el-button--default {
  --el-button-bg-color: transparent;
  --el-button-border-color: var(--cyber-border);
  --el-button-text-color: var(--cyber-cyan);
  --el-button-hover-bg-color: rgba(0, 240, 255, 0.08);
  --el-button-hover-border-color: var(--cyber-cyan);
  --el-button-hover-text-color: var(--cyber-cyan);
  background: transparent !important;
  border-color: var(--cyber-border) !important;
  color: var(--cyber-cyan) !important;
}

.el-button--default:hover {
  border-color: var(--cyber-cyan) !important;
  box-shadow: 0 0 10px rgba(0, 240, 255, 0.2);
}

.el-button--primary {
  --el-button-bg-color: rgba(0, 240, 255, 0.15);
  --el-button-border-color: var(--cyber-cyan);
  --el-button-text-color: var(--cyber-cyan);
  --el-button-hover-bg-color: rgba(0, 240, 255, 0.25);
  --el-button-hover-border-color: var(--cyber-cyan);
  background: rgba(0, 240, 255, 0.15) !important;
  border-color: var(--cyber-cyan) !important;
  color: var(--cyber-cyan) !important;
}

.el-button--primary:hover {
  box-shadow: 0 0 16px rgba(0, 240, 255, 0.3);
}

.el-button--success {
  --el-button-bg-color: rgba(0, 255, 100, 0.12);
  --el-button-border-color: rgba(0, 255, 100, 0.4);
  background: rgba(0, 255, 100, 0.12) !important;
  border-color: rgba(0, 255, 100, 0.4) !important;
  color: #00ff64 !important;
}

.el-button--danger {
  --el-button-bg-color: rgba(255, 0, 80, 0.12);
  --el-button-border-color: rgba(255, 0, 80, 0.4);
  background: rgba(255, 0, 80, 0.12) !important;
  border-color: rgba(255, 0, 80, 0.4) !important;
  color: #ff3366 !important;
}

.el-button--danger:hover {
  box-shadow: 0 0 12px rgba(255, 0, 80, 0.25);
}

.el-button--warning {
  --el-button-bg-color: rgba(255, 160, 0, 0.12);
  --el-button-border-color: rgba(255, 160, 0, 0.4);
  background: rgba(255, 160, 0, 0.12) !important;
  border-color: rgba(255, 160, 0, 0.4) !important;
  color: #ffa000 !important;
}

.el-input__wrapper {
  background: rgba(6, 11, 26, 0.5) !important;
  border: 1px solid var(--cyber-border) !important;
  box-shadow: none !important;
  border-radius: 6px !important;
}

.el-input__wrapper:hover {
  border-color: rgba(0, 240, 255, 0.4) !important;
}

.el-input__inner {
  color: var(--cyber-text-bright) !important;
}

.el-input__inner::placeholder {
  color: var(--cyber-text-dim) !important;
}

.el-message {
  background: var(--cyber-panel-solid) !important;
  border: 1px solid var(--cyber-border) !important;
  border-radius: 8px !important;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.el-message--success {
  --el-message-bg-color: rgba(0, 255, 100, 0.1);
  --el-message-border-color: rgba(0, 255, 100, 0.3);
  --el-message-text-color: #00ff64;
}

.el-message--warning {
  --el-message-bg-color: rgba(255, 160, 0, 0.1);
  --el-message-border-color: rgba(255, 160, 0, 0.3);
  --el-message-text-color: #ffa000;
}

.el-message--error {
  --el-message-bg-color: rgba(255, 0, 80, 0.1);
  --el-message-border-color: rgba(255, 0, 80, 0.3);
  --el-message-text-color: #ff3366;
}

.el-message--info {
  --el-message-bg-color: rgba(0, 240, 255, 0.08);
  --el-message-border-color: var(--cyber-border);
  --el-message-text-color: var(--cyber-text);
}

.el-message-box {
  background: var(--cyber-panel-solid) !important;
  border: 1px solid var(--cyber-border) !important;
  border-radius: 12px !important;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.el-message-box__title {
  color: var(--cyber-cyan) !important;
}

.el-message-box__message {
  color: var(--cyber-text) !important;
}

.el-message-box__headerbtn .el-message-box__close {
  color: var(--cyber-text-dim) !important;
}

.el-progress-bar__outer {
  background: rgba(0, 240, 255, 0.06) !important;
  border-radius: 4px !important;
}

.el-progress-bar__inner {
  background: linear-gradient(90deg, var(--cyber-cyan), var(--cyber-blue)) !important;
  border-radius: 4px !important;
  box-shadow: 0 0 8px rgba(0, 240, 255, 0.4);
}

.el-tree {
  background: transparent !important;
  color: var(--cyber-text) !important;
}

.el-tree-node__content:hover {
  background: rgba(0, 240, 255, 0.06) !important;
}

.el-tree-node.is-current > .el-tree-node__content {
  background: rgba(0, 240, 255, 0.1) !important;
  color: var(--cyber-cyan) !important;
}

.el-tree-node__expand-icon {
  color: var(--cyber-text-dim) !important;
}

.el-tree-node__expand-icon.is-leaf {
  color: transparent !important;
}

.el-select-dropdown {
  background: var(--cyber-panel-solid) !important;
  border: 1px solid var(--cyber-border) !important;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.el-select-dropdown__item {
  color: var(--cyber-text) !important;
}

.el-select-dropdown__item.hover,
.el-select-dropdown__item:hover {
  background: rgba(0, 240, 255, 0.08) !important;
  color: var(--cyber-cyan) !important;
}

.el-select-dropdown__item.selected {
  color: var(--cyber-cyan) !important;
  font-weight: 600;
}

.el-loading-spinner .circular {
  color: var(--cyber-cyan) !important;
}

.el-loading-spinner .el-loading-text {
  color: var(--cyber-text) !important;
}

::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: rgba(6, 11, 26, 0.5);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb {
  background: rgba(0, 240, 255, 0.25);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 240, 255, 0.4);
}
</style>
