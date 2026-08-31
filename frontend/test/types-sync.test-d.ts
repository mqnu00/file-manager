/**
 * 插件发布类型一致性测试（vitest typecheck，*.test-d.ts）
 *
 * 背景：前端包为 private 不发布 npm，插件编译期使用的类型入口
 * `@mqn00/file-manager/plugin/frontend` 由 backend 包发布，其源码
 * backend/src/plugin/frontend-types.ts 为手工维护的"插件可见视图"
 * （见文件头 @keep-in-sync 清单，漂移防线即本文件）。
 *
 * 本文件用 expectTypeOf 断言发布类型与 frontend/src 真实类型保持一致：
 * 任何漂移——成员增删、签名变更、返回类型变化——都会在 vitest typecheck
 * 阶段编译失败。配置见 vitest.config.ts 的 test.typecheck（tsconfig 指向 test/tsconfig.json），
 * CI 的 `npx vitest run` 自动覆盖，无需额外命令。
 *
 * 断言策略：
 * - 数据类型副本（TaskInfo/FileItem/…）：toEqualTypeOf，要求结构完全一致
 * - 模块/接口视图（composables/platform/utils/constants/router/PluginRouteRecord）：
 *   双向 toMatchTypeOf，互为兼容视图（readonly / 额外成员差异宽容，
 *   成员集与签名漂移零容忍）
 * - 单向（发布 = 真实面的子集契约）：
 *   - api 模块：真实模块含实现性导出（如 export default api），发布接口不声明
 *   - stores：真实 pinia store 含 $state/$patch 等框架内部成员，发布接口为公共子集
 * - 例外：NavAction.icon 发布侧故意放宽为 unknown（类型门面设计），只做真实→发布单向断言
 */

import { expectTypeOf, test } from 'vitest'
import type { UnwrapRef } from 'vue'

/** 强制 true 的类型断言助手（漂移时编译失败并报 'FAIL'） */
type Assert<T extends 'ok'> = T

// ==================== 真实类型（frontend/src） ====================

import type {
  TaskInfo,
  FileItem,
  TaskStatus,
  TaskPhase,
  TaskType,
  MoveTaskMetadata,
  CompressTaskMetadata,
} from '@/types'
import type { FileIOReadResult } from '@/api/fileIO'
import type { ScriptContext, PluginRouteRecord as RealPluginRouteRecord } from '@/context'
import type {
  FileOpenApi as RealFileOpenApi,
  FileOpenHandler as RealFileOpenHandler,
} from '@/platform/fileOpen'
import type {
  NavAction as RealNavAction,
  NavActionsApi as RealNavActionsApi,
} from '@/pluginNav'
import type {
  BulkAction as RealBulkAction,
  BulkActionContext as RealBulkActionContext,
  BulkActionVisibility as RealBulkActionVisibility,
  BulkActionsApi as RealBulkActionsApi,
} from '@/pluginActions'

/** 真实 API 模块命名空间类型（type 位置引用，无运行时导入） */
type RealAuthApi = typeof import('@/api/auth')
type RealFileApi = typeof import('@/api/file')
type RealFileIOApi = typeof import('@/api/fileIO')
type RealConfigApi = typeof import('@/api/config')
type RealTaskApi = typeof import('@/api/task')
type RealFormatApi = typeof import('@/utils/format')

/**
 * 真实 store 类型（UnwrapRef 解包）：
 * pinia setup store 的 ReturnType 保留 Ref/ComputedRef 声明（如
 * `initialized: Ref<boolean, boolean>`），而运行时经 store 代理访问是
 * 已解包的值；发布接口（AuthStore/FileStore/TaskStore）描述的是运行时视图，
 * 故真实侧需 UnwrapRef 对齐。
 */
type RealAuthStore = UnwrapRef<ReturnType<typeof import('@/stores/auth').useAuthStore>>
type RealFileStore = UnwrapRef<ReturnType<typeof import('@/stores/file').useFileStore>>
type RealTaskStore = UnwrapRef<ReturnType<typeof import('@/stores/task').useTaskStore>>

/** 真实 composable 返回类型（composable 返回的是原始 ref，不解包） */
type RealTheme = ReturnType<typeof import('@/composables/useTheme').useTheme>
type RealContextMenu = ReturnType<typeof import('@/composables/useContextMenu').useContextMenu>
type RealFileProgress = ReturnType<typeof import('@/composables/useFileProgress').useFileProgress>
type RealFileSort = ReturnType<typeof import('@/composables/useFileSort').useFileSort>

// ==================== 发布类型（backend/src/plugin/frontend-types.ts） ====================

import type {
  TaskInfo as PublishedTaskInfo,
  FileItem as PublishedFileItem,
  TaskStatus as PublishedTaskStatus,
  TaskPhase as PublishedTaskPhase,
  TaskType as PublishedTaskType,
  MoveTaskMetadata as PublishedMoveTaskMetadata,
  CompressTaskMetadata as PublishedCompressTaskMetadata,
  FileIOReadResult as PublishedFileIOReadResult,
  AuthStore,
  FileStore,
  TaskStore,
  AuthApi,
  FileApi,
  FileIOApi,
  ConfigApi,
  TaskApi,
  ThemeComposable,
  ContextMenuComposable,
  FileProgressComposable,
  FileSortComposable,
  FileOpenApi,
  FileOpenHandler,
  NavAction,
  NavActionsApi,
  BulkAction,
  BulkActionContext,
  BulkActionVisibility,
  BulkActionsApi,
  PluginRouteRecord,
  FrontendPluginContext,
} from '../../backend/src/plugin/frontend-types'

// ==================== 断言 ====================

test('数据类型：发布副本与真实类型完全一致', () => {
  expectTypeOf<TaskStatus>().toEqualTypeOf<PublishedTaskStatus>()
  expectTypeOf<TaskPhase>().toEqualTypeOf<PublishedTaskPhase>()
  expectTypeOf<TaskType>().toEqualTypeOf<PublishedTaskType>()
  expectTypeOf<MoveTaskMetadata>().toEqualTypeOf<PublishedMoveTaskMetadata>()
  expectTypeOf<CompressTaskMetadata>().toEqualTypeOf<PublishedCompressTaskMetadata>()
  expectTypeOf<TaskInfo>().toEqualTypeOf<PublishedTaskInfo>()
  expectTypeOf<FileItem>().toEqualTypeOf<PublishedFileItem>()
  expectTypeOf<FileIOReadResult>().toEqualTypeOf<PublishedFileIOReadResult>()
})

test('stores：真实 store（解包视图）满足发布接口（发布为公共子集，单向）', () => {
  // 仅单向：真实 pinia store 类型含 $state/$patch/$subscribe 等框架内部成员，
  // 发布接口描述的是"插件可见公共子集"（运行时经 store 代理访问为解包后的值），
  // 反向断言必然失败；发布声明了真实不存在的成员/签名不符仍会被本方向拦截。
  expectTypeOf<RealAuthStore>().toMatchTypeOf<AuthStore>()
  expectTypeOf<RealFileStore>().toMatchTypeOf<FileStore>()
  expectTypeOf<RealTaskStore>().toMatchTypeOf<TaskStore>()
})

test('api 模块：真实模块满足发布接口（发布为真实导出面的子集契约）', () => {
  // 仅单向：真实模块命名空间含实现性导出（如 file.ts/fileIO.ts 的 export default api），
  // 发布接口不声明这些内部便捷导出；漂移（发布声明了不存在的成员/签名不符）仍会被拦截
  expectTypeOf<RealAuthApi>().toMatchTypeOf<AuthApi>()
  expectTypeOf<RealFileApi>().toMatchTypeOf<FileApi>()
  expectTypeOf<RealFileIOApi>().toMatchTypeOf<FileIOApi>()
  expectTypeOf<RealConfigApi>().toMatchTypeOf<ConfigApi>()
  expectTypeOf<RealTaskApi>().toMatchTypeOf<TaskApi>()
})

test('composables：发布返回类型与真实实现双向兼容', () => {
  expectTypeOf<RealTheme>().toMatchTypeOf<ThemeComposable>()
  expectTypeOf<ThemeComposable>().toMatchTypeOf<RealTheme>()
  expectTypeOf<RealContextMenu>().toMatchTypeOf<ContextMenuComposable>()
  expectTypeOf<ContextMenuComposable>().toMatchTypeOf<RealContextMenu>()
  expectTypeOf<RealFileProgress>().toMatchTypeOf<FileProgressComposable>()
  expectTypeOf<FileProgressComposable>().toMatchTypeOf<RealFileProgress>()
  expectTypeOf<RealFileSort>().toMatchTypeOf<FileSortComposable>()
  expectTypeOf<FileSortComposable>().toMatchTypeOf<RealFileSort>()
})

test('platform.fileOpen：发布视图与真实注册表一致', () => {
  expectTypeOf<RealFileOpenApi>().toMatchTypeOf<FileOpenApi>()
  expectTypeOf<FileOpenApi>().toMatchTypeOf<RealFileOpenApi>()
  expectTypeOf<RealFileOpenHandler>().toMatchTypeOf<FileOpenHandler>()
  expectTypeOf<FileOpenHandler>().toMatchTypeOf<RealFileOpenHandler>()
})

test('pluginNav：真实导航项与发布视图双向一致（icon 均为 vue Component）', () => {
  expectTypeOf<RealNavAction>().toMatchTypeOf<NavAction>()
  expectTypeOf<NavAction>().toMatchTypeOf<RealNavAction>()
})

test('平台注册表 bulk/nav：发布 API 与真实实现完整双向（无门面豁免）', () => {
  // 纯数据入参：结构完全一致
  expectTypeOf<RealBulkActionVisibility>().toEqualTypeOf<BulkActionVisibility>()
  expectTypeOf<RealBulkActionContext>().toEqualTypeOf<BulkActionContext>()
  // 操作定义与注册表 API：双向兼容
  expectTypeOf<RealBulkAction>().toMatchTypeOf<BulkAction>()
  expectTypeOf<BulkAction>().toMatchTypeOf<RealBulkAction>()
  expectTypeOf<RealBulkActionsApi>().toMatchTypeOf<BulkActionsApi>()
  expectTypeOf<BulkActionsApi>().toMatchTypeOf<RealBulkActionsApi>()
  // nav：icon 已统一为 vue Component（发布侧 import type { Component } from 'vue'），
  // 不再存在门面豁免，恢复完整双向
  expectTypeOf<RealNavActionsApi>().toMatchTypeOf<NavActionsApi>()
  expectTypeOf<NavActionsApi>().toMatchTypeOf<RealNavActionsApi>()
})

test('window 全局扩展：主项目 env.d.ts 与发布入口声明合并后一致（可选属性）', () => {
  // 两侧（frontend/src/env.d.ts + 发布入口 frontend-types.ts 的 declare global）
  // 对同一 Window 属性做 interface 合并，类型不一致会直接编译失败；
  // 此处显式断言兜底并锁定"可选属性"契约
  expectTypeOf<Window['__fm_bulk_actions']>().toEqualTypeOf<BulkActionsApi | undefined>()
  expectTypeOf<Window['__fm_nav_actions']>().toEqualTypeOf<NavActionsApi | undefined>()
  expectTypeOf<Window['__fm_file_open']>().toEqualTypeOf<FileOpenApi | undefined>()
})

test('utils：真实格式化工具模块与发布视图双向兼容', () => {
  type PublishedUtilsApi = FrontendPluginContext['utils']
  expectTypeOf<RealFormatApi>().toMatchTypeOf<PublishedUtilsApi>()
  expectTypeOf<PublishedUtilsApi>().toMatchTypeOf<RealFormatApi>()
})

test('constants：真实 ctx 常量与发布视图完全一致', () => {
  type PublishedConstants = FrontendPluginContext['constants']
  expectTypeOf<ScriptContext['constants']>().toEqualTypeOf<PublishedConstants>()
})

test('路由声明：PluginRouteRecord 双向一致', () => {
  expectTypeOf<RealPluginRouteRecord>().toMatchTypeOf<PluginRouteRecord>()
  expectTypeOf<PluginRouteRecord>().toMatchTypeOf<RealPluginRouteRecord>()
})

test('ctx：真实 ctx 满足发布契约，发布视图不声明真实 ctx 没有的成员（stores 除外）', () => {
  // 正向：发布契约的每个成员都必须存在于真实 ctx 且类型兼容
  // （真实侧 pinia store 的框架内部成员属多余成员，不影响本方向）
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  type _A1 = Assert<ScriptContext extends FrontendPluginContext ? 'ok' : 'FAIL'>
  // 反向：发布侧不得声明真实 ctx 没有的成员。
  // stores 除外——发布 store 接口是 pinia store 的公共子集（真实侧恒有
  // $state 等内部成员）；api 除外——真实 api 模块含实现性便利导出
  // （如 api/file.ts 的 api/default），发布接口不声明。二者的子集合规
  // 分别由上面 `stores：` / `api 模块：` 测试组保证
  //（发布声明了真实没有的成员会在对应正向断言中失败）
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  type _A2 = Assert<
    Omit<FrontendPluginContext, 'stores' | 'api'> extends Omit<ScriptContext, 'stores' | 'api'>
      ? 'ok'
      : 'FAIL'
  >
})
