/**
 * file-music-viewer：音频播放
 *
 * 通过平台 I/O 换取流令牌：
 *   POST /api/files/token  → 30 分钟令牌
 *   GET  /api/files/stream（Range 流式）→ <audio>
 *
 * 查看页路由 /plugin/music/view 由本插件自行注册；
 * file-viewer 的 fileOpen handler 在用户点击音频文件时跳转至此。
 */

import type {
  FrontendPluginContext,
  FrontendPluginInstallFunction,
  FileItem,
} from '@mqn00/file-manager/plugin/frontend'

const MIME_EXTENSIONS = ['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac', 'opus']

function createAudioViewer(ctx: FrontendPluginContext) {
  const { h, ref, onMounted } = ctx.Vue
  const { ElButton, ElAlert, ElMessage } = ctx.ElementPlus

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
            h(ElAlert, { type: 'error', showIcon: false, title: error.value, closable: false }),
            h('div', { style: { height: '12px' } }),
            h(ElButton, { size: 'small', onClick: download }, () => '下载文件'),
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
            onError: () => {
              error.value = '音频加载失败：该文件可能不是有效的音频或已损坏'
            },
          }),
          h('div', { style: { height: '8px' } }),
          h(ElButton, { size: 'small', onClick: download }, () => '下载音频'),
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

/** 查看页外壳：优先使用 file-viewer 共享外壳（含查看器切换下拉），否则降级为简易外壳 */
function resolveViewerPage(ctx: FrontendPluginContext, component: unknown) {
  const shellFactory = (window as unknown as Record<string, unknown>).__fm_create_viewer_page_shell as
    | ((ctx: FrontendPluginContext, component: unknown, name?: string) => unknown)
    | undefined
  if (shellFactory) {
    return shellFactory(ctx, component, 'MusicViewerPage')
  }
  const { h, computed, defineComponent } = ctx.Vue as unknown as {
    h: (...args: unknown[]) => unknown
    computed: <T>(fn: () => T) => { value: T }
    defineComponent: (opts: { name: string; setup: () => () => unknown }) => unknown
  }
  const { ElButton } = ctx.ElementPlus as unknown as { ElButton: unknown }
  const basename = (p: string) => p.split('/').pop() || p

  return defineComponent({
    name: 'MusicViewerPage',
    setup() {
      const route = ctx.router.currentRoute
      const file = computed(() => {
        const p = typeof route.value.query.path === 'string' ? route.value.query.path : ''
        if (!p) return null
        const existing = ctx.stores.file.files.find((f: FileItem) => f.path === p)
        return existing ?? ({ name: basename(p), path: p, isDirectory: false, size: 0, modified: '' } as FileItem)
      })
      return () => {
        if (!file.value) {
          return h('div', { style: { padding: '48px', textAlign: 'center', color: 'var(--app-text-dim)' } }, '未指定文件')
        }
        return h('div', { style: { height: '100%', display: 'flex', flexDirection: 'column', padding: '16px 20px', boxSizing: 'border-box' } }, [
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' } }, [
            h(ElButton as never, { text: true, onClick: () => window.history.back() }, () => '← 返回'),
            h('span', { style: { fontWeight: 600, color: 'var(--app-text-bright)' } }, file.value!.name),
            h('span', { style: { color: 'var(--app-text-dim)', fontSize: '12px', marginLeft: '8px' } }, file.value!.path),
          ]),
          h('div', { style: { flex: 1, minHeight: 0, overflow: 'auto' } }, [
            h(component as never, { file: file.value }),
          ]),
        ])
      }
    },
  })
}

export const install: FrontendPluginInstallFunction = (ctx) => {
  injectStyles()
  const audioComponent = createAudioViewer(ctx)
  const viewerPage = resolveViewerPage(ctx, audioComponent)

  ctx.router.addRoute({
    path: '/plugin/music/view',
    component: viewerPage as never,
    meta: { requiresAuth: true },
  })

  console.log('[file-music-viewer] 前端已加载：查看页路由 /plugin/music/view 已注册')

  return () => {
    document.getElementById('file-music-viewer-style')?.remove()
  }
}
