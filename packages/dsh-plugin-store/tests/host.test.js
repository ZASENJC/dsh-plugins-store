import { describe, expect, it, vi } from 'vitest'

import { apply, inject, name } from '../src/index.js'

describe('DSH host command', () => {
  it('registers a model-free /store command that opens the browser-owned surface', () => {
    const register = vi.fn()
    apply({ commands: { register } })

    expect(name).toBe('dsh-plugin-store')
    expect(inject).toEqual(['commands'])
    expect(register).toHaveBeenCalledOnce()

    const definition = register.mock.calls[0][0]
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
