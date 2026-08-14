/**
 * demo 内置插件配置
 *
 * `DEMO_PLUGINS` 是 demo 场景的"已安装本地插件"清单：以插件名称（name）为配置项，
 * 命中的插件会作为本地包（source=local）出现在插件管理页的"已安装"列表中，
 * 并由 pluginLoader 在启动时加载其静态前端 bundle（entry 相对 import.meta.env.BASE_URL）。
 */
export interface DemoPluginConfig {
  /** 插件短名（config.yml 键名，同时作为列表展示名） */
  name: string
  /** package.json 版本号 */
  version: string
  /** 静态前端入口，相对 demo base（/file-manager/） */
  entry: string
}

export const DEMO_PLUGINS: DemoPluginConfig[] = [
  {
    name: 'hatsune-miku-theme',
    version: '0.1.0',
    entry: 'plugins/hatsune-miku-theme/frontend.js',
  },
]

/** demo 默认主题（无用户偏好时应用） */
export const DEMO_DEFAULT_THEME = 'hatsune-miku'
