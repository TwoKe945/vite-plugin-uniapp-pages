import type { Plugin, ResolvedConfig } from 'vite'
import { VITE_PLUGIN_NAME } from './constants'
import { UniAppPagesOptions } from './types'
import { UniAppPagesContext } from './context'
import { createLogger } from 'vite'
import { checkPagesJsonFile, OUT_DIR_PATH , PAGES_JSON_NAME } from './utils'
import path from 'path'
import { spawn } from 'child_process'
import { watch } from 'chokidar'

export * from './types'
export * from './context'

async function restart() {
  return new Promise((resolve) => {
    const build = spawn(process.argv.shift()!, process.argv, {
      cwd: process.env.VITE_ROOT_DIR || process.cwd(),
      detached: true,
      env: process.env,
    })
    build.stdout?.pipe(process.stdout)
    build.stderr?.pipe(process.stderr)
    build.on('close', (code) => {
      resolve(process.exit(code!))
    })
  })
}

export function UniAppPages(options?: UniAppPagesOptions) {
  let ctx: UniAppPagesContext;

  const resolvedPagesJSONPath = path.join(
    process.env.VITE_ROOT_DIR || process.cwd(),
    options?.outDir ?? OUT_DIR_PATH,
    PAGES_JSON_NAME,
  )
  const isValidated = checkPagesJsonFile(resolvedPagesJSONPath)

  return {
    name: VITE_PLUGIN_NAME,
    enforce: 'pre',
    async configResolved(config: ResolvedConfig) {
      ctx = new UniAppPagesContext(options, config.root)
      const logger = createLogger(undefined, {
        prefix: '[vite-plugin-uniapp-pages]',
      })
      ctx.setLogger(logger)
      await ctx.updatePagesJSON()

      if (config.command === 'build') {
        if (!isValidated) {
          ctx.logger?.warn('In build mode, if `pages.json` does not exist, the plugin cannot create the complete `pages.json` before the uni-app, so it restarts the build.', {
            timestamp: true,
          })
          await restart()
        }

        if (config.build.watch)
          ctx.setupWatcher(watch([...ctx.options.dirs, ...ctx.options.subPackages]) as any)
      }
    },
    configureServer(server) {
      ctx.setupViteServer(server)
    },

    transform(code, id, options) {
      return ctx.transform(code, id, options)
    },

  } as Plugin<any>
}


export default UniAppPages
