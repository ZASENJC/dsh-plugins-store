/**
 * Hard ceiling from deploy/server/dsh-plugins-store-receive.
 * The receiver sets `ulimit -f` to 128 MiB and kills oversized uploads with
 * SIGXFSZ (exit 153). It also rejects more than 10_000 archive entries or
 * 512 MiB extracted, and keeps three releases on disk.
 *
 * GitHub-hosted ubuntu-latest gives about 14 GB disk and 7 GB RAM. The
 * receiver upload timeout is 120s, so the compressed tarball must stay well
 * below the 128 MiB file-size trap.
 *
 * Publication caps target ~60-75% of those limits so star history, extra
 * routes, and HTML growth cannot silently cross SIGXFSZ.
 */
export const DEPLOY_MAX_ARCHIVE_BYTES = 128 * 1024 * 1024
export const DEPLOY_MAX_EXTRACTED_BYTES = 512 * 1024 * 1024
export const DEPLOY_MAX_ARCHIVE_ENTRIES = 10_000
export const DEPLOY_UPLOAD_TIMEOUT_SECONDS = 120

export const PUBLISH_COMPRESSED_BUDGET_BYTES = Math.floor(DEPLOY_MAX_ARCHIVE_BYTES * 0.75)
export const PUBLISH_EXTRACTED_BUDGET_BYTES = Math.floor(DEPLOY_MAX_EXTRACTED_BYTES * 0.75)
export const PUBLISH_FILE_BUDGET = 6_000

export const MAX_PUBLISHED_REPOSITORIES = 2_500
export const MAX_PUBLISHED_TOPICS = 400

export interface PublicationRankInput {
  repositoryId: number
  stars: number
  pushedAt: string
  verified: boolean
}

export interface PublishTreeMeasurement {
  files: number
  uncompressedBytes: number
  compressedBytes?: number
}

function normalizeLimit(limit: number | undefined, fallback: number): number {
  if (limit === undefined || !Number.isFinite(limit) || limit < 0) return fallback
  return Math.floor(limit)
}

export function comparePublicationRank(
  left: PublicationRankInput,
  right: PublicationRankInput,
): number {
  const verifiedDelta = Number(right.verified) - Number(left.verified)
  if (verifiedDelta !== 0) return verifiedDelta
  const starDelta = right.stars - left.stars
  if (starDelta !== 0) return starDelta
  const leftPushed = Date.parse(left.pushedAt)
  const rightPushed = Date.parse(right.pushedAt)
  const leftTime = Number.isFinite(leftPushed) ? leftPushed : 0
  const rightTime = Number.isFinite(rightPushed) ? rightPushed : 0
  if (rightTime !== leftTime) return rightTime - leftTime
  return left.repositoryId - right.repositoryId
}

export function selectPublishedByRank<T extends PublicationRankInput>(
  entries: readonly T[],
  limit = MAX_PUBLISHED_REPOSITORIES,
): T[] {
  const max = normalizeLimit(limit, MAX_PUBLISHED_REPOSITORIES)
  return [...entries].sort(comparePublicationRank).slice(0, max)
}

export function selectPublishedTopics(
  entries: readonly { topics?: readonly string[] }[],
  limit = MAX_PUBLISHED_TOPICS,
): string[] {
  const max = normalizeLimit(limit, MAX_PUBLISHED_TOPICS)
  const counts = new Map<string, number>()
  for (const entry of entries) {
    for (const topic of new Set(entry.topics ?? [])) {
      if (!topic) continue
      counts.set(topic, (counts.get(topic) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .sort(([leftTopic, leftCount], [rightTopic, rightCount]) => (
      rightCount - leftCount || leftTopic.localeCompare(rightTopic)
    ))
    .slice(0, max)
    .map(([topic]) => topic)
}

export function assertFitsDeployBudget(measurement: PublishTreeMeasurement): void {
  if (measurement.files > PUBLISH_FILE_BUDGET) {
    throw new Error(
      `Generated site exceeds the file publication budget: ${measurement.files} > ${PUBLISH_FILE_BUDGET}`,
    )
  }
  if (measurement.uncompressedBytes > PUBLISH_EXTRACTED_BUDGET_BYTES) {
    throw new Error(
      `Generated site exceeds the extracted publication budget: ${measurement.uncompressedBytes} > ${PUBLISH_EXTRACTED_BUDGET_BYTES}`,
    )
  }
  if (
    measurement.compressedBytes !== undefined
    && measurement.compressedBytes > PUBLISH_COMPRESSED_BUDGET_BYTES
  ) {
    throw new Error(
      `Generated site exceeds the compressed publication budget: ${measurement.compressedBytes} > ${PUBLISH_COMPRESSED_BUDGET_BYTES}`,
    )
  }
}
