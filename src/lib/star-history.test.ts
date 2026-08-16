import { describe, expect, it } from 'vitest'

import { buildStarTrend } from './star-history'

const NOW = '2026-08-16T12:00:00.000Z'

describe('catalog Star history', () => {
  it('starts collecting without claiming a complete 24-hour change', () => {
    expect(buildStarTrend(undefined, NOW, 42)).toEqual({
      change24h: null,
      points: [{ capturedAt: NOW, stars: 42 }],
    })
  })

  it('calculates the 24-hour change from the closest complete baseline', () => {
    const trend = buildStarTrend({
      change24h: null,
      points: [
        { capturedAt: '2026-08-15T11:00:00.000Z', stars: 30 },
        { capturedAt: '2026-08-16T00:00:00.000Z', stars: 34 },
      ],
    }, NOW, 39)

    expect(trend.change24h).toBe(9)
    expect(trend.points).toEqual([
      { capturedAt: '2026-08-15T11:00:00.000Z', stars: 30 },
      { capturedAt: '2026-08-16T00:00:00.000Z', stars: 34 },
      { capturedAt: NOW, stars: 39 },
    ])
  })

  it('does not report a 24-hour change from a stale baseline after a refresh outage', () => {
    const trend = buildStarTrend({
      change24h: 99,
      points: [
        { capturedAt: '2026-08-15T06:00:00.000Z', stars: 10 },
        { capturedAt: '2026-08-16T00:00:00.000Z', stars: 20 },
      ],
    }, NOW, 24)

    expect(trend.change24h).toBeNull()
    expect(trend.points[0]).toEqual({ capturedAt: '2026-08-16T00:00:00.000Z', stars: 20 })
  })

  it('keeps a compact curve while preserving its baseline and newest point', () => {
    const points = Array.from({ length: 49 }, (_, index) => ({
      capturedAt: new Date(Date.parse(NOW) - (48 - index) * 30 * 60 * 1000).toISOString(),
      stars: 100 + index,
    }))
    const trend = buildStarTrend({ change24h: null, points }, NOW, 148)

    expect(trend.change24h).toBe(48)
    expect(trend.points.length).toBeLessThanOrEqual(25)
    expect(trend.points[0]).toEqual({ capturedAt: '2026-08-15T12:00:00.000Z', stars: 100 })
    expect(trend.points.at(-1)).toEqual({ capturedAt: NOW, stars: 148 })
  })
})
