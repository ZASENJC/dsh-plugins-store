import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'

import { createInstallHandler, installRepository } from '../src/installer.js'

function createRequest({
  method = 'POST',
  headers = {
    'content-type': 'application/json',
    host: '127.0.0.1:3080',
    origin: 'http://127.0.0.1:3080',
  },
  body = JSON.stringify({ fullName: 'owner/repository' }),
} = {}) {
  const request = new EventEmitter()
  request.method = method
  request.headers = headers
  request.socket = { remoteAddress: '127.0.0.1' }
  request.send = () => {
    if (body !== null) request.emit('data', Buffer.from(body))
    request.emit('end')
  }
  return request
}

function createResponse() {
  const headers = new Map()
  return {
    body: null,
    headers,
    statusCode: null,
    setHeader(name, value) {
      headers.set(name.toLowerCase(), value)
    },
    end(body) {
      this.body = JSON.parse(body)
    },
  }
}

async function dispatch(handler, options) {
  const request = createRequest(options)
  const response = createResponse()
  const handled = handler(request, response)
  request.send()
  await handled
  return response
}

describe('host-side repository installation', () => {
  it('uses the DSH launcher with fixed argv and never constructs a shell command', async () => {
    const runner = vi.fn().mockResolvedValue({
      stdout: 'installed',
      stderr: '',
    })
    const signal = new AbortController().signal

    const result = await installRepository('owner/repository', {
      runner,
      execPath: '/usr/bin/node',
      cliPath: '/opt/dsh/bin.js',
      signal,
    })

    expect(runner).toHaveBeenCalledWith('/usr/bin/node', [
      '/opt/dsh/bin.js',
      'plugin',
      '--profile',
      'web',
      'add',
      'github:owner/repository',
    ], signal)
    expect(result).toEqual({ output: 'installed' })
  })

  it.each([
    '',
    'owner',
    'owner/repo/extra',
    'owner/repo; touch unsafe',
    '../owner/repo',
  ])('rejects an unsafe repository name before invoking the runner: %s', async (fullName) => {
    const runner = vi.fn()

    await expect(installRepository(fullName, {
      runner,
      execPath: '/usr/bin/node',
      cliPath: '/opt/dsh/bin.js',
      signal: new AbortController().signal,
    })).rejects.toThrow('仓库名称无效')
    expect(runner).not.toHaveBeenCalled()
  })

  it('rejects an incomplete host runner configuration', async () => {
    await expect(installRepository('owner/repository', {
      runner: null,
      execPath: '/usr/bin/node',
      cliPath: '/opt/dsh/bin.js',
      signal: new AbortController().signal,
    })).rejects.toThrow('DSH 安装器不可用')
  })
})

describe('plugin installation HTTP handler', () => {
  it('allows only POST requests', async () => {
    const install = vi.fn()
    const response = await dispatch(createInstallHandler({ install }), {
      method: 'GET',
      body: null,
    })

    expect(response.statusCode).toBe(405)
    expect(response.headers.get('allow')).toBe('POST')
    expect(response.body).toEqual({ ok: false, message: '仅支持 POST' })
    expect(install).not.toHaveBeenCalled()
  })

  it('accepts only JSON request bodies', async () => {
    const install = vi.fn()
    const response = await dispatch(createInstallHandler({ install }), {
      headers: {
        'content-type': 'text/plain',
        host: '127.0.0.1:3080',
      },
    })

    expect(response.statusCode).toBe(415)
    expect(response.body).toEqual({ ok: false, message: '仅接受 JSON 请求' })
    expect(install).not.toHaveBeenCalled()
  })

  it('rejects cross-origin installation requests', async () => {
    const install = vi.fn()
    const response = await dispatch(createInstallHandler({ install }), {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        host: '127.0.0.1:3080',
        origin: 'https://attacker.example',
      },
    })

    expect(response.statusCode).toBe(403)
    expect(response.body).toEqual({ ok: false, message: '拒绝跨来源安装请求' })
    expect(install).not.toHaveBeenCalled()
  })

  it('rejects requests without a loopback transport peer', async () => {
    const install = vi.fn()
    const request = createRequest()
    delete request.socket
    const rejectedResponse = createResponse()
    const handled = createInstallHandler({ install })(request, rejectedResponse)
    request.send()
    await handled

    expect(rejectedResponse.statusCode).toBe(403)
    expect(install).not.toHaveBeenCalled()
  })

  it('rejects requests without an origin proof', async () => {
    const install = vi.fn()
    const request = createRequest({
      headers: {
        'content-type': 'application/json',
        host: '127.0.0.1:3080',
      },
    })
    const rejectedResponse = createResponse()
    const handled = createInstallHandler({ install })(request, rejectedResponse)
    request.send()
    await handled

    expect(rejectedResponse.statusCode).toBe(403)
    expect(install).not.toHaveBeenCalled()
  })

  it.each([
    ['invalid JSON', '{'],
    ['invalid repository', JSON.stringify({ fullName: 'owner/repo; unsafe' })],
    ['oversized request', JSON.stringify({ fullName: `owner/${'r'.repeat(4097)}` })],
  ])('rejects an %s payload', async (_label, body) => {
    const install = vi.fn()
    const response = await dispatch(createInstallHandler({ install }), { body })

    expect(response.statusCode).toBe(400)
    expect(response.body.ok).toBe(false)
    expect(install).not.toHaveBeenCalled()
  })

  it('returns the installed repository and restart requirement', async () => {
    const install = vi.fn().mockResolvedValue({ output: 'installed' })
    const response = await dispatch(createInstallHandler({ install }))

    expect(install).toHaveBeenCalledWith('owner/repository')
    expect(response.statusCode).toBe(200)
    expect(response.body).toEqual({
      ok: true,
      repository: 'owner/repository',
      needsRestart: true,
      output: 'installed',
    })
  })

  it('reports host installation failures without leaking an exception', async () => {
    const install = vi.fn().mockRejectedValue(new Error('host failed'))
    const response = await dispatch(createInstallHandler({ install }))

    expect(response.statusCode).toBe(502)
    expect(response.body).toEqual({ ok: false, message: 'host failed' })
  })

  it('rejects a second installation while the first is still running', async () => {
    let finishInstall
    const install = vi.fn(() => new Promise((resolve) => {
      finishInstall = resolve
    }))
    const handler = createInstallHandler({ install })
    const firstRequest = createRequest()
    const firstResponse = createResponse()
    const firstHandled = handler(firstRequest, firstResponse)
    firstRequest.send()
    await vi.waitFor(() => expect(install).toHaveBeenCalledOnce())

    const secondResponse = await dispatch(handler)
    expect(secondResponse.statusCode).toBe(409)
    expect(secondResponse.body).toEqual({
      ok: false,
      message: '已有插件正在安装，请稍后重试',
    })

    finishInstall({ output: 'installed' })
    await firstHandled
    expect(firstResponse.statusCode).toBe(200)
  })
})
