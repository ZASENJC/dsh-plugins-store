import { EventEmitter } from 'node:events'

import { describe, expect, it, vi } from 'vitest'

import {
  createInventoryHandler,
  createRemoveHandler,
  listInstalledPlugins,
  removeInstalledPlugin,
} from '../src/plugin-manager.js'

function createRequest({ method = 'GET', body = null, headers = {} } = {}) {
  const request = new EventEmitter()
  request.method = method
  request.headers = {
    host: '127.0.0.1:3080',
    origin: 'http://127.0.0.1:3080',
    'content-type': 'application/json',
    ...headers,
  }
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
    setHeader(name, value) { headers.set(name.toLowerCase(), value) },
    end(body) { this.body = JSON.parse(body) },
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

describe('local plugin manager', () => {
  function profileManifest({ installed = true, bundled = true } = {}) {
    return {
      dependencies: installed ? { 'dsh-example': '^1.0.0' } : {},
      dsh: { profile: { bundles: bundled ? ['dsh-base', 'dsh-example'] : ['dsh-base'] } },
    }
  }

  it('reads the profile dependency list through fixed dsh CLI arguments', async () => {
    const runner = vi.fn().mockResolvedValue({
      stdout: JSON.stringify([{ name: 'profile', dependencies: { 'dsh-example': { version: '1.0.0' } } }]),
      stderr: '',
    })

    await expect(listInstalledPlugins({
      runner,
      execPath: '/usr/bin/node',
      cliPath: '/opt/dsh/bin.js',
      signal: new AbortController().signal,
    })).resolves.toEqual([{ name: 'dsh-example', version: '1.0.0' }])
    expect(runner).toHaveBeenCalledWith('/usr/bin/node', [
      '/opt/dsh/bin.js', 'plugin', '--profile', 'web', 'list', '--depth=0', '--json',
    ], expect.any(AbortSignal))
  })

  it('removes only a named direct dependency without running package scripts', async () => {
    const runner = vi.fn().mockResolvedValue({ stdout: 'removed', stderr: '' })
    const readManifest = vi.fn()
      .mockResolvedValueOnce(profileManifest())
      .mockResolvedValueOnce(profileManifest({ installed: false, bundled: false }))
    const writeManifest = vi.fn().mockResolvedValue(undefined)
    await expect(removeInstalledPlugin('dsh-example', {
      installed: [{ name: 'dsh-example', version: '1.0.0' }],
      runner,
      execPath: '/usr/bin/node',
      cliPath: '/opt/dsh/bin.js',
      signal: new AbortController().signal,
      profileDir: '/profile',
      platform: 'darwin',
      readManifest,
      writeManifest,
    })).resolves.toMatchObject({ name: 'dsh-example', output: 'removed' })
    expect(runner).toHaveBeenCalledWith('pnpm', [
      '--dir', '/profile', '--config.ignore-scripts=true', 'remove', 'dsh-example',
    ], expect.any(AbortSignal))
    expect(writeManifest).toHaveBeenCalledWith('/profile', profileManifest({ bundled: false }))
  })

  it('repairs a half-finished removal when pnpm fails after deleting the dependency', async () => {
    const runner = vi.fn().mockRejectedValue(new Error('pnpm failed'))
    const readManifest = vi.fn()
      .mockResolvedValueOnce(profileManifest())
      .mockResolvedValueOnce(profileManifest({ installed: false }))
    const writeManifest = vi.fn().mockResolvedValue(undefined)

    await expect(removeInstalledPlugin('dsh-example', {
      installed: [{ name: 'dsh-example', version: '1.0.0' }],
      runner,
      execPath: '/usr/bin/node',
      cliPath: '/opt/dsh/bin.js',
      signal: new AbortController().signal,
      profileDir: '/profile',
      platform: 'darwin',
      readManifest,
      writeManifest,
    })).resolves.toMatchObject({
      name: 'dsh-example',
      output: expect.stringContaining('Web profile 已完成一致性修复'),
    })
    expect(writeManifest).toHaveBeenLastCalledWith('/profile', profileManifest({ installed: false, bundled: false }))
  })

  it('keeps the DSH CLI fallback script-free on Windows', async () => {
    const runner = vi.fn().mockResolvedValue({ stdout: 'removed', stderr: '' })
    const readManifest = vi.fn()
      .mockResolvedValueOnce(profileManifest())
      .mockResolvedValueOnce(profileManifest({ installed: false, bundled: false }))

    await removeInstalledPlugin('dsh-example', {
      installed: [{ name: 'dsh-example', version: '1.0.0' }],
      runner,
      execPath: 'C:\\node.exe',
      cliPath: 'C:\\dsh\\bin.js',
      signal: new AbortController().signal,
      profileDir: 'C:\\dsh-home\\profiles\\web',
      platform: 'win32',
      readManifest,
      writeManifest: vi.fn().mockResolvedValue(undefined),
    })

    expect(runner).toHaveBeenCalledWith('C:\\node.exe', [
      'C:\\dsh\\bin.js', 'plugin', '--profile', 'web',
      '--config.ignore-scripts=true', 'remove', 'dsh-example',
    ], expect.any(AbortSignal))
  })

  it('times out a stuck removal and restores the bundle when the dependency remains', async () => {
    const runner = vi.fn((_command, _args, signal) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true })
    }))
    const readManifest = vi.fn()
      .mockResolvedValueOnce(profileManifest())
      .mockResolvedValueOnce(profileManifest({ bundled: false }))
    const writeManifest = vi.fn().mockResolvedValue(undefined)

    await expect(removeInstalledPlugin('dsh-example', {
      installed: [{ name: 'dsh-example', version: '1.0.0' }],
      runner,
      execPath: '/usr/bin/node',
      cliPath: '/opt/dsh/bin.js',
      signal: new AbortController().signal,
      profileDir: '/profile',
      platform: 'darwin',
      timeoutMs: 5,
      readManifest,
      writeManifest,
    })).rejects.toThrow('插件卸载超过 1 秒')
    expect(writeManifest).toHaveBeenLastCalledWith('/profile', profileManifest())
  })

  it('rejects remove requests for dependencies absent from the current inventory', async () => {
    const runner = vi.fn()
    await expect(removeInstalledPlugin('other-package', {
      installed: [{ name: 'dsh-example' }],
      runner,
      execPath: '/usr/bin/node',
      cliPath: '/opt/dsh/bin.js',
      signal: new AbortController().signal,
    })).rejects.toThrow('插件未安装')
    expect(runner).not.toHaveBeenCalled()
  })

  it('serves an inventory JSON response and reports remove failures without leaking exceptions', async () => {
    const list = vi.fn().mockResolvedValue([{ name: 'dsh-example', version: '1.0.0' }])
    const inventoryResponse = await dispatch(createInventoryHandler({ list }), {
      method: 'GET',
      headers: { origin: undefined },
    })
    expect(inventoryResponse.statusCode).toBe(200)
    expect(inventoryResponse.body).toEqual({ ok: true, plugins: [{ name: 'dsh-example', version: '1.0.0' }] })

    const remove = vi.fn().mockRejectedValue(new Error('pnpm failed'))
    const removeResponse = await dispatch(createRemoveHandler({ remove }), {
      method: 'POST',
      body: JSON.stringify({ name: 'dsh-example' }),
    })
    expect(removeResponse.statusCode).toBe(502)
    expect(removeResponse.body).toEqual({ ok: false, message: 'pnpm failed' })
  })
})
