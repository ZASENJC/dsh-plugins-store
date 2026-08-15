import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'

import { createInstallHandler, installPlan } from '../src/installer.js'

const githubPlan = {
  source: 'github',
  target: 'owner/repository',
  args: ['plugin', '--profile', 'web', 'add', `github:owner/repository#${'a'.repeat(40)}`],
  executable: true,
}

function createRequest({
  method = 'POST',
  headers = {
    'content-type': 'application/json',
    host: '127.0.0.1:3080',
    origin: 'http://127.0.0.1:3080',
  },
  body = JSON.stringify({ repositoryId: 'github:1', install: githubPlan }),
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

describe('host-side structured installation', () => {
  it('uses fixed argv for a pinned GitHub plan and never constructs a shell command', async () => {
    const runner = vi.fn().mockResolvedValue({ stdout: 'installed', stderr: '' })
    const signal = new AbortController().signal

    const result = await installPlan(githubPlan, {
      runner,
      execPath: '/usr/bin/node',
      cliPath: '/opt/dsh/bin.js',
      signal,
    })

    expect(runner).toHaveBeenCalledWith('/usr/bin/node', [
      '/opt/dsh/bin.js',
      ...githubPlan.args,
    ], signal)
    expect(result).toEqual({
      source: 'github',
      target: 'owner/repository',
      output: 'installed',
    })
  })

  it('supports an explicitly declared npm source through the DSH pnpm forwarder', async () => {
    const runner = vi.fn().mockResolvedValue({ stdout: 'installed npm', stderr: '' })
    const plan = {
      source: 'npm',
      target: 'dsh-example',
      args: ['plugin', '--profile', 'web', 'add', 'npm:dsh-example'],
      executable: true,
    }

    await installPlan(plan, {
      runner,
      execPath: '/usr/bin/node',
      cliPath: '/opt/dsh/bin.js',
      signal: new AbortController().signal,
    })

    expect(runner).toHaveBeenCalledWith('/usr/bin/node', [
      '/opt/dsh/bin.js',
      ...plan.args,
    ], expect.any(AbortSignal))
  })

  it.each([
    { ...githubPlan, target: '' },
    { ...githubPlan, target: 'owner/repo;unsafe' },
    { ...githubPlan, executable: false },
    { source: 'npm', target: 'dsh-example', args: ['plugin', '--profile', 'web', 'add', 'npm:dsh-example;unsafe'], executable: true },
  ])('rejects an unsafe or malformed plan before invoking the runner', async (plan) => {
    const runner = vi.fn()

    await expect(installPlan(plan, {
      runner,
      execPath: '/usr/bin/node',
      cliPath: '/opt/dsh/bin.js',
      signal: new AbortController().signal,
    })).rejects.toThrow()
    expect(runner).not.toHaveBeenCalled()
  })

  it.each([
    ['github:owner/repository', 'owner/repository'],
    ['github:owner/repository#v1.2.3', 'owner/repository'],
  ])('accepts a README GitHub reference without requiring a validation SHA', async (specifier, target) => {
    const runner = vi.fn().mockResolvedValue({ stdout: 'installed', stderr: '' })
    const plan = {
      source: 'github',
      target,
      args: ['plugin', '--profile', 'web', 'add', specifier],
      executable: true,
    }

    await installPlan(plan, {
      runner,
      execPath: '/usr/bin/node',
      cliPath: '/opt/dsh/bin.js',
      signal: new AbortController().signal,
    })

    expect(runner).toHaveBeenCalledWith('/usr/bin/node', ['/opt/dsh/bin.js', ...plan.args], expect.any(AbortSignal))
  })

  it('rejects an incomplete host runner configuration', async () => {
    await expect(installPlan(githubPlan, {
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
    const response = await dispatch(createInstallHandler({ install }), { method: 'GET', body: null })

    expect(response.statusCode).toBe(405)
    expect(response.headers.get('allow')).toBe('POST')
    expect(response.body).toEqual({ ok: false, message: '仅支持 POST' })
    expect(install).not.toHaveBeenCalled()
  })

  it('accepts only JSON request bodies and same-origin loopback requests', async () => {
    const install = vi.fn()
    const contentResponse = await dispatch(createInstallHandler({ install }), {
      headers: { 'content-type': 'text/plain', host: '127.0.0.1:3080' },
    })
    expect(contentResponse.statusCode).toBe(415)

    const originResponse = await dispatch(createInstallHandler({ install }), {
      headers: {
        'content-type': 'application/json',
        host: '127.0.0.1:3080',
        origin: 'https://attacker.example',
      },
    })
    expect(originResponse.statusCode).toBe(403)
    expect(install).not.toHaveBeenCalled()
  })

  it.each([
    ['invalid JSON', '{'],
    ['invalid project ID', JSON.stringify({ repositoryId: 'owner repo', install: githubPlan })],
    ['missing install plan', JSON.stringify({ repositoryId: 'github:1' })],
    ['display-only plan', JSON.stringify({ repositoryId: 'github:1', install: { ...githubPlan, executable: false } })],
  ])('rejects an %s payload', async (_label, body) => {
    const install = vi.fn()
    const response = await dispatch(createInstallHandler({ install }), { body })

    expect(response.statusCode).toBe(400)
    expect(response.body.ok).toBe(false)
    expect(install).not.toHaveBeenCalled()
  })

  it('returns the installed source and target without exposing a shell command', async () => {
    const install = vi.fn().mockResolvedValue({ output: 'installed' })
    const response = await dispatch(createInstallHandler({ install }))

    expect(install).toHaveBeenCalledWith({
      repositoryId: 'github:1',
      source: 'github',
      target: 'owner/repository',
      args: githubPlan.args,
    })
    expect(response.statusCode).toBe(200)
    expect(response.body).toEqual({
      ok: true,
      repositoryId: 'github:1',
      source: 'github',
      target: 'owner/repository',
      needsRestart: true,
      output: 'installed',
    })
  })

  it('accepts the structured unpinned README plan received from the catalog API', async () => {
    const install = vi.fn().mockResolvedValue({ output: 'installed' })
    const plan = {
      source: 'github',
      target: 'owner/repository',
      command: 'dsh plugin --profile web add github:owner/repository',
      args: ['plugin', '--profile', 'web', 'add', 'github:owner/repository'],
      executable: true,
    }
    const response = await dispatch(createInstallHandler({ install }), {
      body: JSON.stringify({ repositoryId: 'github:1', install: plan }),
    })

    expect(response.statusCode).toBe(200)
    expect(install).toHaveBeenCalledWith({
      repositoryId: 'github:1',
      source: 'github',
      target: 'owner/repository',
      args: plan.args,
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
    const install = vi.fn(() => new Promise((resolve) => { finishInstall = resolve }))
    const handler = createInstallHandler({ install })
    const firstRequest = createRequest()
    const firstResponse = createResponse()
    const firstHandled = handler(firstRequest, firstResponse)
    firstRequest.send()
    await vi.waitFor(() => expect(install).toHaveBeenCalledOnce())

    const secondResponse = await dispatch(handler)
    expect(secondResponse.statusCode).toBe(409)
    expect(secondResponse.body).toEqual({ ok: false, message: '已有插件正在安装，请稍后重试' })

    finishInstall({ output: 'installed' })
    await firstHandled
    expect(firstResponse.statusCode).toBe(200)
  })
})
