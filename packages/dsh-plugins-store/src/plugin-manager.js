import { readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

import {
  INSTALLED_PLUGIN_LIST_ARGS,
  buildInstalledPluginSnapshot,
  getInstalledPluginRemoveTarget,
  parseInstalledPluginList,
} from './installed-plugins.js'
import { isAuthorizedLocalRequest, isAuthorizedRequest, readJsonBody, sendJson } from './installer.js'

const REMOVE_PLUGIN_ARGS = Object.freeze([
  'plugin', '--profile', 'web', '--config.ignore-scripts=true', 'remove',
])
const REMOVE_TIMEOUT_MS = 120_000

function assertRunnerConfig({ runner, execPath, cliPath }) {
  if (typeof runner !== 'function' || !execPath || !cliPath) {
    throw new Error('DSH 插件管理器不可用')
  }
}

function commandOutput(result) {
  return [result?.stdout, result?.stderr]
    .map((value) => typeof value === 'string' ? value.trim() : '')
    .filter(Boolean)
    .join('\n')
    .slice(-8000)
}

function resolveWebProfileDir(env = process.env, userHome = homedir()) {
  const configured = env.DSH_HOME?.trim()
  const root = configured === undefined || configured.length === 0
    ? join(userHome, '.dsh')
    : configured === '~'
      ? userHome
      : configured.startsWith('~/') || configured.startsWith('~\\')
        ? join(userHome, configured.slice(2))
        : configured
  return join(resolve(root), 'profiles', 'web')
}

async function readProfileManifest(profileDir) {
  const value = JSON.parse(await readFile(join(profileDir, 'package.json'), 'utf8'))
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Web profile 清单无效')
  }
  return value
}

async function writeProfileManifest(profileDir, manifest) {
  await writeFile(join(profileDir, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`)
}

function withBundles(manifest, bundles) {
  return {
    ...manifest,
    dsh: {
      ...manifest.dsh,
      profile: {
        ...manifest.dsh?.profile,
        bundles,
      },
    },
  }
}

function profileBundles(manifest) {
  const bundles = manifest.dsh?.profile?.bundles
  if (!Array.isArray(bundles) || !bundles.every((entry) => typeof entry === 'string')) {
    throw new Error('Web profile bundle 清单无效')
  }
  return bundles
}

async function prepareRemoval(target, { profileDir, readManifest, writeManifest }) {
  const manifest = await readManifest(profileDir)
  const bundles = profileBundles(manifest)
  const bundleIndex = bundles.indexOf(target)
  if (bundleIndex === -1) return { bundleIndex }
  await writeManifest(profileDir, withBundles(manifest, bundles.filter((entry) => entry !== target)))
  return { bundleIndex }
}

async function settleRemoval(target, prepared, { profileDir, readManifest, writeManifest }) {
  const manifest = await readManifest(profileDir)
  const dependencies = manifest.dependencies ?? {}
  const dependencyPresent = Object.prototype.hasOwnProperty.call(dependencies, target)
  const bundles = profileBundles(manifest)
  let nextBundles = bundles

  if (!dependencyPresent) {
    nextBundles = bundles.filter((entry) => entry !== target)
  } else if (prepared.bundleIndex !== -1 && !bundles.includes(target)) {
    nextBundles = [...bundles]
    nextBundles.splice(Math.min(prepared.bundleIndex, nextBundles.length), 0, target)
  }

  if (nextBundles.length !== bundles.length
    || nextBundles.some((entry, index) => entry !== bundles[index])) {
    await writeManifest(profileDir, withBundles(manifest, nextBundles))
  }
  return { removed: !dependencyPresent }
}

function removalCommand(target, { execPath, cliPath, packageManagerPath, platform, profileDir }) {
  if (platform === 'win32') {
    return { command: execPath, args: [cliPath, ...REMOVE_PLUGIN_ARGS, target] }
  }
  return {
    command: packageManagerPath,
    args: ['--dir', profileDir, '--config.ignore-scripts=true', 'remove', target],
  }
}

async function runRemovalCommand(target, options) {
  const timeout = new AbortController()
  const timeoutError = new Error(`插件卸载超过 ${Math.ceil(options.timeoutMs / 1000)} 秒`)
  const timer = setTimeout(() => timeout.abort(timeoutError), options.timeoutMs)
  timer.unref?.()
  const signal = AbortSignal.any([options.signal, timeout.signal])
  const command = removalCommand(target, options)
  try {
    return await options.runner(command.command, command.args, signal)
  } catch (error) {
    if (timeout.signal.aborted && !options.signal.aborted) throw timeoutError
    throw error
  } finally {
    clearTimeout(timer)
  }
}

export async function listInstalledPlugins({ runner, execPath, cliPath, signal }) {
  assertRunnerConfig({ runner, execPath, cliPath })
  const result = await runner(execPath, [cliPath, ...INSTALLED_PLUGIN_LIST_ARGS], signal)
  return parseInstalledPluginList(result.stdout)
}

export async function removeInstalledPlugin(name, {
  installed,
  runner,
  execPath,
  cliPath,
  signal,
  profileDir = resolveWebProfileDir(),
  packageManagerPath = 'pnpm',
  platform = process.platform,
  timeoutMs = REMOVE_TIMEOUT_MS,
  readManifest = readProfileManifest,
  writeManifest = writeProfileManifest,
}) {
  assertRunnerConfig({ runner, execPath, cliPath })
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) throw new Error('插件卸载超时设置无效')
  const snapshot = buildInstalledPluginSnapshot(installed)
  const target = getInstalledPluginRemoveTarget(snapshot, name)
  if (target === null) throw new Error('插件未安装')

  const manifestOptions = { profileDir, readManifest, writeManifest }
  const prepared = await prepareRemoval(target, manifestOptions)
  let result
  let commandError
  try {
    result = await runRemovalCommand(target, {
      runner,
      execPath,
      cliPath,
      signal,
      profileDir,
      packageManagerPath,
      platform,
      timeoutMs,
    })
  } catch (error) {
    commandError = error
  }

  const state = await settleRemoval(target, prepared, manifestOptions)
  if (!state.removed) {
    throw commandError ?? new Error('插件卸载未完成：依赖仍存在')
  }

  const recovery = commandError === undefined
    ? ''
    : '包管理器未正常结束，但依赖已移除，Web profile 已完成一致性修复。'
  return {
    name: target,
    output: [commandOutput(result), recovery].filter(Boolean).join('\n'),
  }
}

export function createInventoryHandler({ list }) {
  return async (request, response) => {
    if (request.method !== 'GET') {
      response.setHeader('Allow', 'GET')
      sendJson(response, 405, { ok: false, message: '仅支持 GET' })
      return
    }
    if (!isAuthorizedLocalRequest(request)) {
      sendJson(response, 403, { ok: false, message: '拒绝跨来源读取请求' })
      return
    }
    try {
      const plugins = await list()
      sendJson(response, 200, { ok: true, plugins })
    } catch (error) {
      sendJson(response, 502, {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }
}

export function createRemoveHandler({ remove }) {
  return async (request, response) => {
    if (request.method !== 'POST') {
      response.setHeader('Allow', 'POST')
      sendJson(response, 405, { ok: false, message: '仅支持 POST' })
      return
    }
    if (!request.headers['content-type']?.toLowerCase().startsWith('application/json')) {
      sendJson(response, 415, { ok: false, message: '仅接受 JSON 请求' })
      return
    }
    if (!isAuthorizedRequest(request)) {
      sendJson(response, 403, { ok: false, message: '拒绝跨来源移除请求' })
      return
    }

    let name
    try {
      const body = await readJsonBody(request)
      name = body?.name
      if (typeof name !== 'string' || name.length === 0) throw new Error('插件名称无效')
    } catch (error) {
      sendJson(response, 400, {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      })
      return
    }

    try {
      const result = await remove(name)
      sendJson(response, 200, { ok: true, ...result, needsRestart: true })
    } catch (error) {
      sendJson(response, 502, {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }
}
