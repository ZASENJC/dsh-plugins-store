import { describe, expect, it, vi } from 'vitest'

import { apply, inject, name } from '../src/index.js'

describe('DSH host command', () => {
  it('registers a model-free /store command that opens the browser-owned surface', () => {
    const registerCommand = vi.fn()
    const registerRoute = vi.fn(() => vi.fn())
    const registerTool = vi.fn()
    const registerSkill = vi.fn()
    const on = vi.fn()
    apply({
      commands: { register: registerCommand },
      webServer: { register: registerRoute },
      tools: { register: registerTool },
      skills: { register: registerSkill },
      on,
    })

    expect(name).toBe('dsh-plugins-store')
    expect(inject).toEqual(['commands', 'webServer', 'tools', 'skills'])
    expect(registerCommand).toHaveBeenCalledOnce()
    expect(registerTool.mock.calls.map(([tool]) => tool.name)).toEqual([
      'store_search',
      'store_catalog',
      'store_details',
      'store_installed',
      'store_install',
      'store_remove',
    ])
    expect(registerSkill).toHaveBeenCalledWith(expect.objectContaining({
      name: 'search-dsh-store',
      source: 'bundled',
      content: expect.stringContaining('`store_install`'),
    }))
    expect(on).toHaveBeenCalledWith('tools/pre-execute', expect.any(Function))
    expect(registerRoute).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'exact',
      path: '/api/dsh-plugins-store/install',
      handler: expect.any(Function),
    }))
    expect(registerRoute).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'exact',
      path: '/api/dsh-plugins-store/plugins',
      handler: expect.any(Function),
    }))
    expect(registerRoute).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'exact',
      path: '/api/dsh-plugins-store/remove',
      handler: expect.any(Function),
    }))
    expect(registerRoute).toHaveBeenCalledTimes(3)

    const definition = registerCommand.mock.calls[0][0]
    expect(definition).toMatchObject({
      name: 'store',
      description: expect.any(String),
    })
    expect(definition.handler({ rawInput: '' })).toEqual({ kind: 'success' })
    expect(definition.handler({ rawInput: ' unexpected' })).toEqual({
      kind: 'error',
      text: 'Usage: /store',
    })
  })
})
