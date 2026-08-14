import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const homepagePath = fileURLToPath(new URL('../pages/index.astro', import.meta.url))
const vectorMarkPath = fileURLToPath(new URL('../../public/deepseek-mark.svg', import.meta.url))
const gridMarkPath = fileURLToPath(new URL('../components/DeepSeekGridMark.astro', import.meta.url))
const homepageSource = readFileSync(homepagePath, 'utf8')

describe('homepage DeepSeek grid mark', () => {
  it('uses a fine CSS grid instead of enlarging a low-resolution bitmap', () => {
    expect(homepageSource).toContain('<DeepSeekGridMark')
    expect(homepageSource).not.toContain('deepseek-pixel.png')
    expect(homepageSource).not.toContain('image-rendering: pixelated')
  })

  it('keeps the logo silhouette resolution-independent', () => {
    expect(existsSync(vectorMarkPath)).toBe(true)
    if (!existsSync(vectorMarkPath)) return

    const vectorMark = readFileSync(vectorMarkPath, 'utf8')
    expect(vectorMark).toContain('viewBox="0 0 24 24"')
  })

  it('quantizes the silhouette into complete grid cells at its edges', () => {
    expect(existsSync(gridMarkPath)).toBe(true)
    if (!existsSync(gridMarkPath)) return

    const gridMark = readFileSync(gridMarkPath, 'utf8')
    expect(gridMark).toContain('data-grid-size="80"')
    expect(gridMark).toContain('shape-rendering="crispEdges"')
    expect(gridMark).toContain('data-motion-group')
  })

  it('animates complete pixel groups only while a fine pointer hovers the hero', () => {
    expect(homepageSource).toContain('.catalog-head:hover .catalog-head__pixel-group')
    expect(homepageSource).toContain('@keyframes pixel-roll')
    expect(homepageSource).toContain('(prefers-reduced-motion: no-preference)')
  })
})
