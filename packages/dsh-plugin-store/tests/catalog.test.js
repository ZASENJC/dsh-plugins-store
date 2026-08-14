import { describe, expect, it, vi } from 'vitest'

import {
  CatalogStore,
  buildInstallCommand,
  filterCatalogRepositories,
} from '../src/catalog.js'

const repositories = [
  {
    repositoryId: 1,
    name: 'Verified UI',
    fullName: 'owner/verified-ui',
    description: 'A verified sidebar plugin',
    topics: ['sidebar'],
    category: 'ui',
    projectType: 'plugin',
    stars: 20,
    pushedAt: '2026-08-14T00:00:00Z',
    verified: true,
  },
  {
    repositoryId: 2,
    name: 'Search Skill',
    fullName: 'owner/search-skill',
    description: 'Research helper',
    topics: ['research'],
    category: 'research',
    projectType: 'skill',
    stars: 5,
    pushedAt: '2026-08-13T00:00:00Z',
    verified: false,
  },
  {
    repositoryId: 3,
    name: 'Desktop App',
    fullName: 'owner/desktop-app',
    description: 'Standalone application',
    topics: ['desktop'],
    category: 'ui',
    projectType: 'application',
    stars: 50,
    pushedAt: '2026-08-12T00:00:00Z',
    verified: false,
  },
]

describe('plugin catalog filtering', () => {
  it('combines query, category, verification and sorting without changing the source list', () => {
    const result = filterCatalogRepositories(repositories, {
      query: 'sidebar owner',
      category: 'ui',
      verifiedOnly: true,
      sort: 'stars',
    })

    expect(result.map(({ fullName }) => fullName)).toEqual(['owner/verified-ui'])
    expect(repositories.map(({ repositoryId }) => repositoryId)).toEqual([1, 2, 3])
  })

  it('returns the newest matching projects and handles empty results', () => {
    expect(filterCatalogRepositories(repositories, {
      query: '',
      category: 'all',
      verifiedOnly: false,
      sort: 'updated',
    }).map(({ repositoryId }) => repositoryId)).toEqual([1, 2, 3])

    expect(filterCatalogRepositories(repositories, {
      query: 'missing',
      category: 'all',
      verifiedOnly: false,
      sort: 'recommended',
    })).toEqual([])
  })

  it('only offers the existing reference command for install-shaped project types', () => {
    expect(buildInstallCommand(repositories[0])).toBe(
      'dsh plugin --profile web add github:owner/verified-ui',
    )
    expect(buildInstallCommand(repositories[1])).toBe(
      'dsh plugin --profile web add github:owner/search-skill',
    )
    expect(buildInstallCommand(repositories[2])).toBeNull()
  })
})

describe('remote catalog state', () => {
  it('falls back to the secondary public source and shares one successful snapshot', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          schemaVersion: 1,
          generatedAt: '2026-08-14T00:00:00Z',
          stats: { fetched: 3, verified: 1 },
          repositories,
        }),
      })
    const store = new CatalogStore({
      fetcher,
      urls: ['https://primary.example/catalog.json', 'https://fallback.example/catalog.json'],
    })
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)

    await store.load()

    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(store.getSnapshot()).toMatchObject({
      status: 'ready',
      catalog: { repositories },
      error: null,
    })
    expect(listener).toHaveBeenCalled()
    unsubscribe()
  })

  it('publishes a retryable error when every source fails', async () => {
    const store = new CatalogStore({
      fetcher: vi.fn().mockRejectedValue(new Error('offline')),
      urls: ['https://primary.example/catalog.json'],
    })

    await store.load()

    expect(store.getSnapshot()).toMatchObject({
      status: 'error',
      catalog: null,
      error: 'offline',
    })
  })
})
