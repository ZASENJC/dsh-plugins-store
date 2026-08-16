import { describe, expect, it } from 'vitest'

import { buildStarTrend } from './star-history'

const NOW = '2026-08-16T04:00:00.000Z'

describe('catalog Star history', () => {
  it('starts each Beijing calendar day at zero growth', () => {
    expect(buildStarTrend(undefined, NOW, 42)).toEqual({
      changeToday: 0,
      points: [{ capturedAt: NOW, stars: 42 }],
    })
  })

  it('calculates growth from the Star count captured at Beijing midnight', () => {
    const trend = buildStarTrend({
      changeToday: 0,
      points: [
        { capturedAt: '2026-08-15T15:30:00.000Z', stars: 30 },
        { capturedAt: '2026-08-15T16:00:00.000Z', stars: 34 },
      ],
    }, NOW, 39)

    expect(trend.changeToday).toBe(5)
    expect(trend.points).toEqual([
      { capturedAt: '2026-08-15T16:00:00.000Z', stars: 34 },
      { capturedAt: NOW, stars: 39 },
    ])
  })

  it('drops the previous day and resets at the first midnight refresh', () => {
    const trend = buildStarTrend({
      changeToday: 9,
      points: [
        { capturedAt: '2026-08-16T04:00:00.000Z', stars: 20 },
        { capturedAt: '2026-08-16T15:30:00.000Z', stars: 29 },
      ],
    }, '2026-08-16T16:00:00.000Z', 30)

    expect(trend).toEqual({
      changeToday: 0,
      points: [{ capturedAt: '2026-08-16T16:00:00.000Z', stars: 30 }],
    })
  })

  it('keeps a compact daily curve while preserving its baseline and newest point', () => {
    const endOfDay = '2026-08-16T15:30:00.000Z'
    const points = Array.from({ length: 48 }, (_, index) => ({
      capturedAt: new Date(Date.parse('2026-08-15T16:00:00.000Z') + index * 30 * 60 * 1000).toISOString(),
      stars: 100 + index,
    }))
    const trend = buildStarTrend({ changeToday: 47, points }, endOfDay, 147)

    expect(trend.changeToday).toBe(47)
    expect(trend.points.length).toBeLessThanOrEqual(25)
    expect(trend.points[0]).toEqual({ capturedAt: '2026-08-15T16:00:00.000Z', stars: 100 })
    expect(trend.points.at(-1)).toEqual({ capturedAt: endOfDay, stars: 147 })
  })
})
