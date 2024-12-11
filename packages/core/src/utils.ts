import { join, resolve } from 'path'
import { PageMetaDatum, UniAppPagesOptions, UniAppPagesReslovedOptions} from './types'
import JSON5 from 'json5'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { slash } from '@antfu/utils'
import groupBy from 'lodash.groupby'
import fg from 'fast-glob'
import { ViteDevServer } from 'vite'
import { parse as VueParser } from '@vue/compiler-sfc'
import type { SFCDescriptor } from '@vue/compiler-sfc'

const UNI_PAGES_DTS = 'uni-pages.d.ts'
export const OUT_DIR_PATH = 'src'
export const PAGES_JSON_NAME = 'pages.json'

export function resolvePageDirs(dir: string, root: string, exclude: string[]): string[] {
  const dirs = fg.sync(slash(dir), {
    ignore: exclude,
    onlyDirectories: true,
    dot: true,
    unique: true,
    cwd: root,
  })
  return dirs
}
export function resolveOptions(options: UniAppPagesOptions = {}, root: string = process.cwd()): UniAppPagesReslovedOptions {
  let { 
    dts = `${OUT_DIR_PATH}/${UNI_PAGES_DTS}`,
    debug = false,
    outDir = OUT_DIR_PATH,
    dir= 'src/pages',
    exclude = ['node_modules', '.git', '**/__*__/**'],
    subPackages = []
  } = options
  root = slash(root)
  // 解析 pages.json
  const pagesJsonPath = slash(resolve(root, outDir, PAGES_JSON_NAME))
  const pagesJsonContent = readFileSync(pagesJsonPath, { encoding: 'utf-8'})
  const pagesJson = JSON5.parse(pagesJsonContent.toString())
  const resolvedDirs = resolvePageDirs(dir, root, exclude)
  subPackages = subPackages.map(v => slash(join(outDir, v)))

  return {
    root,
    dts: dts || undefined,
    debug,
    outDir,
    pagesJsonPath,
    pagesJson,
    dirs: resolvedDirs,
    subPackages,
    exclude
  }
}
export function invalidatePagesModule(server: ViteDevServer) {
  // const { moduleGraph } = server
  // const mods = moduleGraph.getModulesByFile(RESOLVED_MODULE_ID_VIRTUAL)
  // if (mods) {
  //   const seen = new Set<ModuleNode>()
  //   mods.forEach((mod) => {
  //     moduleGraph.invalidateModule(mod, seen)
  //   })
  // }
}

export function checkPagesJsonFile(path: string) {
  if (!existsSync(path)) {
    writeFileSync(path, JSON.stringify({ pages: [{ path: '' }] }, null, 2))
    return false
  }
  return true
}

export function extsToGlob(extensions: string[]) {
  return extensions.length > 1 ? `{${extensions.join(',')}}` : (extensions[0] || '')
}


/**
 * merge page meta data array by path and assign style
 * @param pageMetaData  page meta data array
 */
export function mergePageMetaDataArray(pageMetaData: PageMetaDatum[]) {
  const pageMetaDataObj = groupBy(pageMetaData, 'path')
  const result: PageMetaDatum[] = []
  for (const path in pageMetaDataObj) {
    const _pageMetaData = pageMetaDataObj[path]
    const options = _pageMetaData[0]
    for (const page of _pageMetaData) {
      options.style = Object.assign(options.style ?? {}, page.style ?? {})
      Object.assign(options, page)
    }
    result.push(options)
  }
  return result
}

export async function parseSFC(code: string): Promise<SFCDescriptor> {
  try {
    return (
      VueParser(code, {
        pad: 'space',
      }).descriptor
      // for @vue/compiler-sfc ^2.7
      || (VueParser as any)({
        source: code,
      })
    )
  }
  catch (error) {
    throw new Error(`[vite-plugin-uniapp-pages] Vue3's "@vue/compiler-sfc" is required. \nOriginal error: \n${error}`)
  }
}
