import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const readSource = (relativePath: string) => readFileSync(
  fileURLToPath(new URL(relativePath, import.meta.url)),
  'utf8',
)

const layoutSource = readSource('../layouts/BaseLayout.astro')
const globalStyles = readSource('../styles/global.css')

describe('site theme control', () => {
  it('keeps a same-sized circular theme button beside the GitHub control', () => {
    expect(layoutSource).toContain('id="theme-toggle"')
    expect(layoutSource).toContain('class="icon-button theme-toggle"')
    expect(layoutSource).toContain('<Sun')
    expect(layoutSource).toContain('<Moon')
    expect(layoutSource).toContain('data-theme-toggle')
    expect(layoutSource).toMatch(/class="icon-button theme-toggle"[\s\S]*?class="icon-button"[\s\S]*?Github/)
    expect(globalStyles).toMatch(/\.icon-button \{[^}]*width: 40px/s)
    expect(globalStyles).toMatch(/\.icon-button \{[^}]*border-radius: 9999px/s)
  })

  it('applies the saved theme and persists subsequent changes', () => {
    expect(layoutSource).toContain("localStorage.getItem(THEME_STORAGE_KEY)")
    expect(layoutSource).toContain("localStorage.setItem(THEME_STORAGE_KEY")
    expect(layoutSource).toContain('const applyTheme =')
    expect(layoutSource).toContain('aria-pressed')
    expect(layoutSource).toContain("document.documentElement.dataset.theme = theme")
  })

  it('defines a light palette and theme-aware surfaces', () => {
    expect(globalStyles).toContain(":root[data-theme='light']")
    expect(globalStyles).toContain('color-scheme: light')
    expect(globalStyles).toContain('--canvas: #f6f7f8')
    expect(globalStyles).toContain('--header-background: rgba(246, 247, 248, 0.94)')
    expect(layoutSource).toContain('background: var(--header-background)')
    expect(layoutSource).toContain('background: var(--tools-background)')
  })
})
