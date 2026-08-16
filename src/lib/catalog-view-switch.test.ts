import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const homepageSource = readFileSync(
  fileURLToPath(new URL('../pages/index.astro', import.meta.url)),
  'utf8',
)
const navigationSource = readFileSync(
  fileURLToPath(new URL('../components/CatalogPageNav.astro', import.meta.url)),
  'utf8',
)
const verifiedPageSource = readFileSync(
  fileURLToPath(new URL('../pages/verified.astro', import.meta.url)),
  'utf8',
)
const rankingPageSource = readFileSync(
  fileURLToPath(new URL('../pages/ranking.astro', import.meta.url)),
  'utf8',
)

describe('catalog page navigation', () => {
  it('uses one three-part capsule to link three independent routes', () => {
    expect(navigationSource).toContain('class="catalog-view-switch"')
    expect(navigationSource).toContain('role="tablist"')
    expect(navigationSource).toContain('href={baseUrl}')
    expect(navigationSource).toContain('href={`${baseUrl}verified`}')
    expect(navigationSource).toContain('href={`${baseUrl}ranking`}')
    expect(navigationSource).not.toContain('disabled')
  })

  it('builds verified and ranking as separate pages instead of homepage filter state', () => {
    expect(verifiedPageSource).toContain('<CatalogPage catalogPage="verified" />')
    expect(rankingPageSource).toContain('<CatalogPage catalogPage="ranking" />')
    expect(homepageSource).not.toContain("let selectedView = 'directory'")
    expect(homepageSource).not.toContain("params.set('view'")
    expect(homepageSource).toContain('mixRecommendedRepositories(priority, discovery, createSeededRandom(recommendationSeed))')
  })

  it('renders ranking on its own route and exposes no additional catalog API', () => {
    expect(homepageSource).toContain('const isRankingPage = catalogPage === \'ranking\'')
    expect(homepageSource).toContain('id="ranking-content"')
    expect(homepageSource).toContain('id="ranking-list"')
    expect(existsSync(fileURLToPath(new URL('../pages/catalog.json.ts', import.meta.url)))).toBe(true)
    expect(existsSync(fileURLToPath(new URL('../pages/verified.json.ts', import.meta.url)))).toBe(false)
    expect(existsSync(fileURLToPath(new URL('../pages/ranking.json.ts', import.meta.url)))).toBe(false)
  })
})
