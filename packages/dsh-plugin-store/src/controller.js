export class StoreDialogController {
  constructor() {
    this.listeners = new Set()
    this.snapshot = Object.freeze({ open: false, installRequest: null })
  }

  getSnapshot = () => this.snapshot

  subscribe = (listener) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  open() {
    this.set({ open: true })
  }

  openInstall(fullName) {
    this.set({ open: true, installRequest: fullName })
  }

  consumeInstallRequest = () => {
    this.set({ installRequest: null })
  }

  close() {
    this.set({ open: false, installRequest: null })
  }

  set(next) {
    const snapshot = { ...this.snapshot, ...next }
    if (this.snapshot.open === snapshot.open
      && this.snapshot.installRequest === snapshot.installRequest) return
    this.snapshot = Object.freeze(snapshot)
    for (const listener of this.listeners) listener()
  }
}
