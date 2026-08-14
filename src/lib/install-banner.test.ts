import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const homepageSource = readFileSync(
  fileURLToPath(new URL('../pages/index.astro', import.meta.url)),
  'utf8',
)

describe('homepage store plugin install banner', () => {
  it('shows the install command with copy feedback and an install guide jump', () => {
    expect(homepageSource).toContain('store-install-strip')
    expect(homepageSource).toContain('id="store-install-command"')
    expect(homepageSource).toContain('id="copy-store-install"')
    expect(homepageSource).toContain('aria-live="polite"')
    expect(homepageSource).toContain('一键安装')
    expect(homepageSource).toContain('packages/dsh-plugin-store#一键安装')
    expect(homepageSource).toContain(
      'dsh plugin --profile web add github:ZASENJC/dsh-plugins-store#path:packages/dsh-plugin-store',
    )
  })

  it('keeps the install command clipped inside its responsive row', () => {
    expect(homepageSource).toContain('.store-install-command code')
    expect(homepageSource).toContain('text-overflow: ellipsis')
    expect(homepageSource).toContain('grid-template-columns: auto minmax(0, 1fr) auto')
  })
})
