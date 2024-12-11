import { FILE_EXTENSIONS } from "./constants"
import { UniAppPagesReslovedOptions } from "./types"
import fg from 'fast-glob'
import { extsToGlob } from "./utils"


/**
 * Resolves the files that are valid pages for the given context.
 */
export function getPageFiles(path: string, options: UniAppPagesReslovedOptions): string[] {
  const { exclude } = options

  const ext = extsToGlob(FILE_EXTENSIONS)

  const files = fg.sync(`**/*.${ext}`, {
    ignore: exclude,
    onlyFiles: true,
    cwd: path,
  })

  return files
}
