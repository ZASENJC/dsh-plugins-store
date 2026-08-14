export class StoreDialogController {
  constructor() {
    this.listeners = new Set()
    this.snapshot = Object.freeze({ bySession: Object.freeze({}) })
  }

  getSnapshot = () => this.snapshot

  subscribe = (listener) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  open(sessionId) {
    this.set(sessionId, true)
  }

  close(sessionId) {
    this.set(sessionId, false)
  }

  set(sessionId, open) {
    const key = String(sessionId)
    if ((this.snapshot.bySession[key] ?? false) === open) return
    this.snapshot = Object.freeze({
      bySession: Object.freeze({ ...this.snapshot.bySession, [key]: open }),
    })
    for (const listener of this.listeners) listener()
  }
}
