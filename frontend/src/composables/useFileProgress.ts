import { reactive } from 'vue'
import { zipFolderAsync, cancelZip as cancelZipApi, getFiles } from '@/api/file'
import { useTaskStore } from '@/stores/task'
import { ElMessage } from 'element-plus'
import type { FileItem } from '@/types'

export interface MoveProgressState {
  visible: boolean
  sourceNames: string[]
  sourcePaths: string[]
  targetPath: string
}

export interface ZipProgressState {
  visible: boolean
  folderPath: string
  progress: number
  status: 'success' | 'exception' | ''
  error: string
}

export const useFileProgress = () => {
  const taskStore = useTaskStore()

  const moveState = reactive<MoveProgressState>({
    visible: false,
    sourceNames: [],
    sourcePaths: [],
    targetPath: '',
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
    moveState.sourceNames = []
    moveState.sourcePaths = []
    moveState.targetPath = ''
  }

  const getParentPath = (filePath: string): string => {
    const parts = filePath.split('/')
    parts.pop()
    return parts.join('/') || '/'
  }

  const showBatchMoveDialog = (paths: string[], names: string[]) => {
    const parentPath = paths[0] ? getParentPath(paths[0]) : ''
    Object.assign(moveState, {
      visible: true,
      sourceNames: names,
      sourcePaths: paths,
      targetPath: parentPath,
    })
  }

  /**
   * 确认移动：检查冲突 → 启动后台任务 → 关闭对话框
   */
  const moveFiles = async () => {
    if (!moveState.targetPath.trim()) {
      ElMessage.warning('请选择目标路径')
      return
    }

    // 检查目标目录是否有同名文件
    const normalizedTargetPath = moveState.targetPath.startsWith('/')
      ? moveState.targetPath
      : '/' + moveState.targetPath
    try {
      const res = await getFiles(normalizedTargetPath)
      const existingNames = new Set(res.files.map((f: FileItem) => f.name))
      const conflicts = moveState.sourceNames.filter((name) => existingNames.has(name))
      if (conflicts.length > 0) {
        ElMessage.warning(`目标目录已存在同名文件：${conflicts.join('、')}，移动已取消`)
        return
      }
    } catch {
      // 目标目录不存在，继续移动（后端会创建）
    }

    // 启动后台任务
    const sourcePaths = moveState.sourcePaths.slice()
    const sourceNames = moveState.sourceNames.slice()

    hideMoveDialog()

    await taskStore.startMoveTask(sourcePaths, sourceNames, normalizedTargetPath)
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
    showBatchMoveDialog,
    moveFile: moveFiles,
    zipFolder,
    cancelZip,
  }
}
