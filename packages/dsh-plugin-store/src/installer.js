const REPOSITORY_FULL_NAME = /^[A-Za-z0-9](?:[A-Za-z0-9_.-]{0,99})\/[A-Za-z0-9](?:[A-Za-z0-9_.-]{0,99})$/
const MAX_BODY_BYTES = 4096

function assertRepositoryFullName(fullName) {
  if (typeof fullName !== 'string' || !REPOSITORY_FULL_NAME.test(fullName)) {
    throw new Error('仓库名称无效')
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

function isSameOrigin(request) {
  const origin = request.headers.origin
  if (origin === undefined) return true
  try {
    return new URL(origin).host === request.headers.host
  } catch {
    return false
  }
}

export async function installRepository(fullName, {
  runner,
  execPath,
  cliPath,
  signal,
}) {
  assertRepositoryFullName(fullName)
  if (typeof runner !== 'function' || !execPath || !cliPath) {
    throw new Error('DSH 安装器不可用')
  }

  const { stdout, stderr } = await runner(execPath, [
    cliPath,
    'plugin',
    '--profile',
    'web',
    'add',
    `github:${fullName}`,
  ], signal)
  const output = [stdout, stderr]
    .map((value) => value.trim())
    .filter(Boolean)
    .join('\n')

  return { output: output.slice(-8000) }
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
    if (!isSameOrigin(request)) {
      sendJson(response, 403, { ok: false, message: '拒绝跨来源安装请求' })
      return
    }

    let fullName
    try {
      const body = await readJsonBody(request)
      fullName = body?.fullName
      assertRepositoryFullName(fullName)
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
      const result = await install(fullName)
      sendJson(response, 200, {
        ok: true,
        repository: fullName,
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
