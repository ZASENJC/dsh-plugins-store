import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const packagePath = fileURLToPath(new URL('../package.json', import.meta.url))
const clientPath = fileURLToPath(new URL('../src/client.jsx', import.meta.url))
const componentsPath = fileURLToPath(new URL('../src/components.jsx', import.meta.url))
const stylesPath = fileURLToPath(new URL('../src/styles.js', import.meta.url))
const localesPath = fileURLToPath(new URL('../src/locales.js', import.meta.url))

describe('installable DSH plugin package', () => {
  it('declares both host and web client entries plus the official UI dependencies', () => {
    expect(existsSync(packagePath)).toBe(true)
    if (!existsSync(packagePath)) return

    const manifest = JSON.parse(readFileSync(packagePath, 'utf8'))
    expect(manifest).toMatchObject({
      name: 'dsh-plugin-store',
      main: './lib/index.js',
      exports: {
        '.': './lib/index.js',
        './client': './lib/client.js',
      },
      dsh: {
        bundle: { patch: './cordis.patch.yml' },
        client: { platform: 'web' },
      },
    })
    expect(manifest.dsh.client.inject).toEqual(expect.arrayContaining([
      '@deepseek-ai/dsh-client-runtime',
      '@deepseek-ai/dsh-client-ui-commands',
      '@deepseek-ai/dsh-client-ui-conversation',
      '@deepseek-ai/dsh-client-ui-settings-plugins',
    ]))
    expect(manifest.scripts).toHaveProperty('prepack', 'node build.mjs')
    expect(manifest.scripts).not.toHaveProperty('prepare')
  })

  it('wires slash execution to a root overlay plus the session utility and Plugins settings tab', () => {
    expect(existsSync(clientPath)).toBe(true)
    if (!existsSync(clientPath)) return

    const source = readFileSync(clientPath, 'utf8')
    expect(source).toContain('command/executed')
    expect(source).toContain('consumeLocalInstallRequest')
    expect(source).toContain('dialogController.openInstall')
    expect(source).toContain("ctx.slots.inject('shell.overlay'")
    expect(source).toContain('StoreOverlay')
    expect(source).toContain('conversation.session.header.utilities')
    expect(source).toContain('workspaces: ctx.workspaces')
    expect(source).toContain('ctx.sessions')
    expect(source).toContain('settings.plugins.tab')
    expect(source).toContain('commandName === \'store\'')
  })

  it('renders the same discovery view in the modal and settings without an install executor', () => {
    expect(existsSync(componentsPath)).toBe(true)
    if (!existsSync(componentsPath)) return

    const source = readFileSync(componentsPath, 'utf8')
    expect(source).toContain('function StoreView')
    expect(source).toContain('function StoreModal')
    expect(source).toContain('function StoreOverlay')
    expect(source).toContain('function StoreSettingsTab')
    expect(source).toContain('function InstallRiskModal')
    expect(source).toContain('requestedInstallTarget')
    expect(source).toContain('onInstallRequestConsumed')
    expect(source).toContain('const [installTarget, setInstallTarget] = React.useState(null)')
    expect(source).toContain('onClose={closeInstallTarget}')
    expect(source.match(/<StoreView/g)).toHaveLength(2)
    expect(source.match(/<StoreModal/g)).toHaveLength(1)
    expect(source).toContain('buildInstallCommand')
    expect(source).toContain("fetch('/api/dsh-plugin-store/install'")
    expect(source).toContain("t('store.riskAcknowledge')")
    expect(source).toContain('repository.validation')
    expect(source).toContain("t('store.validation')")
    expect(source).toContain("t('store.analyzeWithAgent')")
    expect(source).toContain('buildInstallPlan')
    expect(source).toContain('buildInstallPlan(target)')
    expect(source).not.toContain('store.installVersion')
    expect(source).not.toContain('store.installLatest')
    expect(source).not.toContain('installMode')
    expect(source).not.toMatch(/child_process|execFile|spawn\(/)
  })

  it('keeps the store inside the narrow native settings content column', () => {
    const source = readFileSync(stylesPath, 'utf8')

    expect(source).toContain(".dps-store[data-mode='settings'] .dps-filter-bar")
    expect(source).toContain(".dps-store[data-mode='settings'] .dps-filter-search")
    expect(source).toContain('overflow-wrap: anywhere')
    expect(source).toContain('flex: 1 1 auto')
    expect(source).toContain(".dps-badge[data-kind='validation']")
    expect(source).toContain('body > :has(> .dps-risk-modal)')
  })

  it('keeps validation labels and the security-review warning state aligned with the web store', () => {
    const source = readFileSync(localesPath, 'utf8')
    expect(source).toContain("'store.validation.security-review'")
    expect(source).toContain("'store.validation.expired': '需重新验证'")
    expect(readFileSync(stylesPath, 'utf8')).toContain("data-status='security-review'")
  })

  it('opens Store details from the card while keeping only install and copy actions', () => {
    const source = readFileSync(componentsPath, 'utf8')

    expect(source).toContain('className="dps-card-link"')
    expect(source).toContain('href={detailUrl}')
    expect(source).toContain("t('store.openDetails')")
    expect(source).not.toContain('href={repository.url}')
    expect(source).not.toContain("t('store.openRepository')")
  })
})
