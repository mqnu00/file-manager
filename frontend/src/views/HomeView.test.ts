import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { reactive } from 'vue'
import type { FileItem } from '@/types'

vi.mock('@/api/file', () => ({
  getFiles: vi.fn(),
  createFolder: vi.fn(),
  batchDeleteFiles: vi.fn(),
  renameFile: vi.fn(),
  getDirSize: vi.fn(),
  downloadFile: vi.fn(),
}))

const taskStoreMock = { init: vi.fn() }
vi.mock('@/stores/task', () => ({
  useTaskStore: () => taskStoreMock,
}))

const progressMock = {
  moveState: reactive({ visible: false, sourceNames: [] as string[], sourcePaths: [] as string[], targetPath: '' }),
  showBatchMoveDialog: vi.fn(),
  moveFile: vi.fn(),
  startZipTask: vi.fn(),
}
vi.mock('@/composables/useFileProgress', () => ({
  useFileProgress: () => progressMock,
}))

vi.mock('element-plus', async (importOriginal) => {
  const actual = await importOriginal<typeof import('element-plus')>()
  return {
    ...actual,
    ElMessage: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
    ElMessageBox: { alert: vi.fn(), confirm: vi.fn() },
  }
})

import HomeView from './HomeView.vue'
import { getFiles, createFolder as createFolderApi, batchDeleteFiles } from '@/api/file'
import { useFileStore } from '@/stores/file'
import { ElMessage, ElMessageBox } from 'element-plus'
import { STORAGE_KEY_FILE_PATH } from '@/constants'

const mockedGetFiles = vi.mocked(getFiles)
const mockedCreateFolder = vi.mocked(createFolderApi)
const mockedBatchDelete = vi.mocked(batchDeleteFiles)
const mockedConfirm = vi.mocked(ElMessageBox.confirm)

const fileA: FileItem = { name: 'a.txt', path: '/a.txt', isDirectory: false, size: 10, modified: '2026-01-01' }
const dirB: FileItem = { name: 'dirb', path: '/dirb', isDirectory: true, size: 0, modified: '2026-01-01' }

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  // 清空存储：避免上个用例留下的路径记忆影响本次挂载
  sessionStorage.clear()
  localStorage.clear()
  mockedGetFiles.mockResolvedValue({ path: '', files: [fileA, dirB] })
  mockedCreateFolder.mockResolvedValue({ success: true })
  mockedBatchDelete.mockResolvedValue({ success: 1, failed: [] })
  mockedConfirm.mockResolvedValue('confirm')
})

const stubs = {
  Toolbar: { name: 'Toolbar', template: '<div class="toolbar-stub"><slot name="extra" /></div>' },
  FileTable: {
    name: 'FileTable',
    props: ['files'],
    template: '<div class="file-table-stub"><span v-for="f in files" :key="f.path" class="file-row">{{ f.name }}</span></div>',
  },
  CreateFolderDialog: {
    name: 'CreateFolderDialog',
    props: ['modelValue', 'folderName'],
    template: '<div v-if="modelValue" class="create-folder-stub" />',
  },
  MoveFileDialog: { name: 'MoveFileDialog', template: '<div />' },
  RenameDialog: { name: 'RenameDialog', template: '<div />' },
  ContextMenu: { name: 'ContextMenu', props: ['x', 'y', 'row'], template: '<div class="context-menu-stub" />' },
  TaskPanel: { name: 'TaskPanel', template: '<div />' },
}

async function mountView() {
  const wrapper = mount(HomeView, { global: { stubs } })
  await flushPromises()
  return wrapper
}

describe('HomeView.vue', () => {
  it('mount → getFiles 加载列表并渲染 FileTable', async () => {
    const wrapper = await mountView()
    expect(mockedGetFiles).toHaveBeenCalledWith('')
    expect(taskStoreMock.init).toHaveBeenCalled()
    const rows = wrapper.findAll('.file-row')
    // useFileSort 默认文件夹优先
    expect(rows.map((r) => r.text())).toEqual(['dirb', 'a.txt'])
  })

  it('getFiles 失败 → 提示加载失败', async () => {
    mockedGetFiles.mockRejectedValue(new Error('network'))
    await mountView()
    expect(ElMessage.error).toHaveBeenCalledWith('加载失败')
  })

  it('新建文件夹 → createFolder 调用并刷新列表', async () => {
    const wrapper = await mountView()
    await wrapper.getComponent({ name: 'Toolbar' }).vm.$emit('create-folder')
    await flushPromises()
    expect(wrapper.find('.create-folder-stub').exists()).toBe(true)

    const dialog = wrapper.getComponent({ name: 'CreateFolderDialog' })
    dialog.vm.$emit('update:folder-name', 'newdir')
    dialog.vm.$emit('confirm')
    await flushPromises()

    expect(mockedCreateFolder).toHaveBeenCalledWith('', 'newdir')
    expect(ElMessage.success).toHaveBeenCalledWith('创建成功')
    // mount 1 次 + 创建后刷新 1 次
    expect(mockedGetFiles).toHaveBeenCalledTimes(2)
  })

  it('选中删除：确认后 batchDeleteFiles 调用并清空选中', async () => {
    const wrapper = await mountView()
    const fileStore = useFileStore()
    fileStore.setSelectedFiles(['/a.txt'])

    await wrapper.getComponent({ name: 'Toolbar' }).vm.$emit('batch-delete')
    await flushPromises()

    expect(mockedConfirm).toHaveBeenCalled()
    expect(mockedBatchDelete).toHaveBeenCalledWith(['/a.txt'])
    expect(ElMessage.success).toHaveBeenCalledWith('成功删除 1 个文件/文件夹')
    expect(fileStore.selectedFiles).toEqual([])
    expect(mockedGetFiles).toHaveBeenCalledTimes(2)
  })

  it('选中删除：取消后不调用 batchDeleteFiles', async () => {
    mockedConfirm.mockRejectedValue(new Error('cancel'))
    const wrapper = await mountView()
    const fileStore = useFileStore()
    fileStore.setSelectedFiles(['/a.txt'])

    await wrapper.getComponent({ name: 'Toolbar' }).vm.$emit('batch-delete')
    await flushPromises()
    expect(mockedBatchDelete).not.toHaveBeenCalled()
  })

  it('未选中删除 → 提示请先选择文件', async () => {
    const wrapper = await mountView()
    await wrapper.getComponent({ name: 'Toolbar' }).vm.$emit('batch-delete')
    await flushPromises()
    expect(ElMessage.warning).toHaveBeenCalledWith('请先选择文件')
    expect(mockedConfirm).not.toHaveBeenCalled()
  })

  it('行右键 → 打开 ContextMenu', async () => {
    const wrapper = await mountView()
    expect(wrapper.find('.context-menu-stub').exists()).toBe(false)
    const fakeEvent = { preventDefault: vi.fn(), stopPropagation: vi.fn(), clientX: 100, clientY: 100 }
    await wrapper.getComponent({ name: 'FileTable' }).vm.$emit('contextmenu', fakeEvent, fileA)
    await flushPromises()
    expect(fakeEvent.preventDefault).toHaveBeenCalled()
    expect(wrapper.find('.context-menu-stub').exists()).toBe(true)
  })

  it('双击打开文件夹 → navigateInto 重新加载对应路径', async () => {
    const wrapper = await mountView()
    mockedGetFiles.mockClear()
    mockedGetFiles.mockResolvedValue({ path: 'dirb', files: [] })
    await wrapper.getComponent({ name: 'FileTable' }).vm.$emit('open', 'dirb')
    await flushPromises()
    expect(mockedGetFiles).toHaveBeenCalledWith('dirb')
  })

  it('离开页面 unmount → 清空选中状态，避免残留', async () => {
    const wrapper = await mountView()
    const fileStore = useFileStore()
    fileStore.setSelectedFiles(['/a.txt'])
    expect(fileStore.selectedFiles).toEqual(['/a.txt'])

    wrapper.unmount()

    expect(fileStore.selectedFiles).toEqual([])
  })

  it('返回主页：离开时写入记忆，重新挂载恢复进入其他页面前的路径', async () => {
    // 模拟后端原样返回请求路径
    mockedGetFiles.mockImplementation(async (p: string) => ({ path: p, files: [] }))
    const first = await mountView()
    // 进入子目录 dirb（等价用户停留在该目录）
    await first.getComponent({ name: 'FileTable' }).vm.$emit('open', 'dirb')
    await flushPromises()
    // 卸载（进入设置页）时写入当前路径到 sessionStorage
    first.unmount()

    expect(sessionStorage.getItem(STORAGE_KEY_FILE_PATH)).toBe('dirb')
    // 从设置页返回 → HomeView 重新挂载，应恢复 dirb 而非回到根目录
    mockedGetFiles.mockClear()
    await mountView()
    expect(mockedGetFiles).toHaveBeenCalledWith('dirb')
    // 记忆用后即焚：读取后清空，后续刷新/再挂载不再恢复
    expect(sessionStorage.getItem(STORAGE_KEY_FILE_PATH)).toBeNull()
  })

  it('返回主页：无记忆残留（直接刷新场景）→ 从根目录开始', async () => {
    // 无任何记忆：等效于用户在主页直接刷新（onBeforeUnmount 未执行，无写入）
    await mountView()
    expect(mockedGetFiles).toHaveBeenCalledWith('')
  })

  it('返回主页：记忆路径已失效 → 回退根目录并消费记忆', async () => {
    sessionStorage.setItem(STORAGE_KEY_FILE_PATH, 'gone')
    mockedGetFiles.mockRejectedValueOnce(new Error('路径不存在'))
    const wrapper = await mountView()
    // 第一次带记忆路径失败 → 回退根目录（第二次调用，成功返回 path:''）
    expect(mockedGetFiles).toHaveBeenNthCalledWith(1, 'gone')
    expect(mockedGetFiles).toHaveBeenNthCalledWith(2, '')
    // 记忆已消费
    expect(sessionStorage.getItem(STORAGE_KEY_FILE_PATH)).toBeNull()
  })
})
