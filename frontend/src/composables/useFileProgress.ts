import { reactive } from 'vue'
import { getFiles } from '@/api/file'
import { useTaskStore } from '@/stores/task'
import { ElMessage } from 'element-plus'
import type { FileItem } from '@/types'

export interface MoveProgressState {
  visible: boolean
  sourceNames: string[]
  sourcePaths: string[]
  targetPath: string
}

export const useFileProgress = () => {
  const taskStore = useTaskStore()

  const moveState = reactive<MoveProgressState>({
    visible: false,
    sourceNames: [],
    sourcePaths: [],
    targetPath: '',
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
  const moveFiles = async (onComplete?: () => void) => {
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

    await taskStore.startMoveTask(sourcePaths, sourceNames, normalizedTargetPath, onComplete)
  }

  /**
   * 启动压缩后台任务
   */
  const startZipTask = (path: string, onComplete?: () => void) => {
    taskStore.startCompressTask(path, onComplete)
  }

  return {
    moveState,
    showBatchMoveDialog,
    moveFile: moveFiles,
    startZipTask,
  }
}
