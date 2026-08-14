import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const packagePath = fileURLToPath(new URL('../package.json', import.meta.url))
const clientPath = fileURLToPath(new URL('../src/client.jsx', import.meta.url))
const componentsPath = fileURLToPath(new URL('../src/components.jsx', import.meta.url))

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
      '@deepseek-ai/dsh-client-ui-commands',
      '@deepseek-ai/dsh-client-ui-conversation',
      '@deepseek-ai/dsh-client-ui-settings-plugins',
    ]))
  })

  it('wires slash execution, the session utility, and the Plugins settings tab', () => {
    expect(existsSync(clientPath)).toBe(true)
    if (!existsSync(clientPath)) return

    const source = readFileSync(clientPath, 'utf8')
    expect(source).toContain('command/executed')
    expect(source).toContain('conversation.session.header.utilities')
    expect(source).toContain('settings.plugins.tab')
    expect(source).toContain('commandName === \'store\'')
  })

  it('renders the same discovery view in the modal and settings without an install executor', () => {
    expect(existsSync(componentsPath)).toBe(true)
    if (!existsSync(componentsPath)) return

    const source = readFileSync(componentsPath, 'utf8')
    expect(source).toContain('function StoreView')
    expect(source).toContain('function StoreModal')
    expect(source).toContain('function StoreSettingsTab')
    expect(source.match(/<StoreView/g)).toHaveLength(2)
    expect(source).toContain('buildInstallCommand')
    expect(source).not.toMatch(/child_process|execFile|spawn\(/)
  })
})
