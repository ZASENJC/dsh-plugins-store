import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const homepageSource = readFileSync(
  fileURLToPath(new URL('../pages/index.astro', import.meta.url)),
  'utf8',
)

describe('homepage category filter', () => {
  it('integrates project types and feature categories into one grouped filter panel', () => {
    expect(homepageSource).not.toContain('<select id="type-filter"')
    expect(homepageSource).toContain('data-filter-group="type"')
    expect(homepageSource).toContain('data-filter-group="category"')
    expect(homepageSource).toContain('data-filter-group="validation"')
    expect(homepageSource).toMatch(/\{isVerifiedPage && \([\s\S]*data-filter-group="validation"/)
    expect(homepageSource).toContain('data-type="all"')
    expect(homepageSource).toContain('data-type={type.id}')
    expect(homepageSource).toContain("let selectedType = 'all'")
    expect(homepageSource).toContain("typeFilter.addEventListener('click'")
    expect(homepageSource).not.toContain('<select id="validation-filter"')
    expect(homepageSource).not.toContain('<select id="sort-filter"')
    expect(homepageSource).not.toContain('data-category="verified"')
  })

  it('expands all page-specific filter groups by click instead of requiring horizontal scrolling', () => {
    expect(homepageSource).toContain('data-category-filter-panel')
    expect(homepageSource).toContain('id="category-filter-toggle"')
    expect(homepageSource).toContain('aria-controls="classification-filter-groups"')
    expect(homepageSource).toContain("categoryFilterPanel.classList.toggle('is-expanded', expanded)")
    expect(homepageSource).toContain("categoryFilterToggle.setAttribute('aria-expanded', String(expanded))")
    expect(homepageSource).toMatch(/\.filter-group__options \{[^}]*flex-wrap: wrap/s)
    expect(homepageSource).not.toMatch(/\.filter-group__options \{[^}]*overflow-x: auto/s)
    expect(homepageSource).toMatch(/@media \(max-width: 767px\)[\s\S]*\.filter-group \{[^}]*grid-template-columns: 1fr/s)
  })

  it('uses a larger, stronger category label while keeping counts legible', () => {
    expect(homepageSource).toContain('class="category-filter__label"')
    expect(homepageSource).toContain('class="category-filter__count"')
    expect(homepageSource).toMatch(/\.category-filter__label \{[^}]*font-size: 14px[^}]*font-weight: 600/s)
    expect(homepageSource).toMatch(/\.category-filter__count \{[^}]*font-size: 11px[^}]*font-weight: 600/s)
  })
})
