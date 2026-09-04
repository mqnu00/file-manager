/**
 * file-viewer 共享查看页外壳（供子插件调用）
 *
 * 功能：
 * 1. 返回按钮 + 文件名/路径/大小
 * 2. "打开方式" ElSelect 下拉：列出全部已注册查看器，切换时 SPA 跳转 + localStorage 记忆
 * 3. 渲染子查看器组件（props: { file }）
 *
 * 子插件无需自己实现查看页外壳，改为调用本模块导出的 createViewerPageShell(ctx, component)。
 * file-viewer 前端 install 时将本函数挂载到 window.__fm_create_viewer_page_shell，
 * 子插件在 install 时读取全局并调用。
 */

import type { FrontendPluginContext, FileItem } from '@mqn00/file-manager/plugin/frontend'
import { viewers, refreshViewers } from './state'
import { loadModeOverride, saveModeOverride } from './overrides'

/** 从路由路径 /plugin/<id>/view 中提取 viewerId */
function extractViewerId(pathname: string): string | null {
  // 匹配 /plugin/<id>/view 模式
  const m = pathname.match(/^\/plugin\/([^/]+)\/view$/)
  return m ? m[1] : null
}

function extOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot >= 0 && dot < name.length - 1 ? name.slice(dot + 1).toLowerCase() : ''
}

function basename(p: string): string {
  return p.split('/').pop() || p
}

/**
 * 创建带查看器切换下拉的查看页外壳
 *
 * @param ctx  前端插件上下文（Vue/ElementPlus/router/stores 等）
 * @param component 子查看器 Vue 组件（props: { file: FileItem }）
 * @param componentName 可选组件名，用于 Vue devtools
 */
export function createViewerPageShell(
  ctx: FrontendPluginContext,
  component: unknown,
  componentName?: string,
): unknown {
  const { h, ref, computed, watch, defineComponent, onMounted } = ctx.Vue as unknown as {
    h: (...args: unknown[]) => unknown
    ref: <T>(v: T) => { value: T }
    computed: <T>(fn: () => T) => { value: T }
    watch: (src: unknown, cb: () => void, opts?: { immediate?: boolean }) => unknown
    defineComponent: (opts: { name: string; setup: () => () => unknown }) => unknown
    onMounted: (cb: () => void) => void
  }
  const { ElButton, ElSelect, ElOption, ElTag, ElEmpty } = ctx.ElementPlus as unknown as {
    ElButton: unknown
    ElSelect: unknown
    ElOption: unknown
    ElTag: unknown
    ElEmpty: unknown
  }

  return defineComponent({
    name: componentName || 'ViewerPageShell',
    setup() {
      const route = ctx.router.currentRoute
      const loaded = ref(false)

      const file = computed(() => {
        const p = typeof route.value.query.path === 'string' ? route.value.query.path : ''
        if (!p) return null
        const existing = ctx.stores.file.files.find((f: FileItem) => f.path === p)
        return existing ?? ({ name: basename(p), path: p, isDirectory: false, size: 0, modified: '' } as FileItem)
      })

      // 从路由路径解析当前 viewerId
      const currentViewerId = computed(() => extractViewerId(route.value.path))

      // 当前文件扩展名
      const currentExt = computed(() => file.value ? extOf(file.value.name) : '')

      // 确保 viewers 已加载（惰性拉取）
      const ensureViewers = async () => {
        if (viewers.length > 0) return
        try {
          await refreshViewers(ctx.api.instance)
        } catch {
          // 静默失败
        }
      }
      onMounted(ensureViewers)

      // 当前查看器对象
      const currentViewer = computed(() =>
        viewers.find((v) => v.id === currentViewerId.value) ?? null
      )

      // 切换查看器
      const onModeChange = (id: string) => {
        if (!file.value) return
        const target = viewers.find((v) => v.id === id)
        if (!target) return
        // 记住用户选择
        saveModeOverride(currentExt.value, id)
        // SPA 跳转到目标查看器的路由
        void ctx.router.push({ path: target.route, query: { path: file.value.path } })
      }

      // 页面加载完成标记
      watch(() => route.value.fullPath, () => { loaded.value = true }, { immediate: true })

      return () => {
        if (!file.value) {
          return h('div', { style: { padding: '48px', textAlign: 'center', color: 'var(--app-text-dim)' } }, '未指定文件')
        }

        // header：返回 + 文件信息 + 查看器切换
        const header = h('div', { class: 'fv-shell-header' }, [
          h(ElButton as never, {
            text: true,
            onClick: () => window.history.back(),
          }, () => '← 返回'),
          h('span', { class: 'fv-shell-name' }, file.value!.name),
          h(ElTag as never, {
            type: 'info',
            size: 'small',
            class: 'fv-shell-path',
          }, () => file.value!.path),
          file.value!.size > 0
            ? h('span', { class: 'fv-shell-size' }, ctx.utils.formatSize(file.value!.size))
            : null,
          h('span', { style: { flex: '1' } }),
          // 查看器切换下拉
          h('div', { class: 'fv-shell-actions' }, [
            h(ElSelect as never, {
              modelValue: currentViewerId.value,
              size: 'small',
              class: 'fv-shell-mode-select',
              onChange: onModeChange,
            }, () =>
              viewers.map((v) =>
                h(ElOption as never, { key: v.id, label: v.label, value: v.id })
              )
            ),
          ]),
        ])

        // body：子查看器组件
        const body = h('div', { class: 'fv-shell-body' }, [
          h(component as never, { file: file.value }),
        ])

        return h('div', { class: 'fv-shell-page' }, [header, body])
      }
    },
  })
}
