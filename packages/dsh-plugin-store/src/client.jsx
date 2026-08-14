import { CatalogStore } from './catalog.js'
import { StoreHeaderAction, StoreOverlay, StoreSettingsTab } from './components.jsx'
import { StoreDialogController } from './controller.js'
import { consumeLocalInstallRequest } from './deep-link.js'
import { NS, en, zh } from './locales.js'
import { installStyles } from './styles.js'

export const inject = ['slots', 'locale']

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
    inject: () => ({ catalogStore, dialogController }),
  }, StoreOverlay))

  ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({
    name: 'conversation.session.header.utilities',
    id: 'plugin-store',
    order: 40,
    locale: NS,
    inject: () => ({ dialogController }),
  }, StoreHeaderAction))

  ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register({
    name: 'settings.plugins.tab',
    id: 'plugin-store',
    order: 20,
    label: () => t('settings.tab'),
    locale: NS,
    inject: () => ({ catalogStore }),
  }, StoreSettingsTab))

  const installRequest = consumeLocalInstallRequest()
  if (installRequest !== null) dialogController.openInstall(installRequest)
}
