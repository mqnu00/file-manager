/**
 * 格式化工具函数
 */

/**
 * 格式化文件大小
 */
export const formatSize = (size: number): string => {
  if (size < 1024) return size + ' B'
  if (size < 1024 * 1024) return (size / 1024).toFixed(2) + ' KB'
  if (size < 1024 * 1024 * 1024) return (size / 1024 / 1024).toFixed(2) + ' MB'
  return (size / 1024 / 1024 / 1024).toFixed(2) + ' GB'
}

/**
 * 格式化时间
 */
export const formatTime = (time: string): string => {
  const date = new Date(time)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

/**
 * 格式化速度显示
 */
export const formatSpeed = (speed: number): string => {
  if (speed < 1) {
    return `${(speed * 1024).toFixed(2)} KB/s`
  } else if (speed < 1024) {
    return `${speed.toFixed(2)} MB/s`
  } else {
    return `${(speed / 1024).toFixed(2)} GB/s`
  }
}

/**
 * 格式化进度显示（含剩余时间估算）
 */
export const formatProgress = (percent: number, speed: number): string => {
  if (speed > 0 && percent < 100) {
    const remainingMB = (100 - percent) / 100 * 100
    const eta = remainingMB / speed
    return `${percent}% (${eta < 60 ? `${eta.toFixed(0)}s` : `${(eta / 60).toFixed(1)}m`} 剩余)`
  }
  return `${percent}%`
}
