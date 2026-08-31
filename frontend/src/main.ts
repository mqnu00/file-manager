import { createApp } from 'vue'
import * as Vue from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import * as ElementPlusAll from 'element-plus'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import App from './App.vue'
import router from './router'
import { ctx } from './context'
import { initScriptRunner } from './scriptRunner'
import { initPlugins } from './pluginLoader'
// 插件集合变化事件（file-viewer 等监听并重算可打开集合）。显式引入以保证
// 模块求值早于插件加载（同 pluginActions/pluginNav 的加载顺序约束）。
import { emitPluginsChanged } from '@/platform/fileOpen'
// 批量操作注册表必须在插件 install 前就绪（插件会写入 window.__fm_bulk_actions）。
// pluginActions 仅被懒加载的 HomeView 静态 import，若不在此显式引入，
// 其模块求值会晚于插件加载，导致插件注册静默失败（dev 模式必现）。
import '@/pluginActions'
import '@/pluginNav'
import { useTheme } from './composables/useTheme'
import { STORAGE_KEY_THEME } from './constants'
import { DEMO_DEFAULT_THEME } from './demo/plugins'
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
app.use(ElementPlus)

// 全局暴露（window.Vue / window.ElementPlus 等）提前：插件 install（initPlugins 内）
// 可能使用 window.Vue（vue 运行时桥）等全局资源，必须早于插件加载完成
exposeToGlobal()

// 初始化插件系统（必须在 router/mount 前完成，确保插件路由先注册再解析 URL）
initPlugins().then(() => {
  console.log('[Plugin] All plugins initialized')

  // 全部插件安装完毕后广播插件集合变化：file-viewer 的 onPluginsChanged 会
  // 重新拉取查看器状态并重算 is-openable。若安装期间的首次拉取因后端未就绪/
  // 尚未登录而失败，这里是确定的补救时机（此时插件监听器已全部注册）。
  emitPluginsChanged()

  // demo 默认主题：无用户偏好时应用（此时 demo 插件已注册其主题）
  if (import.meta.env.VITE_DEMO_MODE === 'true' && DEMO_DEFAULT_THEME) {
    try {
      if (!localStorage.getItem(STORAGE_KEY_THEME)) {
        useTheme().setTheme(DEMO_DEFAULT_THEME)
      }
    } catch {
      // localStorage 不可用：跳过
    }
  }

  // router 必须在插件注册完路由之后才安装，否则初始导航找不到插件路由
  app.use(router)
  app.mount('#app')

  // 初始化脚本运行器（控制台 __runScript()）
  initScriptRunner(ctx)
})
