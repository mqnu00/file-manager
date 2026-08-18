/**
 * file-viewer 查看器映射配置的前端客户端
 *
 * 配置页使用：读取/写回 config.yml 中 plugins.file-viewer.extensionMappings
 * 完整映射表（ext→viewerId），保存成功后由配置页同步到注册表。
 */

/** 最小 HTTP 客户端结构（兼容 axios 实例的 get/put 形态） */
export interface ViewerHttp {
  get<T = unknown>(url: string, config?: { params?: Record<string, unknown> }): Promise<{ data: T }>
  put<T = unknown>(url: string, data?: unknown): Promise<{ data: T }>
}

/** 读取当前 extensionMappings（缺省返回 {}） */
export async function getMappings(http: ViewerHttp): Promise<Record<string, string>> {
  const r = await http.get<{ extensionMappings: Record<string, string> }>('/file-viewer/config')
  return r.data.extensionMappings ?? {}
}

/** 保存完整映射表 */
export async function saveMappings(
  http: ViewerHttp,
  map: Record<string, string>
): Promise<void> {
  await http.put('/file-viewer/config', { extensionMappings: map })
}