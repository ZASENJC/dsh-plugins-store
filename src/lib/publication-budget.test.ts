import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  DEPLOY_MAX_ARCHIVE_BYTES,
  DEPLOY_MAX_ARCHIVE_ENTRIES,
  DEPLOY_MAX_EXTRACTED_BYTES,
  MAX_PUBLISHED_REPOSITORIES,
  MAX_PUBLISHED_TOPICS,
  PUBLISH_COMPRESSED_BUDGET_BYTES,
  PUBLISH_EXTRACTED_BUDGET_BYTES,
  PUBLISH_FILE_BUDGET,
  assertFitsDeployBudget,
  selectPublishedByRank,
  selectPublishedTopics,
  type PublicationRankInput,
} from './publication-budget'

function entry(overrides: Partial<PublicationRankInput> & { topics?: string[] } = {}): PublicationRankInput & { topics: string[] } {
  return {
    repositoryId: 1,
    stars: 0,
    pushedAt: '2026-09-01T00:00:00.000Z',
    verified: false,
    topics: ['dsh-plugin'],
    ...overrides,
  }
}

describe('publication budget', () => {
  it('keeps the public catalog and topic pages inside the server deploy ceiling', () => {
    const pluginPageBytes = 90 * 1024
    const topicPageBytes = 60 * 1024
    const catalogJsonBytes = 12 * 1024 * 1024
    const inlinedCatalogPages = 3
    const overheadBytes = 5 * 1024 * 1024
    const estimatedExtracted = MAX_PUBLISHED_REPOSITORIES * pluginPageBytes
      + MAX_PUBLISHED_TOPICS * topicPageBytes
      + catalogJsonBytes * (1 + inlinedCatalogPages)
      + overheadBytes
    const estimatedFiles = MAX_PUBLISHED_REPOSITORIES + MAX_PUBLISHED_TOPICS + 50
    const gzipRatio = 4

    expect(MAX_PUBLISHED_REPOSITORIES).toBe(2_500)
    expect(MAX_PUBLISHED_TOPICS).toBe(400)
    expect(DEPLOY_MAX_ARCHIVE_BYTES).toBe(128 * 1024 * 1024)
    expect(DEPLOY_MAX_EXTRACTED_BYTES).toBe(512 * 1024 * 1024)
    expect(DEPLOY_MAX_ARCHIVE_ENTRIES).toBe(10_000)
    expect(estimatedExtracted).toBeLessThan(PUBLISH_EXTRACTED_BUDGET_BYTES)
    expect(estimatedExtracted / gzipRatio).toBeLessThan(PUBLISH_COMPRESSED_BUDGET_BYTES)
    expect(estimatedFiles).toBeLessThan(PUBLISH_FILE_BUDGET)
    expect(PUBLISH_COMPRESSED_BUDGET_BYTES).toBeLessThan(DEPLOY_MAX_ARCHIVE_BYTES)
    expect(PUBLISH_EXTRACTED_BUDGET_BYTES).toBeLessThan(DEPLOY_MAX_EXTRACTED_BYTES)
    expect(PUBLISH_FILE_BUDGET).toBeLessThan(DEPLOY_MAX_ARCHIVE_ENTRIES)
  })

  it('keeps the highest-priority repositories and drops the rest at the cap', () => {
    const entries = [
      entry({ repositoryId: 1, stars: 9, verified: false, pushedAt: '2026-09-10T00:00:00.000Z' }),
      entry({ repositoryId: 2, stars: 1, verified: true, pushedAt: '2026-08-01T00:00:00.000Z' }),
      entry({ repositoryId: 3, stars: 8, verified: true, pushedAt: '2026-09-12T00:00:00.000Z' }),
      entry({ repositoryId: 4, stars: 8, verified: true, pushedAt: '2026-09-11T00:00:00.000Z' }),
    ]

    expect(selectPublishedByRank(entries, 3).map(({ repositoryId }) => repositoryId)).toEqual([3, 4, 2])
    expect(selectPublishedByRank(entries).map(({ repositoryId }) => repositoryId)).toEqual([3, 4, 2, 1])
  })

  it('caps an oversized catalog to the publication maximum', () => {
    const entries = Array.from({ length: MAX_PUBLISHED_REPOSITORIES + 7 }, (_, index) => entry({
      repositoryId: index + 1,
      stars: index,
    }))
    const published = selectPublishedByRank(entries)

    expect(published).toHaveLength(MAX_PUBLISHED_REPOSITORIES)
    expect(published[0]?.repositoryId).toBe(MAX_PUBLISHED_REPOSITORIES + 7)
    expect(published.at(-1)?.repositoryId).toBe(8)
    expect(published.some(({ repositoryId }) => repositoryId <= 7)).toBe(false)
  })

  it('ignores invalid publication limits instead of growing without bound', () => {
    const entries = [entry({ repositoryId: 1 }), entry({ repositoryId: 2 })]

    expect(selectPublishedByRank(entries, Number.POSITIVE_INFINITY)).toHaveLength(2)
    expect(selectPublishedByRank(entries, -3)).toHaveLength(2)
    expect(selectPublishedByRank(entries, 1.9).map(({ repositoryId }) => repositoryId)).toEqual([1])
  })

  it('publishes the most common topics and keeps the topic list bounded', () => {
    const entries = [
      ...Array.from({ length: 5 }, (_, index) => entry({ repositoryId: index + 1, topics: ['dsh-plugin', 'popular'] })),
      entry({ repositoryId: 10, topics: ['dsh-plugin', 'rare'] }),
      entry({ repositoryId: 11, topics: ['dsh-plugin', 'also-rare'] }),
    ]

    expect(selectPublishedTopics(entries, 2)).toEqual(['dsh-plugin', 'popular'])
    expect(selectPublishedTopics(entries)).toHaveLength(4)
    expect(selectPublishedTopics(entries, 0)).toEqual([])
  })

  it('rejects a generated site that would trip the server archive ulimit', () => {
    expect(() => assertFitsDeployBudget({
      files: 100,
      uncompressedBytes: 10 * 1024 * 1024,
      compressedBytes: PUBLISH_COMPRESSED_BUDGET_BYTES + 1,
    })).toThrow(/compressed publication budget/i)

    expect(() => assertFitsDeployBudget({
      files: PUBLISH_FILE_BUDGET + 1,
      uncompressedBytes: 10 * 1024 * 1024,
      compressedBytes: 1024,
    })).toThrow(/file publication budget/i)

    expect(() => assertFitsDeployBudget({
      files: 100,
      uncompressedBytes: PUBLISH_EXTRACTED_BUDGET_BYTES + 1,
      compressedBytes: 1024,
    })).toThrow(/extracted publication budget/i)
  })

  it('accepts a generated site inside the publication budget', () => {
    expect(() => assertFitsDeployBudget({
      files: 2_920,
      uncompressedBytes: 252 * 1024 * 1024,
      compressedBytes: 56 * 1024 * 1024,
    })).not.toThrow()
  })

  it('builds topic pages from the publication cap instead of every GitHub tag', () => {
    const topicSource = readFileSync(
      fileURLToPath(new URL('../pages/topics/[topic].astro', import.meta.url)),
      'utf8',
    )

    expect(topicSource).toContain('selectPublishedTopics')
    expect(topicSource).not.toContain('catalog.repositories.flatMap((repository) => repository.topics)')
  })
})
