import { describe, expect, it } from 'vitest'

import {
  discoverCatalogRepositories,
  parseShadowCliOptions,
  selectRepositoryShard,
} from './shadow-cli'

const catalog = {
  schemaVersion: 1,
  generatedAt: '2026-08-14T00:00:00Z',
  repositories: Array.from({ length: 43 }, (_, index) => ({
    repositoryId: index + 1,
    fullName: `fixture/plugin-${index + 1}`,
    url: `https://github.com/fixture/plugin-${index + 1}`,
    pushedAt: '2026-08-14T00:00:00Z',
    projectType: index === 0 ? 'unknown' : 'plugin',
    topics: ['dsh-plugin'],
    defaultBranch: 'main',
    archived: false,
    size: 120,
  })),
}

describe('catalog discovery and stable sharding', () => {
  it('maps every catalog repository into the shadow discovery contract', () => {
    const repositories = discoverCatalogRepositories(catalog)

    expect(repositories).toHaveLength(43)
    expect(repositories[0]).toMatchObject({
      repositoryId: 1,
      fullName: 'fixture/plugin-1',
      projectType: 'unknown',
      archived: false,
      sizeKb: 120,
    })
  })

  it('splits a large catalog without duplicates or skipped repository IDs', () => {
    const repositories = discoverCatalogRepositories(catalog)
    const ids = Array.from({ length: 20 }, (_, shardIndex) => (
      selectRepositoryShard(repositories, shardIndex, 20).map(({ repositoryId }) => repositoryId)
    )).flat()

    expect(ids).toHaveLength(repositories.length)
    expect(new Set(ids).size).toBe(repositories.length)
    expect([...ids].sort((left, right) => left - right)).toEqual(
      repositories.map(({ repositoryId }) => repositoryId),
    )
  })

  it('rejects invalid shard coordinates instead of silently skipping work', () => {
    const repositories = discoverCatalogRepositories(catalog)

    expect(() => selectRepositoryShard(repositories, 20, 20)).toThrow('shard')
    expect(() => selectRepositoryShard(repositories, -1, 20)).toThrow('shard')
    expect(() => selectRepositoryShard(repositories, 0, 0)).toThrow('shard')
  })

  it('applies an incremental selection without changing stable catalog shard coordinates', () => {
    const repositories = discoverCatalogRepositories(catalog)
    const selected = new Set([2, 22, 23])

    expect(selectRepositoryShard(repositories, 1, 20, selected).map(({ repositoryId }) => repositoryId))
      .toEqual([2, 22])
    expect(parseShadowCliOptions(['--selection', 'selection.json']).selectionPath)
      .toContain('selection.json')
  })
})
