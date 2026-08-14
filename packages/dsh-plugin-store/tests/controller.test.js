import { describe, expect, it, vi } from 'vitest'

import { StoreDialogController } from '../src/controller.js'

describe('shared store dialog state', () => {
  it('opens one root-owned dialog from any toolbar or command surface', () => {
    const controller = new StoreDialogController()
    const listener = vi.fn()
    const unsubscribe = controller.subscribe(listener)

    controller.open()
    controller.close()

    expect(controller.getSnapshot()).toEqual({ open: false, installRequest: null })
    expect(listener).toHaveBeenCalledTimes(2)
    unsubscribe()
  })

  it('ignores duplicate transitions so mounted DSH surfaces do not rerender needlessly', () => {
    const controller = new StoreDialogController()
    const listener = vi.fn()
    controller.subscribe(listener)

    controller.close()
    controller.open()
    controller.open()

    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('opens an external install request once and keeps the store open after consumption', () => {
    const controller = new StoreDialogController()
    const listener = vi.fn()
    controller.subscribe(listener)

    controller.openInstall('owner/plugin')
    expect(controller.getSnapshot()).toEqual({
      open: true,
      installRequest: 'owner/plugin',
    })

    controller.consumeInstallRequest()
    expect(controller.getSnapshot()).toEqual({
      open: true,
      installRequest: null,
    })
    expect(listener).toHaveBeenCalledTimes(2)
  })
})
