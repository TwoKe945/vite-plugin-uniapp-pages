import dbg from'debug'

export const VITE_PLUGIN_NAME = `vite-plugin-uniapp-pages` as const;

export const PAGE_CONFIG_EXTENSIONS = ['ts', 'mts', 'cts', 'json', 'js', 'mjs', 'cjs']
export const FILE_EXTENSIONS = ['vue', 'nvue', 'uvue']

function withModuleName(name: string) {
  return `${VITE_PLUGIN_NAME}:${name}`
}

export const DEBUG = {
  hmr: dbg(withModuleName('hmr')),
  cache: dbg(withModuleName('cache')),
  options: dbg(withModuleName('options')),
  pages: dbg(withModuleName('pages')),
  subPages: dbg(withModuleName('subPages')),
  declaration: dbg(withModuleName('declaration')),
  resolve
}
export type DebugType = keyof Omit< typeof DEBUG, 'resolve'>

function resolve(option?: boolean | DebugType[]) {
  if (!option) return
  if (typeof option === 'boolean') {
    dbg.enable('*')
    return
  }else if (typeof option === 'object'){
    option.forEach(name =>{
      DEBUG[name].enabled = true;
    })
    return
  }
}


