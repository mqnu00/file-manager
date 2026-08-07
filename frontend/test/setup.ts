/**
 * 前端组件测试全局 setup：
 * - 全局挂载 Element Plus（组件测试无需逐个配置）
 * - 补齐 jsdom 缺失的浏览器 API（ResizeObserver / matchMedia）
 */
import { config } from '@vue/test-utils'
import ElementPlus from 'element-plus'

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
}

// jsdom 无真实布局，el-table 的 height="100%" 会因高度为 0 而不渲染行。
// mock getBoundingClientRect 返回固定尺寸，保证表格渲染完整内容
Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
  configurable: true,
  value() {
    return {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 800,
      bottom: 600,
      width: 800,
      height: 600,
      toJSON: () => ({}),
    }
  },
})

if (typeof globalThis.matchMedia === 'undefined') {
  globalThis.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof globalThis.matchMedia
}

config.global.plugins = [ElementPlus]
