const REPOSITORY_ID = /^[A-Za-z0-9][A-Za-z0-9:_./-]{0,127}$/
const REPOSITORY_FULL_NAME = /^[A-Za-z0-9](?:[A-Za-z0-9_.-]{0,99})\/[A-Za-z0-9](?:[A-Za-z0-9_.-]{0,99})$/
const NPM_PACKAGE = /^(?:@[A-Za-z0-9](?:[A-Za-z0-9._-]{0,99})\/)?[A-Za-z0-9](?:[A-Za-z0-9._-]{0,99})(?:@[A-Za-z0-9^~<>=*+._-][A-Za-z0-9^~<>=*+._-]{0,127})?$/
const MAX_BODY_BYTES = 4096

function assertInstallPlan(plan) {
  if (plan === null || typeof plan !== 'object' || plan.executable !== true) {
    throw new Error('安装计划不可执行')
  }
  if (plan.source !== 'github' && plan.source !== 'npm') {
    throw new Error('安装来源无效')
  }
  if (typeof plan.target !== 'string') throw new Error('安装目标无效')
  if (!Array.isArray(plan.args)
    || plan.args.length !== 5
    || plan.args[0] !== 'plugin'
    || plan.args[1] !== '--profile'
    || plan.args[2] !== 'web'
    || plan.args[3] !== 'add'
    || typeof plan.args[4] !== 'string') {
    throw new Error('安装参数无效')
  }

  const specifier = plan.args[4]
  if (plan.source === 'github') {
    const reference = /^github:([^#]+)(?:#([A-Za-z0-9][A-Za-z0-9_.:-]{0,127}))?$/i.exec(specifier)
    if (!reference || !REPOSITORY_FULL_NAME.test(reference[1])
      || reference[1].toLowerCase() !== plan.target.toLowerCase()) {
      throw new Error('GitHub 安装目标无效')
    }
  } else {
    const packageName = specifier.startsWith('npm:') ? specifier.slice(4) : specifier
    if (!NPM_PACKAGE.test(packageName) || packageName !== plan.target) {
      throw new Error('npm 安装目标无效')
    }
  }

  return {
    source: plan.source,
    target: plan.target,
    args: [...plan.args],
  }
}

function assertRepositoryId(repositoryId) {
  if (typeof repositoryId !== 'string' || !REPOSITORY_ID.test(repositoryId)) {
    throw new Error('目录项目 ID 无效')
  }
}

function sendJson(response, status, body) {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Cache-Control', 'no-store')
  response.end(JSON.stringify(body))
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = ''
    let exceeded = false
    request.on('data', (chunk) => {
      if (exceeded) return
      body += chunk.toString('utf8')
      if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
        exceeded = true
        reject(new Error('请求内容过大'))
      }
    })
    request.on('end', () => {
      if (exceeded) return
      try {
        resolve(JSON.parse(body))
      } catch {
        reject(new Error('请求内容不是有效 JSON'))
      }
    })
    request.on('error', reject)
  })
}

function isLoopbackAddress(address) {
  if (typeof address !== 'string') return false
  const normalized = address.replace(/^::ffff:/i, '')
  return normalized === '::1' || normalized === '127.0.0.1' || normalized === '0:0:0:0:0:0:0:1'
}

function isLocalHost(value) {
  if (typeof value !== 'string') return false
  try {
    const hostname = new URL(`http://${value}`).hostname
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '::1'
  } catch {
    return false
  }
}

function isAuthorizedRequest(request) {
  if (!isLoopbackAddress(request.socket?.remoteAddress)) return false
  if (!isLocalHost(request.headers.host)) return false

  const origin = request.headers.origin
  if (typeof origin !== 'string' || origin.length === 0) return false
  try {
    return new URL(origin).host === request.headers.host
  } catch {
    return false
  }
}

export async function installPlan(plan, {
  runner,
  execPath,
  cliPath,
  signal,
}) {
  const safePlan = assertInstallPlan(plan)
  if (typeof runner !== 'function' || !execPath || !cliPath) {
    throw new Error('DSH 安装器不可用')
  }

  const { stdout, stderr } = await runner(execPath, [cliPath, ...safePlan.args], signal)
  const output = [stdout, stderr]
    .map((value) => value.trim())
    .filter(Boolean)
    .join('\n')

  return {
    source: safePlan.source,
    target: safePlan.target,
    output: output.slice(-8000),
  }
}

export function createInstallHandler({ install }) {
  let installing = false

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
      sendJson(response, 403, { ok: false, message: '拒绝跨来源安装请求' })
      return
    }

    let repositoryId
    let plan
    try {
      const body = await readJsonBody(request)
      repositoryId = body?.repositoryId
      plan = body?.install
      assertRepositoryId(repositoryId)
      plan = assertInstallPlan(plan)
    } catch (error) {
      sendJson(response, 400, {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      })
      return
    }

    if (installing) {
      sendJson(response, 409, { ok: false, message: '已有插件正在安装，请稍后重试' })
      return
    }

    installing = true
    try {
      const result = await install({ repositoryId, ...plan })
      sendJson(response, 200, {
        ok: true,
        repositoryId,
        source: plan.source,
        target: plan.target,
        needsRestart: true,
        output: result.output,
      })
    } catch (error) {
      sendJson(response, 502, {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      })
    } finally {
      installing = false
    }
  }
}
