/**
 * playground 调试脚本
 * 1、获取所有 playground 名字 以及可执行脚本命令
 * 2、选择一个 playground 执行
 */
import fg from 'fast-glob'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cwd } from 'node:process'
import { execSync } from 'child_process'
import inquirer from 'inquirer'
import JSON5 from 'json5'
const root = cwd()

function getPlaygrounds() {
  const playgrounds = fg.sync(['playgrounds/*/package.json'], { cwd: root, onlyFiles: true })
  const playgroundsInfo = playgrounds.map(p => {
    const packageContent = readFileSync(resolve(root, p), { encoding: 'utf-8'})
    const pkg = JSON5.parse(packageContent)
    return {
      name: pkg.name,
      scripts: Object.keys(pkg.scripts || {} )
    }
  }).filter(item => item.scripts.length != 0)
  return playgroundsInfo
}

async function main() {
  const playgrounds = getPlaygrounds()
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'playground',
      message: '请选择要调试的 playground',
      choices: playgrounds.map(item => item.name)
    }
  ])
  if (!answers.playground) return
  const playground = playgrounds.find(item => item.name === answers.playground)
  if (!playground || !playground.scripts) return
  const scriptsAnswers = await inquirer.prompt([
    {
      type: 'list',
      name: 'script',
      message: '请选择要调试的脚本',
      choices: playground.scripts
    }
  ])
  if (!scriptsAnswers.script) return
  execSync(`pnpm  -F ${answers.playground} ${scriptsAnswers.script}`, { stdio: 'inherit' })
}

main();

