import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const homepageSource = readFileSync(
  fileURLToPath(new URL('../pages/index.astro', import.meta.url)),
  'utf8',
)

describe('homepage store plugin install banner', () => {
  it('shows copyable install command and Store API fields without an install button', () => {
    expect(homepageSource).toContain('store-install-strip')
    expect(homepageSource).toContain('id="store-install-command"')
    expect(homepageSource).toContain('id="copy-store-install"')
    expect(homepageSource).toContain('id="store-api-title"')
    expect(homepageSource).toContain('调用市场 API')
    expect(homepageSource).toContain('id="catalog-api-url"')
    expect(homepageSource).toContain('id="copy-catalog-api"')
    expect(homepageSource).toContain('aria-live="polite"')
    expect(homepageSource).toContain('https://api.dshmk.com/')
    expect(homepageSource).not.toContain('一键安装')
    expect(homepageSource).not.toContain('storeInstallGuideUrl')
    expect(homepageSource).toContain(
      'dsh plugin --profile web add npm:dsh-plugins-store',
    )
  })

  it('shows a copyable stable relay link beside the Store API', () => {
    expect(homepageSource).toContain('id="stable-relay-title"')
    expect(homepageSource).toContain('稳定中转站')
    expect(homepageSource).toContain('id="stable-relay-domain"')
    expect(homepageSource).toContain('id="copy-stable-relay"')
    expect(homepageSource).toContain('id="open-stable-relay"')
    expect(homepageSource).toContain('href={stableRelayUrl}')
    expect(homepageSource).toContain('target="_blank"')
    expect(homepageSource).toContain('rel="noopener noreferrer"')
    expect(homepageSource).toContain("const stableRelayDomain = 'aitreez.com'")
    expect(homepageSource).toContain("const stableRelayUrl = 'https://aitreez.com'")
    expect(homepageSource).toContain(
      "'home.stableRelayCopied'",
    )
  })

  it('keeps the install command clipped inside its responsive row', () => {
    expect(homepageSource).toContain('.store-install-command code')
    expect(homepageSource).toContain('class="store-install-command store-plugin-command"')
    expect(homepageSource).toContain('margin-right: 45px')
    expect(homepageSource).toContain('text-overflow: ellipsis')
    expect(homepageSource).toContain(
      'grid-template-columns: auto minmax(0, 2fr) auto minmax(0, 1fr)',
    )
    expect(homepageSource).toContain("'label command'")
    expect(homepageSource).toContain("'api-label api'")
  })
})
