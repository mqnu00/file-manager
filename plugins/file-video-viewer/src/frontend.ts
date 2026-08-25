/**
 * file-video-viewer：视频播放
 *
 * 通过平台 I/O 换取流令牌（Range 流式，支持拖拽/Seek）：
 *   POST /api/files/token → 30 分钟令牌
 *   GET  /api/files/stream → <video>
 */

import type {
  FrontendPluginContext,
  FrontendPluginInstallFunction,
  FileItem,
} from '@mqn00/file-manager/plugin/frontend'
import { getRegistry, type FileViewerModule } from './registry'

const MIME_EXTENSIONS = ['mp4', 'webm', 'mkv', 'avi', 'mov', 'flv', 'm4v', 'wmv']

function createVideoViewer(ctx: FrontendPluginContext) {
  const { h, ref, onMounted } = ctx.Vue
  const { ElButton, ElAlert, ElMessage } = ctx.ElementPlus

  // 平台文件 I/O（主项目 /api/files/* + ctx.api.fileIO），与 file-viewer 解耦
  const api = ctx.api.fileIO

  return ctx.Vue.defineComponent({
    name: 'FileVideoViewer',
    props: {
      file: { type: Object, required: true },
    },
    setup(props: { file: FileItem }) {
      const token = ref('')
      const error = ref('')

      onMounted(async () => {
        try {
          token.value = await api.createToken(props.file.path)
        } catch (e) {
          error.value = `获取播放地址失败: ${e instanceof Error ? e.message : '未知错误'}`
        }
      })

      const download = async () => {
        try {
          // 主应用鉴权为 Bearer header，下载走带认证的 axios 请求再触发浏览器保存
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

      return () => {
        if (error.value) {
          return h('div', { class: 'fvv-viewer' }, [
            h(ElAlert, { type: 'error', showIcon: false, title: error.value, closable: false }),
            h('div', { style: { height: '12px' } }),
            h(ElButton, { size: 'small', onClick: download }, () => '下载文件'),
          ])
        }
        if (!token.value) {
          return h('div', { class: 'fvv-viewer fvv-loading' }, '加载播放地址中…')
        }
        return h('div', { class: 'fvv-viewer' }, [
          h('video', {
            src: api.streamUrl(token.value),
            controls: true,
            autoplay: true,
            preload: 'metadata',
            style: { width: '100%', maxWidth: '960px', maxHeight: '70vh', background: '#000' },
            onError: () => {
              error.value = '视频加载失败：该文件可能不是有效的视频或已损坏'
            },
          }),
          h('div', { style: { height: '8px' } }),
          h(ElButton, { size: 'small', onClick: download }, () => '下载视频'),
        ])
      }
    },
  })
}

function injectStyles(): void {
  if (document.getElementById('file-video-viewer-style')) return
  const style = document.createElement('style')
  style.id = 'file-video-viewer-style'
  style.textContent = `
.fvv-viewer { padding: 24px 0; }
.fvv-loading { color: var(--app-text-dim); }
`
  document.head.appendChild(style)
}

export const install: FrontendPluginInstallFunction = (ctx) => {
  injectStyles()
  const registry = getRegistry()
  if (!registry) {
    console.warn('[file-video-viewer] 未找到 file-viewer 核心注册表，跳过注册')
    return
  }
  const module: FileViewerModule = {
    id: 'video',
    label: '视频播放器',
    extensions: MIME_EXTENSIONS,
    editable: false,
    component: createVideoViewer(ctx),
  }
  const unregister = registry.register(module)

  console.log('[file-video-viewer] 前端已加载：视频模块已注册')

  // teardown 契约：卸载/重载时注销查看器模块并移除注入样式
  return () => {
    unregister()
    document.getElementById('file-video-viewer-style')?.remove()
  }
}