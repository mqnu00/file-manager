/**
 * file-viewer 配置页（插件主页，/plugin/file-viewer）
 *
 * 按查看器分组编辑其默认后缀列表，保存为 config.yml 完整映射表
 * （plugins.file-viewer.extensionMappings，ext→viewerId）。
 * 打开方式优先级：URL 指定 > 页面内选择(localStorage) > config.yml 映射 > 注册表默认。
 */

import type { FrontendPluginContext } from '@mqn00/file-manager/plugin/frontend'
import { getRegistry, initRegistry, type FileViewerModule } from './registry'
import { getMappings, saveMappings } from './config-api'

type VueApp = {
  h: (type: unknown, props?: Record<string, unknown>, children?: unknown) => unknown
  ref: <T>(v: T) => { value: T }
  onMounted: (cb: () => void) => void
  defineComponent: (opts: { name?: string; setup: () => () => unknown }) => unknown
}

interface El {
  ElButton: unknown
  ElTag: unknown
  ElInput: unknown
  ElAlert: unknown
  ElEmpty: unknown
  ElIcon: unknown
}

type EP = Record<string, unknown> & El

/** 每个查看器一行的编辑状态 */
interface Group {
  id: string
  label: string
  exts: string[]
  draft: string
  defaultExts: string[]
}

/** 完整映射表：ext → viewerId */
type Mapping = Record<string, string>

function injectStyles(): void {
  if (document.getElementById('file-viewer-config-style')) return
  const style = document.createElement('style')
  style.id = 'file-viewer-config-style'
  style.textContent = `
.fv-config-page { height: 100%; overflow-y: auto; padding: 20px 28px; box-sizing: border-box; }
.fv-config-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
.fv-config-title { font-size: 17px; font-weight: 600; color: var(--app-text-bright); }
.fv-config-tip { color: var(--app-text-dim); font-size: 12px; max-width: 640px; }
.fv-config-save { margin-left: auto; }
.fv-config-group { margin-bottom: 14px; padding: 14px 16px; border: 1px solid var(--app-border); border-radius: 8px; background: var(--app-accent-bg); }
.fv-config-group-head { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; flex-wrap: wrap; }
.fv-config-group-name { font-weight: 600; color: var(--app-text-bright); }
.fv-config-exts { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; flex: 1; }
.fv-config-add { width: 150px; margin-left: auto; }
.fv-config-orphan { margin-bottom: 14px; }
`
  document.head.appendChild(style)
}

export function createConfigPage(ctx: FrontendPluginContext): unknown {
  const { h, ref, onMounted, defineComponent } = ctx.Vue as unknown as VueApp
  const ep = ctx.ElementPlus as unknown as EP
  const { ElButton, ElTag, ElInput, ElSelect, ElOption, ElAlert, ElEmpty, ElIcon } = ep
  const ElMessage = (ctx.ElementPlus as unknown as {
    ElMessage: { success(m: string): void; warning(m: string): void; error(m: string): void }
  }).ElMessage

  const registry = getRegistry() ?? initRegistry()
  const http = ctx.api.instance

  return defineComponent({
    name: 'FileViewerConfigPage',
    setup() {
      const loading = ref(true)
      const loadingError = ref('')
      const saving = ref(false)
      const groups = ref<Group[]>([])
      const orphans = ref<Array<{ ext: string; viewerId: string }>>([])
      const defaultViewer = ref('')

      const load = async () => {
        loading.value = true
        loadingError.value = ''
        try {
          const saved = await getMappings(http)
          defaultViewer.value = saved.defaultViewer
          const mods: FileViewerModule[] = registry.modules()
          if (Object.keys(saved.extensionMappings).length === 0) {
            groups.value = mods.map((m) => ({
              id: m.id,
              label: m.label,
              exts: [...m.extensions],
              draft: '',
              defaultExts: [...m.extensions],
            }))
            orphans.value = []
          } else {
            const byViewer: Map<string, string[]> = new Map()
            const orphanList: Array<{ ext: string; viewerId: string }> = []
            const registered = new Set(mods.map((m) => m.id))
            for (const [ext, vid] of Object.entries(saved.extensionMappings)) {
              if (!registered.has(vid)) {
                orphanList.push({ ext, viewerId: vid })
                continue
              }
              const list = byViewer.get(vid) ?? []
              list.push(ext)
              byViewer.set(vid, list)
            }
            groups.value = mods.map((m) => ({
              id: m.id,
              label: m.label,
              exts: (byViewer.get(m.id) ?? []).sort(),
              draft: '',
              defaultExts: [...m.extensions],
            }))
            orphans.value = orphanList
          }
        } catch (e) {
          loadingError.value = e instanceof Error ? e.message : '加载配置失败'
        } finally {
          loading.value = false
        }
      }

      onMounted(load)

      const addExt = (g: Group) => {
        const ext = g.draft.trim().toLowerCase().replace(/^\./, '')
        if (!ext) return
        if (!g.exts.includes(ext)) g.exts.push(ext)
        g.exts.sort()
        g.draft = ''
      }

      const removeExt = (g: Group, ext: string) => {
        g.exts = g.exts.filter((x) => x !== ext)
      }

      const resetGroup = (g: Group) => {
        g.exts = [...g.defaultExts]
      }

      const save = async () => {
        const seen = new Map<string, string>()
        const conflicts: string[] = []
        const map: Mapping = {}
        for (const g of groups.value) {
          for (const ext of g.exts) {
            const norm = ext.trim().toLowerCase().replace(/^\./, '')
            if (!norm) continue
            if (seen.has(norm)) {
              conflicts.push(`${norm}（${seen.get(norm)} ↔ ${g.label}）`)
              continue
            }
            seen.set(norm, g.label)
            map[norm] = g.id
          }
        }
        if (conflicts.length > 0) {
          ElMessage.error(`扩展名冲突，请先在组内调整：${conflicts.join('、')}`)
          return
        }
        if (orphans.value.length > 0) {
          ElMessage.warning(
            `以下映射指向未安装的查看器，保存后将清除：${orphans.value.map((o) => o.ext).join('、')}`
          )
          orphans.value = []
        }
        saving.value = true
        try {
          await saveMappings(http, { extensionMappings: map, defaultViewer: defaultViewer.value })
          registry.setConfigMappings(map)
          registry.setDefaultViewer(defaultViewer.value)
          ElMessage.success('已保存，打开文件时按新映射解析')
        } catch (e) {
          ElMessage.error(`保存失败: ${e instanceof Error ? e.message : '未知错误'}`)
        } finally {
          saving.value = false
        }
      }

      return () => {
        const header = h('div', { class: 'fv-config-header' }, [
          h(
            ElButton as never,
            { text: true, onClick: () => window.history.back() },
            () => [h(ElIcon as never, {}, () => h('i', { class: 'el-icon-arrow-left' })), '返回']
          ),
          h('div', {}, [
            h('div', { class: 'fv-config-title' }, '查看器设置'),
            h(
              'div',
              { class: 'fv-config-tip' },
              '每个查看器一行，编辑其打开的后缀列表。保存后写入 config.yml 并立即生效；未列出的后缀优先用下方设置的「默认查看器」打开，未设置则不打开。'
            ),
          ]),
          h('div', { class: 'fv-config-save' }, [
            h(
              ElButton as never,
              { type: 'primary', loading: saving.value, disabled: loading.value, onClick: save },
              () => '保存'
            ),
          ]),
        ])

        let body
        if (loading.value) {
          body = h('div', { class: 'fv-loading' }, '正在加载配置…')
        } else if (loadingError.value) {
          body = h(ElAlert as never, {
            type: 'error',
            showIcon: false,
            title: loadingError.value,
            closable: false,
          })
        } else if (groups.value.length === 0) {
          body = h(ElEmpty as never, { description: '未安装任何查看插件（如 file-code-viewer 等）' })
        } else {
          const children: unknown[] = []
          if (orphans.value.length > 0) {
            children.push(
              h('div', { class: 'fv-config-orphan' }, [
                h(ElAlert as never, {
                  type: 'warning',
                  showIcon: false,
                  closable: false,
                  title:
                    '以下扩展名映射到未安装的查看器（保存后将清除）：' +
                    orphans.value.map((o) => `${o.ext} → ${o.viewerId}`).join('、'),
                }),
              ])
            )
          }
          // 默认查看器选择
          children.push(
            h('div', { class: 'fv-config-group', style: { marginBottom: '14px' } }, [
              h('div', { class: 'fv-config-group-head' }, [
                h('span', { class: 'fv-config-group-name' }, '默认查看器'),
                h(
                  'span',
                  { style: { color: 'var(--app-text-dim)', fontSize: '12px', marginRight: '12px' } },
                  '未列出的扩展名使用此查看器打开（如不设置则不打开）'
                ),
                h(ElSelect as never, {
                  modelValue: defaultViewer.value,
                  size: 'small',
                  clearable: true,
                  style: { width: '200px' },
                  'onUpdate:modelValue': (v: string) => {
                    defaultViewer.value = v ?? ''
                  },
                }, () =>
                  registry.modules().map((m) =>
                    h(ElOption as never, { key: m.id, label: m.label, value: m.id })
                  )
                ),
              ]),
            ])
          )
          for (const g of groups.value) {
            children.push(
              h('div', { class: 'fv-config-group' }, [
                h('div', { class: 'fv-config-group-head' }, [
                  h('span', { class: 'fv-config-group-name' }, g.label),
                  h('div', { class: 'fv-config-exts' }, [
                    ...g.exts.map((ext) =>
                      h(
                        ElTag as never,
                        { key: ext, closable: true, size: 'small', onClose: () => removeExt(g, ext) },
                        () => ext
                      )
                    ),
                    g.exts.length === 0
                      ? h(
                          'span',
                          { style: { color: 'var(--app-text-dim)', fontSize: '12px' } },
                          '（无后缀）'
                        )
                      : null,
                  ]),
                  h(ElInput as never, {
                    class: 'fv-config-add',
                    size: 'small',
                    modelValue: g.draft,
                    'onUpdate:modelValue': (v: string) => {
                      g.draft = v
                    },
                    placeholder: '如 md, txt',
                    onKeyup: (e: KeyboardEvent) => {
                      if (e.key === 'Enter') addExt(g)
                    },
                  }),
                  h(
                    ElButton as never,
                    { size: 'small', text: true, onClick: () => resetGroup(g) },
                    () => '还原默认'
                  ),
                  h(
                    ElButton as never,
                    { size: 'small', type: 'primary' as never, disabled: !g.draft.trim(), onClick: () => addExt(g) },
                    () => '添加'
                  ),
                ]),
              ])
            )
          }
          body = h('div', {}, children)
        }

        return h('div', { class: 'fv-config-page' }, [header, h('div', {}, [body])])
      }
    },
  })
}

injectStyles()