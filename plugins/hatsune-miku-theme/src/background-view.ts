import type { FrontendPluginContext } from '@mqn00/file-manager/plugin/frontend'
import { applyBackground, currentBackgroundId, DEFAULT_BG_ID } from './backgrounds'
import type { BackgroundInfo } from './backgrounds'
import {
  previewPanelSettings,
  currentPanelOpacity,
  currentPanelBlur,
  savePanelOpacity,
  savePanelBlur,
  DEFAULT_PANEL_OPACITY,
  DEFAULT_PANEL_BLUR,
} from './panel-settings'

export interface BackgroundViewDeps {
  // 结构化类型代替 vue 的 Ref，避免 import vue（插件约定不得直接 import vue）
  backgrounds: { value: BackgroundInfo[] }
  refreshBackgrounds: () => Promise<void>
}

/** 插件主页：背景图切换 + 自定义背景上传/删除 + 面板透明度/模糊度配置（先预览后保存） */
export function createBackgroundView(ctx: FrontendPluginContext, deps: BackgroundViewDeps) {
  const { h, ref, defineComponent, onUnmounted } = ctx.Vue
  const { ElButton, ElDivider, ElMessage, ElMessageBox, ElSlider, ElTag } = ctx.ElementPlus
  const { backgrounds, refreshBackgrounds } = deps

  return defineComponent({
    name: 'HatsuneMikuThemeView',
    setup() {
      const selectedId = ref(currentBackgroundId(backgrounds.value))
      const uploading = ref(false)
      const fileInputRef = ref<HTMLInputElement | null>(null)
      const panelOpacity = ref(currentPanelOpacity())
      const panelBlur = ref(currentPanelBlur())
      // 已保存的配置（localStorage 中的值），用于判断是否存在未保存修改
      const savedOpacity = ref(panelOpacity.value)
      const savedBlur = ref(panelBlur.value)

      function select(id: string) {
        applyBackground(id, backgrounds.value)
        selectedId.value = id
        ElMessage.success('背景图已切换')
      }

      async function handleFileChange(event: Event) {
        const input = event.target as HTMLInputElement
        const file = input.files?.[0]
        input.value = ''
        if (!file) return
        const formData = new FormData()
        formData.append('file', file)
        uploading.value = true
        try {
          const res = await ctx.api.instance.post('/hatsune-miku-theme/backgrounds', formData)
          const uploaded = res.data as { id?: string; url?: string }
          ElMessage.success('背景图已上传')
          await refreshBackgrounds()
          if (uploaded?.id) {
            applyBackground(uploaded.id, backgrounds.value)
            selectedId.value = uploaded.id
          }
        } catch (err: unknown) {
          const msg =
            err && typeof err === 'object' && 'response' in err
              ? ((err as { response?: { data?: { error?: string } } }).response?.data?.error ??
                '上传失败')
              : '上传失败'
          ElMessage.error(msg)
        } finally {
          uploading.value = false
        }
      }

      async function confirmDelete(bg: BackgroundInfo) {
        try {
          await ElMessageBox.confirm(`确定删除背景图 "${bg.label}" 吗？`, '删除确认', {
            confirmButtonText: '删除',
            cancelButtonText: '取消',
            type: 'warning',
          })
        } catch {
          return // 用户取消
        }
        try {
          await ctx.api.instance.delete(
            `/hatsune-miku-theme/backgrounds/${encodeURIComponent(bg.id)}`
          )
          ElMessage.success('背景图已删除')
          if (selectedId.value === bg.id) {
            applyBackground(DEFAULT_BG_ID, backgrounds.value)
            selectedId.value = DEFAULT_BG_ID
          }
          await refreshBackgrounds()
        } catch {
          ElMessage.error('删除失败')
        }
      }

      /** 保存面板效果：写入 localStorage 并作为新的已保存基准 */
      function savePanelSettings() {
        savePanelOpacity(panelOpacity.value)
        savePanelBlur(panelBlur.value)
        savedOpacity.value = panelOpacity.value
        savedBlur.value = panelBlur.value
        ElMessage.success('面板效果已保存')
      }

      // 离开插件主页时还原未保存的预览（仅预览不保存的修改会被丢弃）
      onUnmounted(() => {
        previewPanelSettings(savedOpacity.value, savedBlur.value)
      })

      return () => {
        const children: any[] = []
        children.push(
          h('div', { class: 'miku-bg-card-header' }, [
            h(
              ElButton,
              { text: true, class: 'back-btn', onClick: () => window.history.back() },
              () => '← 返回'
            ),
          ])
        )

        const m: any[] = []
        m.push(
          h('div', { class: 'miku-bg-header' }, [
            h('h3', { class: 'miku-bg-title' }, '初音未来主题'),
          ])
        )
        m.push(
          h(
            'p',
            { class: 'miku-bg-sub' },
            '选择主界面背景图，切换后立即生效并自动保存。可上传自定义背景图。'
          )
        )
        m.push(
          h(ElDivider, { contentPosition: 'left' }, () =>
            h('span', { class: 'miku-bg-divider' }, '背景图')
          )
        )

        const items = backgrounds.value.map((bg) => {
          const active = bg.id === selectedId.value
          const name = h('div', { class: 'miku-bg-name' }, [
            h('span', bg.label),
            bg.builtin
              ? null
              : h(
                  ElButton,
                  {
                    size: 'small',
                    text: true,
                    type: 'danger',
                    onClick: (e: MouseEvent) => {
                      e.stopPropagation()
                      confirmDelete(bg)
                    },
                  },
                  () => '删除'
                ),
          ])
          return h(
            'div',
            {
              class: ['miku-bg-item', active ? 'active' : ''],
              onClick: () => select(bg.id),
            },
            [
              h('img', { class: 'miku-bg-thumb', src: bg.url, alt: bg.label, loading: 'lazy' }),
              name,
            ]
          )
        })
        m.push(h('div', { class: 'miku-bg-grid' }, items))

        m.push(
          h('div', { class: 'miku-bg-upload' }, [
            h('input', {
              ref: fileInputRef,
              type: 'file',
              accept: 'image/*',
              style: { display: 'none' },
              onChange: handleFileChange,
            }),
            h(
              ElButton,
              {
                type: 'primary',
                loading: uploading.value,
                onClick: () => fileInputRef.value?.click(),
              },
              () => '上传背景图'
            ),
            h('span', { class: 'miku-bg-upload-tip' }, '支持 png / jpg / webp / gif，最大 10MB'),
          ])
        )

        const hasChanges =
          panelOpacity.value !== savedOpacity.value || panelBlur.value !== savedBlur.value

        m.push(
          h(ElDivider, { contentPosition: 'left' }, () =>
            h('span', { class: 'miku-bg-divider' }, '面板效果')
          )
        )
        m.push(
          h('div', { class: 'miku-config-row' }, [
            h('div', { class: 'miku-config-label' }, [
              h('span', '面板黑色半透明程度'),
              h('span', { class: 'miku-config-value' }, `${panelOpacity.value}%`),
            ]),
            h('div', { class: 'miku-config-slider' }, [
              h(ElSlider, {
                min: 0,
                max: 100,
                modelValue: panelOpacity.value,
                'onUpdate:modelValue': (v: number | number[]) => {
                  const value = Array.isArray(v) ? v[0] : v
                  panelOpacity.value = value
                  previewPanelSettings(value, panelBlur.value)
                },
              }),
              h(
                ElButton,
                {
                  size: 'small',
                  text: true,
                  disabled: panelOpacity.value === DEFAULT_PANEL_OPACITY,
                  onClick: () => {
                    panelOpacity.value = DEFAULT_PANEL_OPACITY
                    previewPanelSettings(DEFAULT_PANEL_OPACITY, panelBlur.value)
                  },
                },
                () => '重置默认'
              ),
            ]),
            h(
              'p',
              { class: 'miku-bg-upload-tip' },
              '数值越大面板越不透明，默认 10%，拖动实时预览，点击下方「保存面板效果」后生效。'
            ),
          ])
        )
        m.push(
          h('div', { class: 'miku-config-row' }, [
            h('div', { class: 'miku-config-label' }, [
              h('span', '面板背景模糊度'),
              h(
                'span',
                { class: 'miku-config-value' },
                panelBlur.value === 0 ? '无模糊' : `${panelBlur.value}px`
              ),
            ]),
            h('div', { class: 'miku-config-slider' }, [
              h(ElSlider, {
                min: 0,
                max: 30,
                modelValue: panelBlur.value,
                'onUpdate:modelValue': (v: number | number[]) => {
                  const value = Array.isArray(v) ? v[0] : v
                  panelBlur.value = value
                  previewPanelSettings(panelOpacity.value, value)
                },
              }),
              h(
                ElButton,
                {
                  size: 'small',
                  text: true,
                  disabled: panelBlur.value === DEFAULT_PANEL_BLUR,
                  onClick: () => {
                    panelBlur.value = DEFAULT_PANEL_BLUR
                    previewPanelSettings(panelOpacity.value, DEFAULT_PANEL_BLUR)
                  },
                },
                () => '重置默认'
              ),
            ]),
            h(
              'p',
              { class: 'miku-bg-upload-tip' },
              '数值越大背景越模糊，默认 0px，拖动实时预览，点击下方「保存面板效果」后生效。'
            ),
          ])
        )
        m.push(
          h('div', { class: 'miku-config-save' }, [
            h(
              ElButton,
              {
                type: 'primary',
                disabled: !hasChanges,
                onClick: savePanelSettings,
              },
              () => '保存面板效果'
            ),
            h(
              'span',
              { class: 'miku-bg-upload-tip' },
              hasChanges ? '有未保存的修改，点击保存后真正生效' : '当前已保存，无未保存修改'
            ),
          ])
        )

        m.push(
          h(ElDivider, { contentPosition: 'left' }, () =>
            h('span', { class: 'miku-bg-divider' }, '标签预览')
          )
        )
        m.push(
          h('div', { class: 'miku-tag-preview' }, [
            h(ElTag, { type: 'primary' }, () => 'primary'),
            h(ElTag, { type: 'success' }, () => 'success'),
            h(ElTag, { type: 'info' }, () => 'info'),
            h(ElTag, { type: 'warning' }, () => 'warning'),
            h(ElTag, { type: 'danger' }, () => 'danger'),
          ])
        )

        m.push(
          h(ElDivider, { contentPosition: 'left' }, () =>
            h('span', { class: 'miku-bg-divider' }, '消息预览')
          )
        )
        m.push(
          h('div', { class: 'miku-message-preview' }, [
            h(
              ElButton,
              {
                size: 'small',
                type: 'primary',
                onClick: () => ElMessage({ type: 'primary', message: 'primary 消息' }),
              },
              () => 'primary'
            ),
            h(
              ElButton,
              { size: 'small', type: 'success', onClick: () => ElMessage.success('success 消息') },
              () => 'success'
            ),
            h(
              ElButton,
              { size: 'small', type: 'info', onClick: () => ElMessage.info('info 消息') },
              () => 'info'
            ),
            h(
              ElButton,
              { size: 'small', type: 'warning', onClick: () => ElMessage.warning('warning 消息') },
              () => 'warning'
            ),
            h(
              ElButton,
              { size: 'small', type: 'danger', onClick: () => ElMessage.error('error 消息') },
              () => 'error'
            ),
          ])
        )

        children.push(h('div', { class: 'miku-bg-card-body' }, m))
        return h('div', { class: 'miku-bg-container' }, [
          h('div', { class: 'miku-bg-card' }, children),
        ])
      }
    },
  })
}
