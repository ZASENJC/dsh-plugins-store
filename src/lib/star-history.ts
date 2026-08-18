export interface StarHistoryPoint {
  capturedAt: string
  stars: number
}

export interface StarTrend {
  changeToday: number
  points: StarHistoryPoint[]
}

const DAY_MS = 24 * 60 * 60 * 1000
const BEIJING_UTC_OFFSET_MS = 8 * 60 * 60 * 1000
const MAX_POINTS = 25

function getBeijingDayStart(capturedAtMs: number): number {
  return Math.floor((capturedAtMs + BEIJING_UTC_OFFSET_MS) / DAY_MS) * DAY_MS
    - BEIJING_UTC_OFFSET_MS
}

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
  const dayStartMs = getBeijingDayStart(capturedAtMs)
  const currentStars = Math.max(0, Math.round(stars))

  const byTimestamp = new Map<number, StarHistoryPoint>()
  for (const point of previous?.points ?? []) {
    const pointTime = Date.parse(point.capturedAt)
    if (!Number.isFinite(pointTime)
      || pointTime < dayStartMs - DAY_MS
      || pointTime > capturedAtMs
      || !Number.isFinite(point.stars)
      || point.stars < 0) continue
    byTimestamp.set(pointTime, {
      capturedAt: new Date(pointTime).toISOString(),
      stars: Math.round(point.stars),
    })
  }
  const previousDayLastPoint = [...byTimestamp.entries()]
    .filter(([pointTime]) => pointTime >= dayStartMs - DAY_MS && pointTime < dayStartMs)
    .sort(([left], [right]) => left - right)
    .at(-1)?.[1]
  const hasMidnightBaseline = byTimestamp.has(dayStartMs)
  if (previousDayLastPoint && !hasMidnightBaseline) {
    byTimestamp.set(dayStartMs, {
      capturedAt: new Date(dayStartMs).toISOString(),
      stars: previousDayLastPoint.stars,
    })
  }
  byTimestamp.set(capturedAtMs, {
    capturedAt: new Date(capturedAtMs).toISOString(),
    stars: currentStars,
  })

  const today = [...byTimestamp.entries()]
    .filter(([pointTime]) => pointTime >= dayStartMs)
    .sort(([left], [right]) => left - right)
    .map(([, point]) => point)
  const baseline = today[0]

  return {
    changeToday: currentStars - baseline.stars,
    points: compactPoints(today),
  }
}
