/**
 * file-office-viewer：Office 文档只读预览
 *
 * 各格式处理策略：
 *   pdf           浏览器原生 iframe（平台 /api/files/stream 流）
 *   docx          docx-preview 前端渲染（平台流拉取字节）
 *   xlsx / xls    SheetJS 渲染为表格（平台流拉取字节）
 *   doc/ppt/pptx  本插件后端 soffice 转 PDF 后 iframe 预览（无 soffice 提示下载）
 *
 * 均为只读预览（需求明确不支持编辑）。
 */

import type {
  FrontendPluginContext,
  FrontendPluginInstallFunction,
  FileItem,
} from '@mqn00/file-manager/plugin/frontend'
import { renderAsync } from 'docx-preview'
import * as XLSX from 'xlsx'
import { getRegistry, type FileViewerModule } from './registry'
import { createViewerApi, type ViewerApi } from './api'

const EXTENSIONS = ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt']

function extOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot >= 0 && dot < name.length - 1 ? name.slice(dot + 1).toLowerCase() : ''
}

function createOfficeViewer(ctx: FrontendPluginContext): unknown {
  const { h, ref, computed, watch, onMounted, onBeforeUnmount } = ctx.Vue as unknown as {
    h: (type: unknown, props?: Record<string, unknown>, children?: unknown) => unknown
    ref: <T>(v: T) => { value: T }
    computed: <T>(fn: () => T) => { value: T }
    watch: (src: unknown, cb: () => void, opts?: { immediate?: boolean }) => unknown
    onMounted: (cb: () => void) => void
    onBeforeUnmount: (cb: () => void) => void
  }
  const { ElButton, ElAlert, ElSelect, ElOption, ElTag } = ctx.ElementPlus as unknown as {
    ElButton: never
    ElAlert: never
    ElSelect: never
    ElOption: never
    ElTag: never
  }
  const ElMessage = (ctx.ElementPlus as unknown as {
    ElMessage: { error: (m: string) => void }
  }).ElMessage

  // 平台文件 I/O（主项目 /api/files/* + ctx.api.fileIO）：pdf/docx/xlsx/xls 原始字节拉取
  const io = ctx.api.fileIO
  // 本插件后端（/api/file-office-viewer/*）：soffice 转换 + 转换产物流
  const api: ViewerApi = createViewerApi(ctx.api.instance)

  return ctx.Vue.defineComponent({
    name: 'FileOfficeViewer',
    props: {
      file: { type: Object, required: true },
    },
    setup(props: { file: FileItem }) {
      const ext = extOf(props.file.name)
      const loading = ref(true)
      const error = ref('')
      const pdfUrl = ref('')
      const sheetNames = ref<string[]>([])
      const activeSheet = ref('')
      const containerRef = ref<HTMLElement | null>(null)
      let wb: XLSX.WorkBook | null = null
      let disposed = false

      onBeforeUnmount(() => {
        disposed = true
      })

      const renderSheetHtml = () => {
        const container = containerRef.value
        const ws = wb ? wb.Sheets[activeSheet.value] : null
        if (!ws || !container) return
        container.innerHTML = XLSX.utils.sheet_to_html(ws)
      }

      watch(activeSheet, renderSheetHtml)

      const download = async () => {
        try {
          const resp = await ctx.api.instance.get(`/files/download/${encodeURIComponent(props.file.path)}`, {
            responseType: 'blob',
          })
          const url = URL.createObjectURL(resp.data as Blob)
          const a = document.createElement('a')
          a.href = url
          a.download = props.file.name
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(url)
        } catch (e) {
          ElMessage.error(`下载失败: ${e instanceof Error ? e.message : '未知错误'}`)
        }
      }

      const boot = async () => {
        loading.value = true
        error.value = ''
        try {
          if (ext === 'pdf') {
            const token = await io.createToken(props.file.path)
            pdfUrl.value = io.streamUrl(token)
          } else if (ext === 'docx') {
            const token = await io.createToken(props.file.path)
            const resp = await fetch(io.streamUrl(token))
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
            const blob = await resp.blob()
            const container = containerRef.value
            if (disposed || !container) return
            await renderAsync(blob, container, undefined, { inWrapper: false })
          } else if (ext === 'xlsx' || ext === 'xls') {
            const token = await io.createToken(props.file.path)
            const resp = await fetch(io.streamUrl(token))
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
            const buffer = await resp.arrayBuffer()
            wb = XLSX.read(buffer, { type: 'array' })
            sheetNames.value = wb.SheetNames
            if (wb.SheetNames.length > 0) {
              activeSheet.value = wb.SheetNames[0]
            }
            renderSheetHtml()
          } else {
            // .doc / .ppt / .pptx：soffice 转 PDF
            const result = await api.convert(props.file.path)
            if (result.ok && result.token) {
              pdfUrl.value = api.officeStreamUrl(result.token)
            } else {
              error.value = result.reason || '转换失败'
            }
          }
        } catch (e) {
          error.value = `预览失败: ${e instanceof Error ? e.message : '未知错误'}`
        } finally {
          loading.value = false
        }
      }

      onMounted(boot)

      return () => {
        const isSheet = ext === 'xlsx' || ext === 'xls'
        const bar = h('div', { class: 'fov-bar' }, [
          h(ElTag as never, { size: 'small', type: 'info' }, () => `${ext.toUpperCase()} 预览（只读）`),
          loading.value ? h('span', { class: 'fov-loading' }, '加载中…') : null,
          isSheet && sheetNames.value.length > 1
            ? h(ElSelect as never, {
                modelValue: activeSheet.value,
                size: 'small',
                style: { width: '200px' },
                onChange: (v: string) => {
                  activeSheet.value = v
                },
              }, () => sheetNames.value.map((name) => h(ElOption as never, { key: name, label: name, value: name })))
            : null,
          h('span', { style: { flex: 1 } }),
          h(ElButton as never, { size: 'small', onClick: download }, () => '下载文件'),
        ])

        if (error.value) {
          return h('div', { class: 'fov-viewer' }, [
            bar,
            h('div', { style: { height: '12px' } }),
            h(ElAlert as never, { type: 'error', showIcon: false, title: error.value, closable: false }),
          ])
        }

        return h('div', { class: 'fov-viewer' }, [
          bar,
          pdfUrl.value
            ? h('iframe', {
                src: pdfUrl.value,
                class: 'fov-iframe',
                style: { width: '100%', height: 'calc(100% - 42px)', border: 'none' },
              })
            : null,
          h('div', { class: 'fov-container', ref: containerRef, style: { display: pdfUrl.value ? 'none' : 'block' } }),
        ])
      }
    },
  })
}

function injectStyles(): void {
  if (document.getElementById('file-office-viewer-style')) return
  const style = document.createElement('style')
  style.id = 'file-office-viewer-style'
  style.textContent = `
.fov-viewer { height: 100%; display: flex; flex-direction: column; }
.fov-bar { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
.fov-loading { color: var(--app-text-dim); font-size: 12px; }
/* 文档正文区跟随主题令牌（fallback 保证令牌缺失时仍可读） */
.fov-container { overflow: auto; height: 100%; background: var(--app-panel-solid, #fff); color: var(--app-text, #333); padding: 12px; border-radius: 6px; }
.fov-container table { border-collapse: collapse; }
.fov-container td, .fov-container th { border: 1px solid var(--app-border, #ccc); padding: 2px 8px; }
.fov-iframe { border-radius: 6px; background: var(--app-panel-solid, #525659); }
`
  document.head.appendChild(style)
}

export const install: FrontendPluginInstallFunction = (ctx) => {
  injectStyles()
  const registry = getRegistry()
  if (!registry) {
    console.warn('[file-office-viewer] 未找到 file-viewer 核心注册表，跳过注册')
    return
  }
  const module: FileViewerModule = {
    id: 'office',
    label: '办公文档查看器',
    extensions: EXTENSIONS,
    editable: false,
    component: createOfficeViewer(ctx),
  }
  registry.register(module)

  console.log('[file-office-viewer] 前端已加载：office 模块已注册')
}