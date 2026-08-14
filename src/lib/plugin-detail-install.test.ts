import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const detailSource = readFileSync(
  fileURLToPath(new URL('../pages/plugins/[id].astro', import.meta.url)),
  'utf8',
)

describe('plugin detail local DSH installation', () => {
  it('offers a local DSH handoff only for installable project types', () => {
    expect(detailSource).toContain('buildLocalDshInstallUrl(repository.fullName)')
    expect(detailSource).toContain('href={localDshInstallUrl}')
    expect(detailSource).toContain('在 DSH 中安装')
    expect(detailSource).toContain('showInstallReference &&')
  })
})
