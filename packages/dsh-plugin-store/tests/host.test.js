import { describe, expect, it, vi } from 'vitest'

import { apply, inject, name } from '../src/index.js'

describe('DSH host command', () => {
  it('registers a model-free /store command that opens the browser-owned surface', () => {
    const registerCommand = vi.fn()
    const registerRoute = vi.fn(() => vi.fn())
    apply({
      commands: { register: registerCommand },
      webServer: { register: registerRoute },
    })

    expect(name).toBe('dsh-plugin-store')
    expect(inject).toEqual(['commands', 'webServer'])
    expect(registerCommand).toHaveBeenCalledOnce()
    expect(registerRoute).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'exact',
      path: '/api/dsh-plugin-store/install',
      handler: expect.any(Function),
    }))

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
