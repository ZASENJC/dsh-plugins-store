import { CatalogStore } from './catalog.js'
import { StoreOverlay, StoreSettingsTab } from './components.jsx'
import { StoreDialogController } from './controller.js'
import { consumeLocalInstallRequest } from './deep-link.js'
import { NS, en, zh } from './locales.js'
import { installStyles } from './styles.js'

export const inject = ['slots', 'locale', 'sessions', 'workspaces']

export function apply(ctx) {
  const catalogStore = new CatalogStore()
  const dialogController = new StoreDialogController()
  const t = ctx.locale.bind(NS)

  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'plugin-store: dictionaries')
  ctx.effect(() => installStyles(), 'plugin-store: styles')

  ctx.on('command/executed', (_sessionId, commandName, result) => {
    if (commandName === 'store' && result.kind === 'success') {
      dialogController.open()
    }
  })

  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'plugin-store-dialog',
    order: 40,
    locale: NS,
    inject: () => ({ catalogStore, dialogController, sessions: ctx.sessions, workspaces: ctx.workspaces }),
  }, StoreOverlay))

  ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register({
    name: 'settings.plugins.tab',
    id: 'plugin-store',
    order: 20,
    label: () => t('settings.tab'),
    locale: NS,
    inject: () => ({ catalogStore, sessions: ctx.sessions, workspaces: ctx.workspaces }),
  }, StoreSettingsTab))

  const installRequest = consumeLocalInstallRequest()
  if (installRequest !== null) dialogController.openInstall(installRequest)
}
