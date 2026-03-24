import { reactive } from 'vue'
import { moveFile as moveFileApi, zipFolder as zipFolderApi, cancelZip as cancelZipApi } from '@/api/file'
import { ElMessage } from 'element-plus'

/**
 * 移动文件进度状态
 */
export interface MoveProgressState {
  visible: boolean
  sourcePath: string
  sourceName: string
  targetPath: string
  loading: boolean
  progress: number
  status: 'success' | 'exception' | ''
  speed: number
}

/**
 * 压缩进度状态
 */
export interface ZipProgressState {
  visible: boolean
  folderPath: string
  progress: number
  status: 'success' | 'exception' | ''
  error: string
}

/**
 * 文件移动和压缩进度管理
 */
export const useFileProgress = () => {
  // 移动状态
  const moveState = reactive<MoveProgressState>({
    visible: false,
    sourcePath: '',
    sourceName: '',
    targetPath: '',
    loading: false,
    progress: 0,
    status: '',
    speed: 0
  })
  let moveEventSource: EventSource | null = null

  // 压缩状态
  const zipState = reactive<ZipProgressState>({
    visible: false,
    folderPath: '',
    progress: 0,
    status: '',
    error: ''
  })
  let zipEventSource: EventSource | null = null

  /**
   * 显示移动对话框
   */
  const showMoveDialog = (path: string, name: string) => {
    Object.assign(moveState, {
      visible: true,
      sourcePath: path,
      sourceName: name,
      targetPath: '',
      loading: false,
      progress: 0,
      status: '',
      speed: 0
    })
  }

  /**
   * 隐藏移动对话框
   */
  const hideMoveDialog = () => {
    moveState.visible = false
    moveState.sourcePath = ''
    moveState.sourceName = ''
    moveState.targetPath = ''
  }

  /**
   * 重置移动状态
   */
  const resetMoveState = () => {
    moveState.loading = false
    moveState.status = ''
    moveState.speed = 0
  }

  /**
   * 执行文件移动
   */
  const moveFile = (onComplete?: () => void) => {
    if (!moveState.targetPath.trim()) {
      ElMessage.warning('请选择目标路径')
      return
    }

    moveState.loading = true
    moveState.progress = 0
    moveState.status = ''
    moveState.speed = 0

    // 构建完整目标路径
    const normalizedSourcePath = moveState.sourcePath.startsWith('/')
      ? moveState.sourcePath
      : '/' + moveState.sourcePath
    const normalizedTargetPath = moveState.targetPath.startsWith('/')
      ? moveState.targetPath
      : '/' + moveState.targetPath
    const fullPath = normalizedTargetPath + '/' + moveState.sourceName

    if (moveEventSource) {
      moveEventSource.close()
    }

    moveEventSource = moveFileApi(normalizedSourcePath, fullPath)

    moveEventSource.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.type === 'progress') {
        moveState.progress = data.progress
        moveState.speed = data.speed || 0
      } else if (data.type === 'complete') {
        moveState.progress = 100
        moveState.status = 'success'
        moveEventSource?.close()
        moveEventSource = null
        ElMessage.success('移动成功')
        setTimeout(() => {
          hideMoveDialog()
          resetMoveState()
          onComplete?.()
        }, 500)
      } else if (data.type === 'error') {
        moveState.status = 'exception'
        moveEventSource?.close()
        moveEventSource = null
        ElMessage.error(data.message || '移动失败')
        setTimeout(() => {
          hideMoveDialog()
          resetMoveState()
        }, 500)
      }
    }

    moveEventSource.onerror = () => {
      moveState.status = 'exception'
      moveEventSource?.close()
      moveEventSource = null
      ElMessage.error('移动失败，请重试')
      setTimeout(() => {
        hideMoveDialog()
        resetMoveState()
      }, 500)
    }
  }

  /**
   * 执行文件夹压缩
   */
  const zipFolder = (path: string, onRefresh?: () => void) => {
    Object.assign(zipState, {
      visible: true,
      folderPath: path,
      progress: 0,
      status: '',
      error: ''
    })

    if (zipEventSource) {
      zipEventSource.close()
    }

    zipEventSource = zipFolderApi(path)

    zipEventSource.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.type === 'progress') {
        zipState.progress = data.progress
      } else if (data.type === 'complete') {
        zipState.status = 'success'
        zipState.progress = 100
        zipEventSource?.close()
        zipEventSource = null
        ElMessage.success('压缩完成')
        onRefresh?.()
      } else if (data.type === 'error') {
        zipState.status = 'exception'
        zipState.error = data.message
        zipEventSource?.close()
        zipEventSource = null
      }
    }

    zipEventSource.onerror = () => {
      zipState.status = 'exception'
      zipState.error = '压缩失败，请重试'
      zipEventSource?.close()
      zipEventSource = null
    }
  }

  /**
   * 取消压缩
   */
  const cancelZip = async (onSuccess?: () => void) => {
    try {
      await cancelZipApi(zipState.folderPath)
      zipEventSource?.close()
      zipEventSource = null
      zipState.visible = false
      ElMessage.info('已取消压缩')
      onSuccess?.()
    } catch (e: any) {
      ElMessage.error(e.response?.data?.message || '取消失败')
    }
  }

  return {
    moveState,
    zipState,
    showMoveDialog,
    moveFile,
    zipFolder,
    cancelZip
  }
}
