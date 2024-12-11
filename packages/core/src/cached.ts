import { existsSync, readFileSync } from 'node:fs';
import { parseSFC } from './utils'
import { DEBUG } from './constants';

export function useCachedPages() {
  const cachedPages = new Map<string, string>();

  function setCache(filePath:string, config: string) {
    DEBUG.cache(`add page: ${filePath}`)
    cachedPages.set(filePath, config)
  }

  async function hasChanged(filePath: string) {
    if (!cachedPages.has(filePath)) return true
    if (!existsSync(filePath)) return true
    const code =  readFileSync(filePath, { encoding: 'utf-8' })
    const ret = await parseSFC(code)
    const content = (ret.script || ret.scriptSetup)?.content || ''
    const match = content.match(/defineRoute\(\s*({[^)]*})\s*\)/)
    if (!match) return true
    const newPages = JSON.stringify(new Function(`return ${match[1]}`)())
    if (newPages !== cachedPages.get(filePath)) {
      setCache(filePath, newPages)
      return true
    }
    return false
  }
  function cleanCache() {
    cachedPages.clear()
  }

  return {
    setCache,
    hasChanged,
    cleanCache
  }
}
