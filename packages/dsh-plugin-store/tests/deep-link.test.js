import { describe, expect, it, vi } from 'vitest'

import { consumeLocalInstallRequest } from '../src/deep-link.js'

describe('local DSH install request', () => {
  it('consumes a fragment request that survives the DSH startup router', () => {
    const replaceState = vi.fn()

    const fullName = consumeLocalInstallRequest({
      href: 'http://127.0.0.1:3080/?mode=code#view=chat&dsh-plugin-install=owner%2Fplugin',
      historyState: { retained: true },
      replaceState,
    })

    expect(fullName).toBe('owner/plugin')
    expect(replaceState).toHaveBeenCalledWith(
      { retained: true },
      '',
      '/?mode=code#view=chat',
    )
  })

  it('returns a safe repository target and removes only the consumed query parameter', () => {
    const replaceState = vi.fn()

    const fullName = consumeLocalInstallRequest({
      href: 'http://127.0.0.1:3080/?mode=code&dsh-plugin-install=owner%2Fplugin#session',
      historyState: { retained: true },
      replaceState,
    })

    expect(fullName).toBe('owner/plugin')
    expect(replaceState).toHaveBeenCalledWith(
      { retained: true },
      '',
      '/?mode=code#session',
    )
  })

  it.each([
    'owner',
    'owner/plugin/extra',
    'owner/plugin;unsafe',
  ])('consumes but rejects an unsafe repository target: %s', (fullName) => {
    const replaceState = vi.fn()
    const href = `http://127.0.0.1:3080/?dsh-plugin-install=${encodeURIComponent(fullName)}`

    expect(consumeLocalInstallRequest({ href, replaceState })).toBeNull()
    expect(replaceState).toHaveBeenCalledWith(undefined, '', '/')
  })

  it('does not rewrite the current URL when no install request is present', () => {
    const replaceState = vi.fn()

    expect(consumeLocalInstallRequest({
      href: 'http://127.0.0.1:3080/?mode=code',
      replaceState,
    })).toBeNull()
    expect(replaceState).not.toHaveBeenCalled()
  })
})
