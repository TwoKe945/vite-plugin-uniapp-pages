import type { DebugType } from './constants'
import type { GlobalStyle, UserPagesConfig } from './config'
import { PageMetaDatum, ThemeVar, TabBarIconFont} from './config'
import { S } from 'vitest/dist/chunks/config.Cy0C388Z.js'

export * from './config'

export interface UniAppPagesOptions {
  /**
   * dts配置
   *
   * @default 'src/uni-pages.d.ts'
   */
  dts?: false | string
  /**
   * 是否开启调试
   *
   * @default false
   */
  debug?: boolean | DebugType[]
  /**
   * 输出目录
   * @default 'src'
   */
  outDir?: string
  /**
   * 页面文件夹
   *
   * @default 'src/pages'
   */
  dir?: string
  /**
   * 子包路径
   *
   * @default []
   */
  subPackages?: string[]
  /**
   * 排除目录
   * @default ['node_modules', '.git', '**\/__*__\/**']
   */
  exclude?: string[]
}

export interface UniAppPagesReslovedOptions {
  root: string,
  dts: string | undefined,
  debug: boolean | DebugType[]
  outDir: string,
  pagesJsonPath: string,
  pagesJson: UserPagesConfig,
  dirs: string[],
  subPackages: string[]
  exclude: string[]
}


export interface PagePath {
  relativePath: string
  absolutePath: string
}

export interface PageTabBar {

  /**
   * tab 上按钮文字，在 App 和 H5 平台为非必填，例如中间可放一个没有文字的 + 号图标
   */
  text?: string

  /**
   * 图片路径，icon 大小限制为 40 kb，建议尺寸为 81px * 81px
   *
   * 当 position 为 "top" 时，此参数无效
   *
   * 不支持网络图片，不支持字体图标
   */
  iconPath?: string | ThemeVar

  /**
   * 选中时的图片路径，icon 大小限制为 40 kb，建议尺寸为 81px * 81px
   *
   * 当 position 为 "top" 时，此参数无效
   *
   * 不支持网络图片，不支持字体图标
   */
  selectedIconPath?: string | ThemeVar

  /**
   * 该项是否显示，默认显示
   *
   * @desc App (3.2.10+)、H5 (3.2.10+)
   */
  visible?: boolean

  /**
   * 字体图标，优先级高于 iconPath
   *
   * @desc App（3.4.4+）、H5 (3.5.3+)
   */
  iconfont?: TabBarIconFont
}

export type SpiltPageConfig = PageMetaDatum & {
  tabBar?: boolean | number | PageTabBar
}

export interface UserSpiltPageConfig {
  pages: SpiltPageConfig[]
}


export function definePage(config: UserSpiltPageConfig) {
  return config
}
export function defineUniPages(config: UserPagesConfig) {
  return config
}


export interface RouteConfig {
    /**
     * 配置页面路径
     */
    type?: string
    /**
     * 配置页面窗口表现，配置项参考下方 pageStyle
     */
    style?: GlobalStyle
    /**
     * 当前页面是否需要登录才可以访问，此配置优先级高于 uniIdRouter 下的 needLogin
     */
    needLogin?: boolean

    tabBar?: boolean | number | PageTabBar
}
export function defineRoute(config: RouteConfig) {}
