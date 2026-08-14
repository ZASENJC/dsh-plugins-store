import { describe, expect, it } from 'vitest'

import { getReadmeApiUrl, resolveReadmeReference } from './readme'

const repository = {
  fullName: 'Owner/Plugin',
  defaultBranch: 'main',
  readmePath: 'docs/README.md',
}

describe('live GitHub README URLs', () => {
  it('builds the rendered README API endpoint without embedding credentials', () => {
    expect(getReadmeApiUrl('Owner/Plugin')).toBe('https://api.github.com/repos/Owner/Plugin/readme')
  })

  it('resolves repository documents and media while keeping page fragments local', () => {
    expect(resolveReadmeReference('../CHANGELOG.md', repository, 'link')).toBe(
      'https://github.com/Owner/Plugin/blob/main/CHANGELOG.md',
    )
    expect(resolveReadmeReference('../assets/demo.png', repository, 'media')).toBe(
      'https://raw.githubusercontent.com/Owner/Plugin/main/assets/demo.png',
    )
    expect(resolveReadmeReference('#install', repository, 'link')).toBe('#install')
    expect(resolveReadmeReference('https://example.com/docs', repository, 'link')).toBe(
      'https://example.com/docs',
    )
  })
})
