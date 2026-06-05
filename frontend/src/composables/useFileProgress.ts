import { reactive } from 'vue'
import { moveFileAsync, zipFolderAsync, cancelZip as cancelZipApi } from '@/api/file'
import { ElMessage } from 'element-plus'

export interface MoveProgressState {
  visible: boolean
  sourcePath: string
  sourceName: string
  sourceNames: string[]
  sourcePaths: string[]
  targetPath: string
  loading: boolean
  progress: number
  status: 'success' | 'exception' | ''
  speed: number
  batchMode: boolean
}

export interface ZipProgressState {
  visible: boolean
  folderPath: string
  progress: number
  status: 'success' | 'exception' | ''
  error: string
}

export const useFileProgress = () => {
  const moveState = reactive<MoveProgressState>({
    visible: false,
    sourcePath: '',
    sourceName: '',
    sourceNames: [],
    sourcePaths: [],
    targetPath: '',
    loading: false,
    progress: 0,
    status: '',
    speed: 0,
    batchMode: false,
  })

  const zipState = reactive<ZipProgressState>({
    visible: false,
    folderPath: '',
    progress: 0,
    status: '',
    error: '',
  })

  const hideMoveDialog = () => {
    moveState.visible = false
    moveState.sourcePath = ''
    moveState.sourceName = ''
    moveState.sourceNames = []
    moveState.sourcePaths = []
    moveState.targetPath = ''
    moveState.batchMode = false
  }

  const resetMoveState = () => {
    moveState.loading = false
    moveState.status = ''
    moveState.speed = 0
  }

  const showMoveDialog = (path: string, name: string) => {
    Object.assign(moveState, {
      visible: true,
      sourcePath: path,
      sourceName: name,
      sourceNames: [name],
      sourcePaths: [path],
      targetPath: '',
      loading: false,
      progress: 0,
      status: '',
      speed: 0,
      batchMode: false,
    })
  }

  const showBatchMoveDialog = (paths: string[], names: string[]) => {
    Object.assign(moveState, {
      visible: true,
      sourcePath: paths[0] || '',
      sourceName: names[0] || '',
      sourceNames: names,
      sourcePaths: paths,
      targetPath: '',
      loading: false,
      progress: 0,
      status: '',
      speed: 0,
      batchMode: true,
    })
  }

  const moveFiles = async (onComplete?: () => void) => {
    if (!moveState.targetPath.trim()) {
      ElMessage.warning('请选择目标路径')
      return
    }

    moveState.loading = true
    moveState.progress = 0
    moveState.status = ''
    moveState.speed = 0

    const total = moveState.sourcePaths.length
    let completed = 0
    let failed = 0

    for (let i = 0; i < moveState.sourcePaths.length; i++) {
      const srcPath = moveState.sourcePaths[i]
      const srcName = moveState.sourceNames[i]

      const normalizedSourcePath = srcPath.startsWith('/') ? srcPath : '/' + srcPath
      const normalizedTargetPath = moveState.targetPath.startsWith('/')
        ? moveState.targetPath
        : '/' + moveState.targetPath
      const fullPath = normalizedTargetPath + '/' + srcName

      try {
        await moveFileAsync(normalizedSourcePath, fullPath, (fileProgress, fileSpeed) => {
          moveState.speed = fileSpeed
          const overallProgress = Math.floor(((completed + fileProgress / 100) / total) * 100)
          moveState.progress = Math.min(99, overallProgress)
        })
        completed++
      } catch (e: any) {
        failed++
        ElMessage.error(`${srcName}: ${e.message}`)
      }
    }

    moveState.speed = 0

    if (failed === 0) {
      moveState.progress = 100
      moveState.status = 'success'
      ElMessage.success(`移动完成，成功 ${completed} 个`)
    } else if (completed > 0) {
      moveState.progress = 100
      moveState.status = 'success'
      ElMessage.warning(`移动完成，成功 ${completed} 个，失败 ${failed} 个`)
    } else {
      moveState.status = 'exception'
    }

    setTimeout(() => {
      hideMoveDialog()
      resetMoveState()
      onComplete?.()
    }, 600)
  }

  const zipFolder = (path: string, onRefresh?: () => void) => {
    Object.assign(zipState, {
      visible: true,
      folderPath: path,
      progress: 0,
      status: '',
      error: '',
    })

    zipFolderAsync(path, (progress) => {
      zipState.progress = progress
    })
      .then(() => {
        zipState.status = 'success'
        zipState.progress = 100
        ElMessage.success('压缩完成')
        onRefresh?.()
      })
      .catch((e: Error) => {
        zipState.status = 'exception'
        zipState.error = e.message || '压缩失败，请重试'
      })
  }

  const cancelZip = async (onSuccess?: () => void) => {
    try {
      await cancelZipApi(zipState.folderPath)
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
    showBatchMoveDialog,
    moveFile: moveFiles,
    zipFolder,
    cancelZip,
  }
}
