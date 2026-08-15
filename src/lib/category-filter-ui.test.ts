import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const homepageSource = readFileSync(
  fileURLToPath(new URL('../pages/index.astro', import.meta.url)),
  'utf8',
)

describe('homepage category filter', () => {
  it('expands all categories by click instead of requiring horizontal scrolling', () => {
    expect(homepageSource).toContain('data-category-filter-panel')
    expect(homepageSource).toContain('id="category-filter-toggle"')
    expect(homepageSource).toContain('aria-controls="category-filter"')
    expect(homepageSource).toContain("categoryFilterPanel.classList.toggle('is-expanded', expanded)")
    expect(homepageSource).toContain("categoryFilterToggle.setAttribute('aria-expanded', String(expanded))")
    expect(homepageSource).toMatch(/\.category-row \{[^}]*flex-wrap: wrap/s)
    expect(homepageSource).not.toMatch(/\.category-row \{[^}]*overflow-x: auto/s)
  })

  it('uses a larger, stronger category label while keeping counts legible', () => {
    expect(homepageSource).toContain('class="category-filter__label"')
    expect(homepageSource).toContain('class="category-filter__count"')
    expect(homepageSource).toMatch(/\.category-filter__label \{[^}]*font-size: 14px[^}]*font-weight: 600/s)
    expect(homepageSource).toMatch(/\.category-filter__count \{[^}]*font-size: 11px[^}]*font-weight: 600/s)
  })
})
