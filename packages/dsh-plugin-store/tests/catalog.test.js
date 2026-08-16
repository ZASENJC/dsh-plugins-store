import { describe, expect, it, vi } from 'vitest'

import {
  CatalogStore,
  DEFAULT_CATALOG_URLS,
  buildInstallCommand,
  buildInstallPlan,
  buildCatalogDetailUrl,
  filterCatalogRepositories,
  formatCompactNumber,
  getCatalogFilterOptions,
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
    validation: { overall: 'verified', label: '已验证', sourceSha: 'a'.repeat(40) },
    install: {
      status: 'recognized',
      candidate: {
        source: 'github',
        target: 'owner/verified-ui',
        command: `dsh plugin --profile web add github:owner/verified-ui#${'a'.repeat(40)}`,
        args: ['plugin', '--profile', 'web', 'add', `github:owner/verified-ui#${'a'.repeat(40)}`],
        executable: true,
        evidence: { source: 'readme', pattern: 'dsh-plugin-add', heading: 'Install' },
      },
    },
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
    validation: { overall: 'check-pending', label: '待结构检查' },
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
    validation: { overall: 'not-applicable', label: '非插件验证范围' },
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

  it('keeps updateable installed rows above ordinary rows and supports installed-only filtering', () => {
    const result = filterCatalogRepositories([
      { ...repositories[1], installed: false, updateAvailable: false },
      { ...repositories[0], installed: true, updateAvailable: true },
      { ...repositories[2], installed: true, updateAvailable: false },
    ], {
      query: '',
      category: 'all',
      installedOnly: false,
      verifiedOnly: false,
      sort: 'name',
    })

    expect(result.map(({ repositoryId }) => repositoryId)).toEqual([1, 3, 2])
    expect(filterCatalogRepositories(result, {
      query: '',
      category: 'all',
      installedOnly: true,
      verifiedOnly: false,
      sort: 'recommended',
    }).map(({ repositoryId }) => repositoryId)).toEqual([1, 3])
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

  it('filters the remote catalog by the refreshable validation ladder state', () => {
    expect(filterCatalogRepositories(repositories, {
      query: '',
      category: 'all',
      validation: 'check-pending',
      verifiedOnly: false,
      sort: 'recommended',
    }).map(({ repositoryId }) => repositoryId)).toEqual([2])
  })

  it('filters API catalog rows by project type when requested', () => {
    expect(filterCatalogRepositories(repositories, {
      query: '',
      category: 'all',
      projectType: 'plugin',
      verifiedOnly: false,
      sort: 'recommended',
    }).map(({ repositoryId }) => repositoryId)).toEqual([1])
  })

  it('does not treat a legacy verification record as current SHA verification', () => {
    const legacyRecorded = {
      ...repositories[0],
      repositoryId: 4,
      fullName: 'owner/legacy-recorded',
      verified: true,
      validation: { overall: 'recorded', label: '已有验证记录' },
    }

    expect(filterCatalogRepositories([repositories[0], legacyRecorded], {
      query: '',
      category: 'all',
      verifiedOnly: true,
      sort: 'recommended',
    }).map(({ repositoryId }) => repositoryId)).toEqual([1])
  })

  it('only offers a pinned command for currently verified install-shaped project types', () => {
    expect(buildInstallCommand(repositories[0])).toBe(
      `dsh plugin --profile web add github:owner/verified-ui#${'a'.repeat(40)}`,
    )
    expect(buildInstallPlan(repositories[0])).toMatchObject({
      source: 'github',
      target: 'owner/verified-ui',
      args: ['plugin', '--profile', 'web', 'add', `github:owner/verified-ui#${'a'.repeat(40)}`],
    })
    expect(buildInstallCommand(repositories[1])).toBeNull()
    expect(buildInstallCommand(repositories[2])).toBeNull()
  })

  it('builds a safe plan for a recognized README command before validation completes', () => {
    const repository = {
      ...repositories[0],
      repositoryId: 6,
      fullName: 'owner/unverified-plugin',
      validation: { overall: 'check-pending' },
      install: {
        status: 'recognized',
        candidate: {
          source: 'github',
          target: 'owner/unverified-plugin',
          command: 'dsh plugin --profile web add github:owner/unverified-plugin',
          args: ['plugin', '--profile', 'web', 'add', 'github:owner/unverified-plugin'],
          executable: true,
          evidence: { source: 'readme', pattern: 'dsh-plugin-add', heading: 'Install' },
        },
      },
    }

    expect(buildInstallPlan(repository)).toMatchObject({
      source: 'github',
      target: 'owner/unverified-plugin',
      args: ['plugin', '--profile', 'web', 'add', 'github:owner/unverified-plugin'],
      executable: true,
    })
  })

  it('builds a safe plan for a recognized npm README command before validation completes', () => {
    const repository = {
      ...repositories[0],
      repositoryId: 7,
      fullName: 'owner/npm-plugin',
      validation: { overall: 'check-pending' },
      install: {
        status: 'recognized',
        candidate: {
          source: 'npm',
          target: 'dsh-example',
          command: 'npm install dsh-example',
          args: ['plugin', '--profile', 'web', 'add', 'npm:dsh-example'],
          executable: true,
          evidence: { source: 'readme', pattern: 'package-manager-add', heading: 'Install' },
        },
      },
    }

    expect(buildInstallPlan(repository)).toMatchObject({
      source: 'npm',
      target: 'dsh-example',
      args: ['plugin', '--profile', 'web', 'add', 'npm:dsh-example'],
      executable: true,
    })
  })

  it('never manufactures an unpinned GitHub command', () => {
    const plan = buildInstallPlan(repositories[0])
    expect(plan?.args[4]).toBe(`github:owner/verified-ui#${'a'.repeat(40)}`)
    expect(plan?.command).not.toBe('dsh plugin --profile web add github:owner/verified-ui')
    expect(buildInstallPlan({
      ...repositories[0],
      install: {
        status: 'recognized',
        candidate: {
          ...repositories[0].install.candidate,
          target: 'owner/other-repository',
        },
      },
    })).toBeNull()
  })

  it('shows an npm README command while withholding host execution when it is display-only', () => {
    const npmRepository = {
      ...repositories[0],
      repositoryId: 5,
      fullName: 'owner/npm-plugin',
      install: {
        status: 'recognized',
        candidate: {
          source: 'npm',
          target: 'dsh-example',
          command: 'npm install dsh-example',
          args: [],
          executable: false,
          evidence: { source: 'readme', pattern: 'package-manager-add', heading: 'Install' },
        },
      },
    }

    expect(buildInstallCommand(npmRepository)).toBe('npm install dsh-example')
    expect(buildInstallPlan(npmRepository)).toBeNull()
  })

  it('does not fall back to a repository full name without README evidence', () => {
    expect(buildInstallCommand({
      ...repositories[0],
      install: undefined,
    })).toBeNull()
  })

  it('rejects a verified catalog row without a complete source SHA', () => {
    const repository = {
      ...repositories[0],
      validation: { overall: 'verified', sourceSha: 'main' },
    }
    expect(buildInstallCommand(repository)).toBe(repositories[0].install.candidate.command)
    expect(buildInstallPlan(repository)).toBeNull()
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
      },
      {
        ...repositories[0],
        name: 'Same name',
        fullName: 'a/same',
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
  it('uses only the primary market API', async () => {
    expect(DEFAULT_CATALOG_URLS).toEqual(['https://api.dshmk.com/catalog.json'])
    const fetcher = vi.fn().mockResolvedValue({ ok: false, status: 503 })
    const store = new CatalogStore({ fetcher })
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)

    await store.load()

    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.dshmk.com/catalog.json',
      { headers: { Accept: 'application/json' } },
    )
    expect(store.getSnapshot()).toMatchObject({
      status: 'error',
      catalog: null,
      error: '目录请求失败 (503)',
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
    const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => null })
    const store = new CatalogStore({
      fetcher,
      urls: ['one'],
    })

    await store.load()

    expect(store.getSnapshot()).toMatchObject({
      status: 'error',
      catalog: null,
      error: '目录响应格式无效',
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

  it('derives filter options from API facets and preserves new API-defined values', () => {
    const options = getCatalogFilterOptions({
      stats: {
        categories: { ui: 2, experimental: 1 },
        projectTypes: { plugin: 2, workflow: 1 },
        validationStatuses: { verified: 1, 'review-queued': 2 },
      },
      repositories: [],
    })

    expect(options).toEqual({
      categories: ['all', 'ui', 'experimental'],
      projectTypes: ['plugin', 'workflow'],
      validationStatuses: ['verified', 'review-queued'],
    })
  })

  it('falls back to repository values when an older API response has no facet stats', () => {
    const options = getCatalogFilterOptions({
      repositories: [
        { category: 'ui', projectType: 'plugin', validation: { overall: 'verified' } },
        { category: 'experimental', projectType: 'workflow', validation: { overall: 'review-queued' } },
      ],
    })

    expect(options).toEqual({
      categories: ['all', 'ui', 'experimental'],
      projectTypes: ['plugin', 'workflow'],
      validationStatuses: ['verified', 'review-queued'],
    })
  })

  it('derives the market detail route from the configured catalog API origin', () => {
    expect(buildCatalogDetailUrl(
      'https://catalog.example.test/catalog.json',
      'github:123',
    )).toBe('https://catalog.example.test/plugins/github%3A123')
  })

  it('bypasses the browser cache for an explicit API refresh', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ schemaVersion: 1, repositories }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ schemaVersion: 1, repositories }) })
    const store = new CatalogStore({ fetcher, urls: ['https://catalog.example.test/catalog.json'] })

    await store.load()
    await store.load({ force: true })

    expect(fetcher).toHaveBeenNthCalledWith(1, 'https://catalog.example.test/catalog.json', {
      headers: { Accept: 'application/json' },
    })
    expect(fetcher).toHaveBeenNthCalledWith(2, 'https://catalog.example.test/catalog.json', {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })
  })
})
