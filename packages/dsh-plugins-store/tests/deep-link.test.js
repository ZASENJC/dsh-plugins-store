import { describe, expect, it, vi } from 'vitest'

import { consumeLocalInstallRequest } from '../src/deep-link.js'

describe('local DSH install request', () => {
  it('consumes a fragment request that survives the DSH startup router', () => {
    const replaceState = vi.fn()

    const target = consumeLocalInstallRequest({
      href: 'http://127.0.0.1:3080/?mode=code#view=chat&dsh-plugin-id=github%3A1',
      historyState: { retained: true },
      replaceState,
    })

    expect(target).toEqual({ repositoryId: 'github:1' })
    expect(replaceState).toHaveBeenCalledWith(
      { retained: true },
      '',
      '/?mode=code#view=chat',
    )
  })

  it('returns a safe repository target and removes only the consumed query parameter', () => {
    const replaceState = vi.fn()

    const target = consumeLocalInstallRequest({
      href: 'http://127.0.0.1:3080/?mode=code&dsh-plugin-id=github%3A2#session',
      historyState: { retained: true },
      replaceState,
    })

    expect(target).toEqual({ repositoryId: 'github:2' })
    expect(replaceState).toHaveBeenCalledWith(
      { retained: true },
      '',
      '/?mode=code#session',
    )
  })

  it.each([
    'owner plugin',
    'owner/plugin;unsafe',
    '../owner/plugin',
  ])('consumes but rejects an unsafe catalog ID: %s', (repositoryId) => {
    const replaceState = vi.fn()
    const href = `http://127.0.0.1:3080/?dsh-plugin-id=${encodeURIComponent(repositoryId)}`

    expect(consumeLocalInstallRequest({ href, replaceState })).toBeNull()
    expect(replaceState).toHaveBeenCalledWith(undefined, '', '/')
  })

  it('rejects a request without a catalog ID', () => {
    const replaceState = vi.fn()

    expect(consumeLocalInstallRequest({
      href: 'http://127.0.0.1:3080/?dsh-plugin-id=owner%20plugin',
      replaceState,
    })).toBeNull()
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
