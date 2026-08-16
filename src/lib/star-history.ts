export interface StarHistoryPoint {
  capturedAt: string
  stars: number
}

export interface StarTrend {
  change24h: number | null
  points: StarHistoryPoint[]
}

const WINDOW_MS = 24 * 60 * 60 * 1000
const BASELINE_TOLERANCE_MS = 2 * 60 * 60 * 1000
const MAX_POINTS = 25

function compactPoints(points: StarHistoryPoint[]): StarHistoryPoint[] {
  if (points.length <= MAX_POINTS) return points

  const compacted = Array.from({ length: MAX_POINTS }, (_, index) => {
    const sourceIndex = Math.round(index * (points.length - 1) / (MAX_POINTS - 1))
    return points[sourceIndex]
  })
  return compacted.filter((point, index) => (
    index === 0 || point.capturedAt !== compacted[index - 1].capturedAt
  ))
}

export function buildStarTrend(
  previous: StarTrend | undefined,
  capturedAt: string,
  stars: number,
): StarTrend {
  const capturedAtMs = Date.parse(capturedAt)
  if (!Number.isFinite(capturedAtMs)) throw new Error('Star history capture time is invalid')

  const byTimestamp = new Map<number, StarHistoryPoint>()
  for (const point of previous?.points ?? []) {
    const pointTime = Date.parse(point.capturedAt)
    if (!Number.isFinite(pointTime)
      || pointTime > capturedAtMs
      || !Number.isFinite(point.stars)
      || point.stars < 0) continue
    byTimestamp.set(pointTime, {
      capturedAt: new Date(pointTime).toISOString(),
      stars: Math.round(point.stars),
    })
  }
  byTimestamp.set(capturedAtMs, {
    capturedAt: new Date(capturedAtMs).toISOString(),
    stars: Math.max(0, Math.round(stars)),
  })

  const sorted = [...byTimestamp.entries()]
    .sort(([left], [right]) => left - right)
  const cutoff = capturedAtMs - WINDOW_MS
  const baselineEntry = sorted.findLast(([pointTime]) => pointTime <= cutoff)
  const hasCompleteBaseline = baselineEntry !== undefined
    && baselineEntry[0] >= cutoff - BASELINE_TOLERANCE_MS
  const recent = sorted
    .filter(([pointTime]) => pointTime > cutoff)
    .map(([, point]) => point)
  const retained = hasCompleteBaseline
    ? [baselineEntry[1], ...recent]
    : recent

  return {
    change24h: hasCompleteBaseline
      ? Math.max(0, Math.round(stars)) - baselineEntry[1].stars
      : null,
    points: compactPoints(retained),
  }
}
