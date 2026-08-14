import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const homepagePath = fileURLToPath(new URL('../pages/index.astro', import.meta.url))
const vectorMarkPath = fileURLToPath(new URL('../../public/deepseek-mark.svg', import.meta.url))
const homepageSource = readFileSync(homepagePath, 'utf8')

describe('homepage DeepSeek grid mark', () => {
  it('uses a fine CSS grid instead of enlarging a low-resolution bitmap', () => {
    expect(homepageSource).toContain('--hero-grid-size: 8px')
    expect(homepageSource).toContain('deepseek-mark.svg')
    expect(homepageSource).not.toContain('deepseek-pixel.png')
    expect(homepageSource).not.toContain('image-rendering: pixelated')
  })

  it('keeps the logo silhouette resolution-independent', () => {
    expect(existsSync(vectorMarkPath)).toBe(true)
    if (!existsSync(vectorMarkPath)) return

    const vectorMark = readFileSync(vectorMarkPath, 'utf8')
    expect(vectorMark).toContain('viewBox="0 0 24 24"')
  })
})
