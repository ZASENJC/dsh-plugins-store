import { CatalogStore } from './catalog.js'
import { StoreHeaderAction, StoreSettingsTab } from './components.jsx'
import { StoreDialogController } from './controller.js'
import { NS, en, zh } from './locales.js'
import { installStyles } from './styles.js'

export const inject = ['slots', 'locale']

export function apply(ctx) {
  const catalogStore = new CatalogStore()
  const dialogController = new StoreDialogController()
  const t = ctx.locale.bind(NS)

  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'plugin-store: dictionaries')
  ctx.effect(() => installStyles(), 'plugin-store: styles')

  ctx.on('command/executed', (sessionId, commandName, result) => {
    if (commandName === 'store' && result.kind === 'success') {
      dialogController.open(sessionId)
    }
  })

  ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({
    name: 'conversation.session.header.utilities',
    id: 'plugin-store',
    order: 40,
    locale: NS,
    inject: () => ({ catalogStore, dialogController }),
  }, StoreHeaderAction))

  ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register({
    name: 'settings.plugins.tab',
    id: 'plugin-store',
    order: 20,
    label: () => t('settings.tab'),
    locale: NS,
    inject: () => ({ catalogStore }),
  }, StoreSettingsTab))
}
