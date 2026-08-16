import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const homepageSource = readFileSync(
  fileURLToPath(new URL('../pages/index.astro', import.meta.url)),
  'utf8',
)
const detailSource = readFileSync(
  fileURLToPath(new URL('../pages/plugins/[id].astro', import.meta.url)),
  'utf8',
)

describe('catalog filter navigation', () => {
  it('restores every catalog filter from the URL before rendering results', () => {
    expect(homepageSource).toContain("const catalogFilterParamNames = ['q', 'category', 'type', 'validation']")
    expect(homepageSource).toContain('const restoreFiltersFromUrl = () =>')
    expect(homepageSource).toMatch(/restoreFiltersFromUrl\(\)\s+resetAndRender\(\)/)
  })

  it('writes filter changes to the URL and carries them into plugin detail links', () => {
    expect(homepageSource).toContain('window.history.replaceState')
    expect(homepageSource).toContain('const commitFilters = () =>')
    expect(homepageSource).toContain('const detailSearch = getCatalogDetailSearch()')
    expect(homepageSource).toContain("params.set('from', 'verified')")
    expect(homepageSource).toContain("`${baseUrl}plugins/${repository.slug}${detailSearch}`")
  })

  it('returns detail navigation to the originating independent catalog page', () => {
    expect(detailSource).toContain('data-catalog-back')
    expect(detailSource).toContain("const catalogFilterParamNames = ['q', 'category', 'type', 'validation']")
    expect(detailSource).toContain("currentParams.get('from') === 'verified'")
    expect(detailSource).toContain('catalogBackLink.href = `${catalogBackLink.href}verified`')
    expect(detailSource).toContain('catalogBackLink.href = `${catalogBackLink.href}${catalogFilterSearch}`')
  })
})
