import { DEBUG, FILE_EXTENSIONS, PAGE_CONFIG_EXTENSIONS } from './constants'
import { UniAppPagesOptions, UniAppPagesReslovedOptions, SpiltPageConfig, UserSpiltPageConfig, UserPagesConfig, PagePath, PageMetaDatum, SubPageMetaDatum, TabBar, TabBarItem } from './types'
import { checkPagesJsonFile, invalidatePagesModule, mergePageMetaDataArray, PAGES_JSON_NAME, parseSFC, resolveOptions } from './utils'
import { type ViteDevServer, type FSWatcher, type Logger, normalizePath } from 'vite'
import { loadConfig } from 'unconfig'
import { slash } from '@antfu/utils'
import path, { basename, dirname, extname, join } from 'path'
import fg from 'fast-glob'
import { getPageFiles } from './files'
import { writeFileSync } from 'node:fs'
import { readFileSync } from 'fs'
import Merge from 'lodash.merge'
import MagicString from 'magic-string'
import { useCachedPages } from './cached'
import { writeDeclaration } from './declaration'

const { setCache, hasChanged, cleanCache }  = useCachedPages()

let latestPagesJson = ''
export function isTargetFile(path: string) {
  const ext = path.split('.').pop()
  return FILE_EXTENSIONS.includes(ext!)
}

export function isPageConfigFile(path: string) {
  const filename =  basename(path)
  const ext = path.split('.').pop()
  if (!PAGE_CONFIG_EXTENSIONS.includes(ext!)) return true
  return `page.config.${ext}` === filename || `vite.config.${ext}` === filename || `pages.config.${ext}` === filename
}

export class UniAppPagesContext {
  
  private _server: ViteDevServer | undefined = undefined
  private _logger: Logger | undefined = undefined
  private _options: UniAppPagesOptions
  private _resolvedOptions: UniAppPagesReslovedOptions
  private _splitPageConfigSources: string[] = []
  private _splitPageData: SpiltPageConfig[] = []
  private _globalPagesConfigSources: string[] = []
  private _globalPageData: UserPagesConfig = {}

  constructor(options?: UniAppPagesOptions, root: string = process.cwd()) {
    this._options = options || {}
    this._resolvedOptions = resolveOptions(Object.assign({}, this._options), root)
    DEBUG.resolve(this._resolvedOptions.debug)
    DEBUG.options('root %s', root)
    DEBUG.options('options %O', this._resolvedOptions)
  }

  get logger() {
    return this._logger
  }
  get options() {
    return this._resolvedOptions
  }

  setupViteServer(server: ViteDevServer) {
    if (this._server === server)
      return
    this._server = server
    this.setupWatcher(server.watcher)
  }

  
  setLogger(logger: Logger) {
    this._logger = logger
  }

  setupWatcher(watcher: FSWatcher) {
    watcher.add(this._splitPageConfigSources)
    watcher.add(this._globalPagesConfigSources)
    const targetDirs = [...this.options.dirs, ...this.options.subPackages].map(item => slash(path.resolve(this.options.root, item)))
    const isInTargetDirs = (filePath: string) => targetDirs.some(v => slash(path.resolve(this.options.root, filePath)).startsWith(v))

    watcher.on('add', async (path) => {
      path = slash(path)
      if (!isTargetFile(path))
        return
      if (!isPageConfigFile(path))
        return
      if (!isInTargetDirs(path))
        return

      DEBUG.pages(`File added: ${path}`)
      if (await this.updatePagesJSON())
        this.onUpdate()
    })

    watcher.on('change', async (path) => {
      path = slash(path)
      if (!isTargetFile(path))
        return
      if (!isInTargetDirs(path))
        return
      DEBUG.pages(`File changed: ${path}`)
      DEBUG.pages(targetDirs)
      DEBUG.pages(isInTargetDirs(path))
      if (await this.updatePagesJSON(path))
        this.onUpdate()
    })

    watcher.on('change', async (path) => {
      if (this._globalPagesConfigSources.includes(path) || this._splitPageConfigSources.includes(path)) {
        DEBUG.pages(`Config source changed: ${path}`)
        if (await this.updatePagesJSON())
          this.onUpdate()
      }
    })

    watcher.on('unlink', async (path) => {
      path = slash(path)
      if (!isTargetFile(path))
        return
      if (!isPageConfigFile(path))
        return
      if (!isInTargetDirs(path))
        return
      DEBUG.pages(`File removed: ${path}`)
      if (await this.updatePagesJSON())
        this.onUpdate()
    })
  }

  /**
   * 加载拆分页面配置文件
   */
  async loadSplitPageConfigs() {
    const files = fg.sync('**/page.config.*', {
      ignore: ['**/node_modules/**'],
      onlyFiles: true,
      cwd: this.options.outDir,
    }).map(path => dirname(path))
    DEBUG.pages('split page config %O', files)
    let _sources: string[] = []
    let _pages: SpiltPageConfig[] = []
    let loadedSourcePath: string[] = []
    for (const path of files) {
      if (loadedSourcePath.includes(path))
        continue
      const pageConfigPath = slash(join(this.options.root, this.options.outDir, path))
      const { config, sources } = await loadConfig<UserSpiltPageConfig>({ cwd: pageConfigPath, sources: [
        { files: 'page.config' }
      ], defaults: { pages: [] } })
      DEBUG.pages('config %O', config)
      _pages = _pages.concat(config.pages)
      _sources = _sources.concat(sources)
      loadedSourcePath.push(path)
    }
    this._splitPageConfigSources = _sources.map(path => slash(path))
    this._splitPageData = _pages
  }

  /**
   * 加载全局配置文件
   */
  async loadUserPagesConfig() {
    const { config, sources } = await loadConfig<UserPagesConfig>({ cwd: this.options.root, sources: [
      { files: 'pages.config' },
      {
        files: 'vite.config',
        rewrite(config) {
          return (config as any)?.UniPages
        },
      }
    ], defaults: { pages: [] }, merge: false})
    DEBUG.pages('config %O', config)
    this._globalPagesConfigSources = sources.map(path => slash(path))
    this._globalPageData = config
  }

  onUpdate() {
    if (!this._server)
      return

    invalidatePagesModule(this._server)
    DEBUG.hmr('Reload generated pages.')
    this._server.ws.send({
      type: 'full-reload',
    })
  }

  private _pagesPath: PagePath[] = []
  private _subPagesPath: Record<string, PagePath[]> = {}
  private _pageMetaData: PageMetaDatum[] = []
  private _subPageMetaData: SubPageMetaDatum[] = []
  private _loadedPagePath:string[] = []

  async scanPages() {
    const pageDirFiles = this.options.dirs.map((dir) => {
      return { dir, files: getPagePaths(dir, this.options) }
    })
    this._pagesPath = pageDirFiles.map(page => page.files).flat()
    DEBUG.pages("scanPages %O", this._pagesPath)
  }

  async scanSubPages() {
    const subPagesPath: Record<string, PagePath[]> = {}
    for (const dir of this.options.subPackages) {
      const pagePaths = getPagePaths(dir, this.options)
      subPagesPath[dir] = pagePaths
    }
    this._subPagesPath = subPagesPath
    DEBUG.subPages("scanPages %O",this._subPagesPath)
  }

  private _tabBar: Map<string, TabBarItem> = new Map()

  parseTabBar(data: SpiltPageConfig) {
    if (this._tabBar.has(data.path)) return
    if (typeof data.tabBar === 'boolean' && data.tabBar) {
      this._tabBar.set(data.path, {
        pagePath: data.path,
        text: data.style?.navigationBarTitleText || '无标题',
        order: 1
      })
      return
    }
    if (typeof data.tabBar === 'number') {
      this._tabBar.set(data.path, {
        pagePath: data.path,
        text: data.style?.navigationBarTitleText || '无标题',
        order: data.tabBar
      })
      return
    }
    if (typeof data.tabBar === 'object') {
      this._tabBar.set(data.path, {
        pagePath: data.path,
        text: data.style?.navigationBarTitleText || '无标题',
        order: 1,
        ...data.tabBar
      })
    }
  }

  async parsePage(page: PagePath): Promise<PageMetaDatum | false> {
    const { relativePath, absolutePath } = page
    const code =  readFileSync(absolutePath,{ encoding: 'utf-8' })
    const ret = await parseSFC(code)
    const content = (ret.script || ret.scriptSetup)?.content || ''
    const match =content.match(/defineRoute\(\s*({[^)]*})\s*\)/)
    let pageMetaDatum: any = {};
    if (match) {
      DEBUG.pages(`found route: ${match[1]}`)
      pageMetaDatum = Object.assign(pageMetaDatum, new Function(`return ${match[1]}`)())
    }
    if (Object.keys(pageMetaDatum).length === 0) return false;
    setCache(absolutePath, JSON.stringify(pageMetaDatum))
    const relativePathWithFileName = relativePath.replace(path.extname(relativePath), '')
    pageMetaDatum = {
      path: normalizePath(relativePathWithFileName),
      ...pageMetaDatum
    };

    if (pageMetaDatum.tabBar || pageMetaDatum.tabBar === 0) {
      this.parseTabBar(pageMetaDatum)
      delete pageMetaDatum.tabBar
    }
    return pageMetaDatum
  }

  /**
   * set home page
   * @param result pages rules array
   * @returns pages rules
   */
  setHomePage(result: PageMetaDatum[]): PageMetaDatum[] {
    const hasHome = result.some(({ type }) => type === 'home')
    if (!hasHome) {
      this.logger?.warn('No home page found', {
        timestamp: true,
      })
    }
    result.sort(page => (page.type === 'home' ? -1 : 0))
    return result
  }

   /**
   * parse pages rules && set page type
   * @param pages page path array
   * @param type  page type
   * @param overrides custom page config
   * @returns pages rules
   */
   async parsePages(pages: PagePath[], type: 'main' | 'sub', overrides?: PageMetaDatum[]) {
    const generatedPageMetaData = (await Promise.all(pages.map(async page => await this.parsePage(page)))).filter(Boolean) as PageMetaDatum[]
    const customPageMetaData = overrides || []

    const result = customPageMetaData.length
      ? mergePageMetaDataArray(generatedPageMetaData.concat(customPageMetaData))
      : generatedPageMetaData

    const parseMeta = result.filter((page, index, self) =>
      self.findLastIndex(item => page.path === item.path) === index,
    )

    return type === 'main' ? this.setHomePage(parseMeta) : parseMeta
  }

  async mergePageMetaData() {
    const pageMetaData = await this.parsePages(this._pagesPath, 'main', this._globalPageData?.pages)

    this._pageMetaData = pageMetaData
    DEBUG.pages(this._pageMetaData)
  }

  async mergeSubPageMetaData() {
    const subPageMaps: Record<string, PageMetaDatum[]> = {}
    const subPackages = this._globalPageData?.subPackages || []

    for (const [dir, pages] of Object.entries(this._subPagesPath)) {
      const basePath = slash(path.join(this.options.root, this.options.outDir))
      const root = slash(path.relative(basePath, path.join(this.options.root, dir)))

      const globPackage = subPackages?.find(v => v.root === root)
      subPageMaps[root] = await this.parsePages(pages, 'sub', globPackage?.pages)
      subPageMaps[root] = subPageMaps[root].map(page => ({ ...page, path: slash(path.relative(root, page.path)) }))
    }

    // Inherit subPackages that do not exist in the config
    for (const { root, pages } of subPackages) {
      if (root && !subPageMaps[root])
        subPageMaps[root] = pages || []
    }

    const subPageMetaData = Object.keys(subPageMaps)
      .map(root => ({ root, pages: subPageMaps[root] }))
      .filter(meta => meta.pages.length > 0)

    this._subPageMetaData = subPageMetaData
    DEBUG.subPages('subPages %O', this._subPageMetaData)
  }

  async transform(code: string, id: string, options: { ssr?: boolean } | undefined) {
    if (!isTargetFile(id)) return
    const relativePath =  slash(path.relative(slash(path.join(this.options.root, this.options.outDir)), id))
    DEBUG.pages("_loadedPagePath %O", this._loadedPagePath, relativePath)
    if(!this._loadedPagePath.includes(relativePath)) return
    const sfc = await parseSFC(code)
    const block = sfc.script || sfc.scriptSetup  || { content: '' }
    if (!block || !block.content) return
    let changed = false;
    const matchBlocks = block.content.matchAll(/defineRoute\(\s*({[^)]*})\s*\)/g)
    for (const match of matchBlocks) {
      code = code.replace(match[0], "")
      changed = true;
    }
    let ms = new MagicString(code)
    if (changed) {
      return {
          code: ms.toString(),
          map: ms.generateMap({
              source: id,
              includeContent: true,
              file: `${id}.map`,
          }),
      }
    }
  }
  get subPageMetaData() {
    return this._subPageMetaData
  }
  get pageMetaData() {
    return this._pageMetaData
  }
  get globalPageData() {
    return this._globalPageData
  }

  async updatePagesJSON(filepath?: string) {
    if (filepath) {
      if (!await hasChanged(filepath)) {
        DEBUG.cache(`The route block on page ${filepath} did not send any changes, skipping`)
        return false
      }
    }
    cleanCache()
    this._tabBar.clear();
    checkPagesJsonFile(this.options.pagesJsonPath)

    await this.loadUserPagesConfig()

    await this.loadSplitPageConfigs()

    await this.scanPages()
    await this.scanSubPages()

    await this.mergePageMetaData()
    await this.mergeSubPageMetaData()

    const pagesMap = new Map()
    const pages =  this._pageMetaData
    pages.forEach(v => pagesMap.set(v.path, v))
    this._pageMetaData = [...pagesMap.values()]

    const data = {
      ...this._globalPageData,
      pages: this._pageMetaData,
      subPackages: this._subPageMetaData,
    };

    if (this._tabBar.size > 0) {
      data.tabBar = data.tabBar || {
        color: '#aaaaaa',
        selectedColor: '#000000'
      } as any
      data.tabBar!.list = mergeTabBarList(data.tabBar?.list || [] as any, this._tabBar);
    }
    const newPagesJson = JSON.stringify(data, null, 2)
    this._loadedPagePath = []
    this._pagesPath.forEach(item => {
      this._loadedPagePath.push(item.relativePath)
    })
   Object.values(this._subPagesPath).forEach(items => {
      items.forEach(item => {
        this._loadedPagePath.push(item.relativePath)
      })
    })
    if (latestPagesJson == newPagesJson)
    {
      DEBUG.pages('PagesJson Not have change')
      return false
    }
    this.generateDeclaration()
    latestPagesJson = newPagesJson;
    writeFileSync(this.options.pagesJsonPath, newPagesJson)
    return true
  }
  generateDeclaration() {
    if (!this.options.dts)
      return

    DEBUG.declaration('generating')
    return writeDeclaration(this, this.options.dts)
  }
}

function mergeTabBarList(tabBarList: TabBarItem[], tabBars: Map<string, TabBarItem>): [TabBarItem, TabBarItem, TabBarItem?, TabBarItem?, TabBarItem?] {
  const origin = tabBarList.reduce((acc: any, item) => {
    acc[item.pagePath] = item
    return acc
  }, {})
  const needAdd: any[] = [];
  tabBars.forEach((item, key) => {
    if (!(origin as any)[item.pagePath]) {
      needAdd.push(item)
    } else {
      (origin as any)[key] = Merge((origin as any)[item.pagePath], item)
    }
  })
  
  return tabBarList.concat(needAdd).sort((a,b) => (a.order || 0 ) -( b.order || 0)).map(item => {delete item.order; return item;}) as any
}



function getPagePaths(dir: string, options: UniAppPagesReslovedOptions) {
  const pagesDirPath = slash(path.resolve(options.root, dir))
  const basePath = slash(path.join(options.root, options.outDir))
  const files = getPageFiles(pagesDirPath, options)
  DEBUG.pages(dir, files)
  const pagePaths = files
    .map(file => slash(file))
    .map(file => ({
      relativePath: slash(path.relative(basePath, slash(path.resolve(pagesDirPath, file)))),
      absolutePath: slash(path.resolve(pagesDirPath, file)),
    }))

  return pagePaths
}
