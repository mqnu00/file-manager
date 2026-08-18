/**
 * file-viewer 查看页外壳
 *
 * 职责：读取路由 query 的 path/mode，从注册表取查看模块并渲染。
 * 提供：返回按钮、文件名/路径/大小信息、"打开方式"下拉（可切换并记住）
 * 具体查看/编辑逻辑由子插件注册的模块组件自己实现（props: { file }）。
 */

import type { FrontendPluginContext, FileItem } from '@mqn00/file-manager/plugin/frontend'
import { getRegistry, initRegistry } from './registry'
import { loadModeOverride, saveModeOverride } from './overrides'

type VueApp = {
  h: (type: unknown, props?: Record<string, unknown>, children?: unknown) => unknown
  ref: <T>(v: T) => { value: T }
  computed: <T>(fn: () => T) => { value: T }
  watch: (src: unknown, cb: () => void, opts?: { immediate?: boolean }) => unknown
  defineComponent: (opts: { name?: string; setup: () => () => unknown }) => unknown
}

interface El {
  ElButton: unknown
  ElSelect: unknown
  ElOption: unknown
  ElEmpty: unknown
  ElTag: unknown
  ElAlert: unknown
  ElIcon: unknown
}

type EP = Record<string, unknown> & El

function extOf(file: { name: string }): string {
  const dot = file.name.lastIndexOf('.')
  return dot >= 0 && dot < file.name.length - 1 ? file.name.slice(dot + 1).toLowerCase() : ''
}

function basename(p: string): string {
  const parts = p.replace(/\\/g, '/').split('/')
  return parts[parts.length - 1] || p
}

export function createViewerPage(ctx: FrontendPluginContext): unknown {
  const { h, ref, computed, watch, defineComponent } = ctx.Vue as unknown as VueApp
  const ep = ctx.ElementPlus as unknown as EP
  const { ElButton, ElIcon, ElSelect, ElOption, ElEmpty, ElTag, ElAlert } = ep

  const registry = getRegistry() ?? initRegistry()

  return defineComponent({
    name: 'FileViewerPage',
    setup() {
      const file = ref<FileItem | null>(null)
      const mode = ref<string | null>(null)
      const initialized = ref(false)

      const parseFromRoute = () => {
        const query = ctx.router.currentRoute.value.query
        const p = typeof query.path === 'string' ? query.path : ''
        if (!p) {
          file.value = null
          initialized.value = true
          return
        }
        const existing = ctx.stores.file.files.find((f) => f.path === p)
        file.value =
          existing ?? {
            name: basename(p),
            path: p,
            isDirectory: false,
            size: 0,
            modified: '',
          }
        const ext = extOf(file.value)
        const qMode = typeof query.mode === 'string' ? query.mode : ''
        const override = loadModeOverride(ext)
        const defaultMode = registry.getDefault(ext)?.id ?? null
        // 优先级：URL 指定 > 用户覆盖 > 注册表默认
        if (qMode && registry.get(qMode)) {
          mode.value = qMode
        } else if (override && registry.get(override)) {
          mode.value = override
        } else {
          mode.value = defaultMode
        }
        initialized.value = true
      }

      watch(() => ctx.router.currentRoute.value.fullPath, parseFromRoute, { immediate: true })

      const currentExt = computed(() => (file.value ? extOf(file.value) : ''))

      // 当前文件可用的查看模块（扩展名命中 + 兜底模块）
      const applicable = computed(() => registry.getApplicable(currentExt.value))

      const activeModule = computed(() => (mode.value ? registry.get(mode.value) : null))

      const onModeChange = (id: string) => {
        mode.value = id
        if (file.value) saveModeOverride(extOf(file.value), id)
      }

      return () => {
        const header = h('div', { class: 'fv-header' }, [
          h(
            ElButton as never,
            { text: true, class: 'fv-back', onClick: () => window.history.back() },
            () => [
              h(ElIcon as never, {}, () => h('i', { class: 'el-icon-arrow-left' })),
              '返回',
            ]
          ),
          file.value
            ? h('div', { class: 'fv-title' }, [
                h('span', { class: 'fv-name' }, file.value.name),
                h(ElTag as never, { type: 'info', size: 'small', class: 'fv-path' }, () => file.value?.path),
                h('span', { class: 'fv-size' }, file.value.size > 0 ? ctx.utils.formatSize(file.value.size) : '—'),
              ])
            : null,
          h('div', { class: 'fv-actions' }, [
            applicable.value.length > 0
              ? h(ElSelect as never, { modelValue: mode.value, size: 'small', class: 'fv-mode-select', onChange: onModeChange }, () =>
                  applicable.value.map((m) =>
                    h(ElOption as never, { key: m.id, label: m.label, value: m.id })
                  )
                )
              : null,
          ]),
        ])

        let body
        if (!initialized.value) {
          body = h('div', { class: 'fv-loading' }, '加载中…')
        } else if (!file.value) {
          body = h(ElEmpty as never, { description: '未找到文件（缺少 path 参数）' })
        } else if (applicable.value.length === 0) {
          body = h(ElEmpty as never, { description: '未安装任何查看插件（如 file-code-viewer/file-music-viewer 等）' })
        } else if (activeModule.value) {
          // 注意：函数的 children 只会作用于组件（default slot）；对原生元素
          // Vue 会静默丢弃，导致内容不渲染。因此这里用数组形式。
          body = h('div', { class: 'fv-body' }, [
            h((activeModule.value as { component: unknown }).component as never, { file: file.value }),
          ])
        } else {
          body = h(ElAlert as never, { type: 'warning', showIcon: false, title: '该文件没有可用的查看方式', closable: false })
        }

        return h('div', { class: 'fv-page' }, [header, h('div', { class: 'fv-content' }, [body])])
      }
    },
  })
}