/**
 * file-music-viewer：音频播放
 *
 * 通过平台 I/O 换取流令牌：
 *   POST /api/files/token  → 30 分钟令牌
 *   GET  /api/files/stream（Range 流式）→ <audio>
 */

import type {
  FrontendPluginContext,
  FrontendPluginInstallFunction,
  FileItem,
} from '@mqn00/file-manager/plugin/frontend'
import { getRegistry, type FileViewerModule } from './registry'

const MIME_EXTENSIONS = ['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac', 'opus']

function createAudioViewer(ctx: FrontendPluginContext): unknown {
  const { h, ref, onMounted } = ctx.Vue as unknown as {
    h: (type: unknown, props?: Record<string, unknown>, children?: unknown) => unknown
    ref: <T>(v: T) => { value: T }
    onMounted: (cb: () => void) => void
  }
  const ElButton = (ctx.ElementPlus as unknown as { ElButton: never }).ElButton
  const ElAlert = (ctx.ElementPlus as unknown as { ElAlert: never }).ElAlert
  const ElMessage = (ctx.ElementPlus as unknown as {
    ElMessage: { error: (m: string) => void }
  }).ElMessage

  // 平台文件 I/O（主项目 /api/files/* + ctx.api.fileIO），与 file-viewer 解耦
  const api = ctx.api.fileIO

  return ctx.Vue.defineComponent({
    name: 'FileAudioViewer',
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
          return h('div', { class: 'fmu-viewer' }, [
            h(ElAlert as never, { type: 'error', showIcon: false, title: error.value, closable: false }),
            h('div', { style: { height: '12px' } }),
            h(ElButton as never, { size: 'small', onClick: download }, () => '下载文件'),
          ])
        }
        if (!token.value) {
          return h('div', { class: 'fmu-viewer fmu-loading' }, '加载播放地址中…')
        }
        return h('div', { class: 'fmu-viewer' }, [
          h('audio', {
            src: api.streamUrl(token.value),
            controls: true,
            autoplay: true,
            preload: 'metadata',
            style: { width: '100%', maxWidth: '720px' },
          }),
          h('div', { style: { height: '8px' } }),
          h(ElButton as never, { size: 'small', onClick: download }, () => '下载音频'),
        ])
      }
    },
  })
}

function injectStyles(): void {
  if (document.getElementById('file-music-viewer-style')) return
  const style = document.createElement('style')
  style.id = 'file-music-viewer-style'
  style.textContent = `
.fmu-viewer { padding: 24px 0; }
.fmu-loading { color: var(--app-text-dim); }
`
  document.head.appendChild(style)
}

export const install: FrontendPluginInstallFunction = (ctx) => {
  injectStyles()
  const registry = getRegistry()
  if (!registry) {
    console.warn('[file-music-viewer] 未找到 file-viewer 核心注册表，跳过注册')
    return
  }
  const module: FileViewerModule = {
    id: 'music',
    label: '音乐播放器',
    extensions: MIME_EXTENSIONS,
    editable: false,
    component: createAudioViewer(ctx),
  }
  registry.register(module)

  console.log('[file-music-viewer] 前端已加载：音乐模块已注册')
}