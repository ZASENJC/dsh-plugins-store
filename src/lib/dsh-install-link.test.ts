import { describe, expect, it } from 'vitest'

import { buildLocalDshInstallUrl } from './dsh-install-link'

describe('local DSH install link', () => {
  it('opens the default local DSH Web origin with a stable catalog ID', () => {
    expect(buildLocalDshInstallUrl('github:123')).toBe(
      'http://127.0.0.1:3080/#dsh-plugin-id=github%3A123',
    )
  })

  it('supports an explicit local DSH origin without preserving unrelated paths', () => {
    expect(buildLocalDshInstallUrl('npm:dsh-example', 'http://localhost:4090/existing')).toBe(
      'http://localhost:4090/#dsh-plugin-id=npm%3Adsh-example',
    )
  })

  it.each([
    '',
    '',
    '../owner/plugin',
    'owner/plugin;unsafe',
    'owner plugin',
  ])('rejects an unsafe catalog ID: %s', (repositoryId) => {
    expect(() => buildLocalDshInstallUrl(repositoryId)).toThrow('目录项目 ID 无效')
  })
})
