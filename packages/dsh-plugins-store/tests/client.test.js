import { describe, expect, it, vi } from 'vitest'

vi.mock('../src/components.jsx', () => ({ StoreOverlay: vi.fn(), StoreSettingsTab: vi.fn() }))
vi.mock('../src/styles.js', () => ({ installStyles: vi.fn() }))
vi.mock('../src/deep-link.js', () => ({ consumeLocalInstallRequest: vi.fn(() => null) }))

import { apply, inject } from '../src/client.jsx'

describe('current DSH client integration', () => {
  it('mounts the store using session controller and workspace navigation, and opens it only for a successful /store', () => {
    const events = new Map()
    const registrations = new Map()
    const sessions = {}
    const uiWorkspace = { openSession: vi.fn() }
    const ctx = {
      sessions,
      uiWorkspace,
      locale: { bind: () => key => key, register: vi.fn() },
      effect: effect => effect(),
      on: (name, handler) => events.set(name, handler),
      slots: {
        inject: (_name, callback) => callback(),
        register: (options, component) => registrations.set(options.name, { options, component }),
      },
    }
    apply(ctx)
    expect(inject).toEqual(['slots', 'locale', 'sessions', 'uiWorkspace'])
    const overlay = registrations.get('shell.overlay').options.inject()
    const settings = registrations.get('settings.plugins.tab').options.inject()
    expect(overlay.sessions).toBe(sessions)
    expect(overlay.uiWorkspace).toBe(uiWorkspace)
    expect(settings.catalogStore).toBe(overlay.catalogStore)
    expect(settings.uiWorkspace).toBe(uiWorkspace)
    const executed = events.get('command/executed')
    executed('session', 'other', { kind: 'success' })
    executed('session', 'store', { kind: 'error' })
    expect(overlay.dialogController.getSnapshot().open).toBe(false)
    executed('session', 'store', { kind: 'success' })
    expect(overlay.dialogController.getSnapshot().open).toBe(true)
  })
})
