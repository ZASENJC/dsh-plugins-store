import { describe, expect, it } from 'vitest'

import { getHeroMotion } from './hero-motion'

describe('homepage hero motion', () => {
  const rect = { left: 100, top: 50, width: 800, height: 400 }

  it('keeps the background centered when the pointer is centered', () => {
    expect(getHeroMotion(500, 250, rect)).toEqual({
      lightX: 50,
      lightY: 50,
      offsetX: 0,
      offsetY: 0,
    })
  })

  it('bounds parallax and highlight coordinates beyond the hero edges', () => {
    expect(getHeroMotion(1200, -100, rect)).toEqual({
      lightX: 100,
      lightY: 0,
      offsetX: 18,
      offsetY: -12,
    })
  })

  it('falls back to a stable center for a collapsed hero', () => {
    expect(getHeroMotion(100, 50, { ...rect, width: 0 })).toEqual({
      lightX: 50,
      lightY: 50,
      offsetX: 0,
      offsetY: 0,
    })
  })
})
