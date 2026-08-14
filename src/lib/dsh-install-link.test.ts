import { describe, expect, it } from 'vitest'

import { buildLocalDshInstallUrl } from './dsh-install-link'

describe('local DSH install link', () => {
  it('opens the default local DSH Web origin with one encoded repository target', () => {
    expect(buildLocalDshInstallUrl('owner/plugin-name')).toBe(
      'http://127.0.0.1:3080/#dsh-plugin-install=owner%2Fplugin-name',
    )
  })

  it('supports an explicit local DSH origin without preserving unrelated paths', () => {
    expect(buildLocalDshInstallUrl('owner/plugin', 'http://localhost:4090/existing')).toBe(
      'http://localhost:4090/#dsh-plugin-install=owner%2Fplugin',
    )
  })

  it.each([
    '',
    'owner',
    'owner/plugin/extra',
    '../owner/plugin',
    'owner/plugin;unsafe',
  ])('rejects an unsafe repository target: %s', (fullName) => {
    expect(() => buildLocalDshInstallUrl(fullName)).toThrow('仓库名称无效')
  })
})
