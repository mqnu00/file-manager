import api from './index'
import type { SystemInfo } from '@/types'

export async function getSystemInfo(): Promise<SystemInfo> {
  const { data } = await api.get<SystemInfo>('/system')
  return data
}
