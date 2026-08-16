import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const homepageSource = readFileSync(
  fileURLToPath(new URL('../pages/index.astro', import.meta.url)),
  'utf8',
)

describe('homepage catalog view switch', () => {
  it('replaces validation and sorting selects with one three-part capsule', () => {
    expect(homepageSource).not.toContain('id="validation-filter"')
    expect(homepageSource).not.toContain('id="sort-filter"')
    expect(homepageSource).toContain('class="catalog-view-switch"')
    expect(homepageSource).toContain('role="tablist"')
    expect(homepageSource).toContain('data-view="directory"')
    expect(homepageSource).toContain('data-view="verified"')
    expect(homepageSource).toContain('data-view="ranking"')
  })

  it('keeps the directory recommended by default and filters verified projects directly', () => {
    expect(homepageSource).toContain("let selectedView = 'directory'")
    expect(homepageSource).toContain("selectedView !== 'verified' || repository.validation.overall === 'verified'")
    expect(homepageSource).toContain('mixRecommendedRepositories(priority, discovery, createSeededRandom(recommendationSeed))')
  })

  it('shows ranking as a future entry without exposing unfinished content', () => {
    expect(homepageSource).toMatch(/data-view="ranking"[\s\S]*?disabled/)
    expect(homepageSource).not.toContain('id="ranking-content"')
  })
})
