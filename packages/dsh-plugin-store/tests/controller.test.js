import { describe, expect, it, vi } from 'vitest'

import { StoreDialogController } from '../src/controller.js'

describe('shared store dialog state', () => {
  it('opens and closes the exact session used by the toolbar or slash command', () => {
    const controller = new StoreDialogController()
    const listener = vi.fn()
    const unsubscribe = controller.subscribe(listener)

    controller.open('session-a')
    controller.open('session-b')
    controller.close('session-a')

    expect(controller.getSnapshot()).toEqual({
      bySession: {
        'session-a': false,
        'session-b': true,
      },
    })
    expect(listener).toHaveBeenCalledTimes(3)
    unsubscribe()
  })

  it('ignores duplicate transitions so mounted DSH surfaces do not rerender needlessly', () => {
    const controller = new StoreDialogController()
    const listener = vi.fn()
    controller.subscribe(listener)

    controller.close('session-a')
    controller.open('session-a')
    controller.open('session-a')

    expect(listener).toHaveBeenCalledTimes(1)
  })
})
