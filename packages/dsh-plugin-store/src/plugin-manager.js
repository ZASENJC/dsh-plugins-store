import {
  INSTALLED_PLUGIN_LIST_ARGS,
  buildInstalledPluginSnapshot,
  getInstalledPluginRemoveTarget,
  parseInstalledPluginList,
} from './installed-plugins.js'
import { isAuthorizedLocalRequest, isAuthorizedRequest, readJsonBody, sendJson } from './installer.js'

const REMOVE_PLUGIN_ARGS = Object.freeze(['plugin', '--profile', 'web', 'remove'])

function assertRunnerConfig({ runner, execPath, cliPath }) {
  if (typeof runner !== 'function' || !execPath || !cliPath) {
    throw new Error('DSH 插件管理器不可用')
  }
}

function commandOutput(result) {
  return [result.stdout, result.stderr]
    .map((value) => typeof value === 'string' ? value.trim() : '')
    .filter(Boolean)
    .join('\n')
    .slice(-8000)
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
}) {
  assertRunnerConfig({ runner, execPath, cliPath })
  const snapshot = buildInstalledPluginSnapshot(installed)
  const target = getInstalledPluginRemoveTarget(snapshot, name)
  if (target === null) throw new Error('插件未安装')

  const result = await runner(execPath, [cliPath, ...REMOVE_PLUGIN_ARGS, target], signal)
  return { name: target, output: commandOutput(result) }
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
