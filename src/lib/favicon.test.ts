import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const layoutPath = fileURLToPath(new URL('../layouts/BaseLayout.astro', import.meta.url))
const faviconPath = fileURLToPath(new URL('../../public/favicon.png', import.meta.url))
const faviconSmallPath = fileURLToPath(new URL('../../public/favicon-32.png', import.meta.url))

const readPngDimensions = (path: string) => {
  const image = readFileSync(path)
  expect(image.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
  return { width: image.readUInt32BE(16), height: image.readUInt32BE(20) }
}

describe('browser tab icon', () => {
  it('ships the supplied square artwork at source and browser-tab sizes', () => {
    expect(existsSync(faviconPath)).toBe(true)
    expect(existsSync(faviconSmallPath)).toBe(true)
    expect(readPngDimensions(faviconPath)).toEqual({ width: 512, height: 512 })
    expect(readPngDimensions(faviconSmallPath)).toEqual({ width: 32, height: 32 })
  })

  it('uses the raster artwork instead of the previous vector mark', () => {
    const layout = readFileSync(layoutPath, 'utf8')

    expect(layout).toContain('favicon-32.png`} type="image/png" sizes="32x32"')
    expect(layout).toContain('favicon.png`} type="image/png" sizes="512x512"')
    expect(layout).not.toContain('favicon.svg')
  })

  it('reuses the browser-tab artwork as the header brand mark', () => {
    const layout = readFileSync(layoutPath, 'utf8')

    expect(layout).toContain('class="brand__mark"')
    expect(layout).toContain('src={`${baseUrl}favicon-32.png`}')
  })
})
