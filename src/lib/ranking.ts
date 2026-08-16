import type { CatalogEntry } from './catalog'
import type { StarHistoryPoint } from './star-history'

export type RankingMode = 'stars24h' | 'stars' | 'newest' | 'updated'

export const RANKING_MODES: ReadonlyArray<{ id: RankingMode, label: string }> = [
  { id: 'stars24h', label: '24h Star 增速' },
  { id: 'stars', label: '最多 Star' },
  { id: 'newest', label: '最新发布' },
  { id: 'updated', label: '最近更新' },
]

export function sortRankingEntries(entries: CatalogEntry[], mode: RankingMode): CatalogEntry[] {
  return [...entries].sort((left, right) => {
    if (mode === 'stars24h') {
      const leftChange = left.starTrend?.change24h
      const rightChange = right.starTrend?.change24h
      const measuredPriority = Number(rightChange !== null && rightChange !== undefined)
        - Number(leftChange !== null && leftChange !== undefined)
      if (measuredPriority !== 0) return measuredPriority
      if (leftChange !== null && leftChange !== undefined
        && rightChange !== null && rightChange !== undefined
        && leftChange !== rightChange) return rightChange - leftChange
    }
    if (mode === 'newest') {
      const createdPriority = Date.parse(right.createdAt) - Date.parse(left.createdAt)
      if (createdPriority !== 0) return createdPriority
    }
    if (mode === 'updated') {
      const updatedPriority = Date.parse(right.pushedAt) - Date.parse(left.pushedAt)
      if (updatedPriority !== 0) return updatedPriority
    }
    return right.stars - left.stars || left.fullName.localeCompare(right.fullName)
  })
}

export function buildSparklinePoints(
  points: StarHistoryPoint[],
  width = 96,
  height = 28,
  padding = 2,
): string {
  if (points.length === 0) return ''
  if (points.length === 1) return `${padding},${height / 2} ${width - padding},${height / 2}`

  const timestamps = points.map(({ capturedAt }) => Date.parse(capturedAt))
  const stars = points.map((point) => point.stars)
  const minTime = Math.min(...timestamps)
  const maxTime = Math.max(...timestamps)
  const minStars = Math.min(...stars)
  const maxStars = Math.max(...stars)
  const usableWidth = width - padding * 2
  const usableHeight = height - padding * 2

  return points.map((point, index) => {
    const x = maxTime === minTime
      ? padding + usableWidth * index / (points.length - 1)
      : padding + usableWidth * (timestamps[index] - minTime) / (maxTime - minTime)
    const y = maxStars === minStars
      ? height / 2
      : padding + usableHeight * (maxStars - point.stars) / (maxStars - minStars)
    return `${Number(x.toFixed(1))},${Number(y.toFixed(1))}`
  }).join(' ')
}
