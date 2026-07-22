import { createApp } from 'vue'
import * as Vue from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import * as ElementPlusAll from 'element-plus'
import App from './App.vue'
import router from './router'
import { ctx } from './context'
import { initScriptRunner } from './scriptRunner'
import { initPlugins } from './pluginLoader'
import 'element-plus/dist/index.css'

function exposeToGlobal() {
  if (typeof window === 'undefined') return

  try {
    // 暴露 Vue
    window.Vue = Vue

    // 暴露 ElementPlus 所有内容（包括组件和函数）
    window.ElementPlus = ElementPlusAll

    // 将 ElementPlus 的所有属性和方法复制到 window 上
    // 这样可以直接使用 ElMessage、ElButton 等
    Object.keys(ElementPlusAll).forEach((key) => {
      // 跳过一些特殊属性
      if (key !== 'default' && key !== '__esModule') {
        ;(window as any)[key] = (ElementPlusAll as any)[key]
      }
    })

    console.log('✅ 所有 Element Plus 组件已暴露')
    console.log(
      '📦 可用组件数量:',
      Object.keys(ElementPlusAll).filter((k) => k.startsWith('El')).length,
    )
    console.log('💡 使用示例: ElMessage.success("Hello")')
  } catch (error) {
    console.warn('暴露失败:', error)
  }
}

// 创建应用
const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(ElementPlus)

app.mount('#app')

// 暴露到全局
exposeToGlobal()

// 初始化脚本运行器（控制台 __runScript()）
initScriptRunner(ctx)

// 初始化插件系统
initPlugins().then(() => {
  console.log('[Plugin] All plugins initialized')
})
