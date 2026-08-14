import { describe, expect, it, vi } from 'vitest'

import {
  CatalogStore,
  buildInstallCommand,
  filterCatalogRepositories,
  formatCompactNumber,
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

  it('uses deterministic name and recommended tie breakers for stable mounted views', () => {
    const tied = [
      {
        ...repositories[1],
        repositoryId: 4,
        name: 'Same name',
        fullName: 'z/same',
        topics: undefined,
        stars: 20,
        verified: true,
        awesomeListed: true,
      },
      {
        ...repositories[0],
        name: 'Same name',
        fullName: 'a/same',
        awesomeListed: true,
      },
    ]

    expect(filterCatalogRepositories(tied, {
      query: 'same',
      category: 'all',
      verifiedOnly: false,
      sort: 'name',
    }).map(({ fullName }) => fullName)).toEqual(['a/same', 'z/same'])
    expect(filterCatalogRepositories(tied, {
      query: '',
      category: 'all',
      verifiedOnly: false,
      sort: 'recommended',
    }).map(({ fullName }) => fullName)).toEqual(['a/same', 'z/same'])
    expect(formatCompactNumber(12500)).not.toBe('12500')
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

  it('rejects malformed responses and reports non-Error failures without trusting them', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => null })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ schemaVersion: 2, repositories }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ schemaVersion: 1 }) })
      .mockRejectedValueOnce('network unavailable')
    const store = new CatalogStore({
      fetcher,
      urls: ['one', 'two', 'three', 'four'],
    })

    await store.load()

    expect(store.getSnapshot()).toMatchObject({
      status: 'error',
      catalog: null,
      error: 'network unavailable',
    })
    expect(() => new CatalogStore({ fetcher: null })).toThrow('当前环境不支持目录请求')
  })

  it('deduplicates concurrent loads, reuses ready data, and refreshes only when forced', async () => {
    let resolveResponse
    const fetcher = vi.fn(() => new Promise((resolve) => {
      resolveResponse = resolve
    }))
    const store = new CatalogStore({ fetcher, urls: ['catalog'] })

    const first = store.load()
    const concurrent = store.load()
    expect(concurrent).toBe(first)
    resolveResponse({
      ok: true,
      json: async () => ({ schemaVersion: 1, repositories }),
    })
    await first
    await store.load()
    expect(fetcher).toHaveBeenCalledOnce()

    const refresh = store.load({ force: true })
    resolveResponse({
      ok: true,
      json: async () => ({ schemaVersion: 1, repositories: repositories.slice(0, 1) }),
    })
    await refresh

    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(store.getSnapshot().catalog.repositories).toHaveLength(1)
  })
})
