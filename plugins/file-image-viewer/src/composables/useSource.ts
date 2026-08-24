/**
 * 源加载：为当前图片取流令牌（token）、错误与元数据。
 *
 * 职责：api.fileIO 的 createToken（换取 30 分钟流令牌）+ 读取文件头解析元数据。
 * 视图重置（scale/rotate 等）不在此处，由组件在路径变化时调用 useViewControls.reset()。
 */

import type { FrontendPluginContext, FileItem } from '@mqn00/file-manager/plugin/frontend'
import { parseImageMetadata, type ImageMetadata } from '../metadata'

export function useSource(ctx: FrontendPluginContext, props: { file: FileItem }) {
  const { ref } = ctx.Vue
  const api = ctx.api.fileIO

  const token = ref('')
  const error = ref('')
  const meta = ref<ImageMetadata>({})

  /** 读取文件头解析元数据（分辨率/DPI/位深度）；失败静默，仅分辨率可用 natural 尺寸兜底 */
  const loadMetadata = async () => {
    try {
      const dot = props.file.name.lastIndexOf('.')
      const ext =
        dot >= 0 && dot < props.file.name.length - 1
          ? props.file.name.slice(dot + 1).toLowerCase()
          : ''
      const res = await api.read(props.file.path, 0, 64 * 1024)
      const bytes = api.base64ToBytes(res.data)
      meta.value = parseImageMetadata(bytes, ext)
    } catch {
      /* 解析失败不影响查看 */
    }
  }

  /** 取流令牌并重置文本类状态；视图重置由调用方负责 */
  const load = async () => {
    token.value = ''
    error.value = ''
    meta.value = {}
    try {
      token.value = await api.createToken(props.file.path)
    } catch (e) {
      error.value = `获取图片地址失败: ${e instanceof Error ? e.message : '未知错误'}`
    }
    void loadMetadata()
  }

  return { token, error, meta, load, loadMetadata }
}
