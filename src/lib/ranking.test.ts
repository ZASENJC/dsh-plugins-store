import { describe, expect, it } from 'vitest'

import { buildSparklinePoints, sortRankingEntries } from './ranking'
import { buildCatalog } from './catalog'

const repository = (id: number, overrides: Record<string, unknown> = {}) => ({
  id,
  name: `repo-${id}`,
  full_name: `owner/repo-${id}`,
  owner: { login: 'owner', avatar_url: 'https://example.com/avatar.png' },
  html_url: `https://github.com/owner/repo-${id}`,
  description: null,
  fork: false,
  created_at: '2026-08-10T00:00:00Z',
  updated_at: '2026-08-10T00:00:00Z',
  pushed_at: '2026-08-10T00:00:00Z',
  homepage: null,
  size: 1,
  stargazers_count: 1,
  forks_count: 0,
  open_issues_count: 0,
  language: 'TypeScript',
  archived: false,
  license: null,
  topics: ['deepseek-harness', 'dsh-plugin'],
  default_branch: 'main',
  ...overrides,
})

describe('catalog rankings', () => {
  it('sorts all four ranking modes by their named metric', () => {
    const previous = buildCatalog([
      repository(1, { stargazers_count: 10 }),
      repository(2, { stargazers_count: 20 }),
      repository(3, { stargazers_count: 30 }),
    ], '2026-08-15T16:00:00.000Z')
    const current = buildCatalog([
      repository(1, {
        stargazers_count: 15,
        created_at: '2026-08-12T00:00:00Z',
        pushed_at: '2026-08-14T00:00:00Z',
      }),
      repository(2, {
        stargazers_count: 21,
        created_at: '2026-08-14T00:00:00Z',
        pushed_at: '2026-08-12T00:00:00Z',
      }),
      repository(3, {
        stargazers_count: 32,
        created_at: '2026-08-13T00:00:00Z',
        pushed_at: '2026-08-15T00:00:00Z',
      }),
    ], '2026-08-16T12:00:00.000Z', 3, new Set(), new Map(), new Map(), null, previous)

    expect(sortRankingEntries(current.repositories, 'starsToday').map(({ repositoryId }) => repositoryId)).toEqual([1, 3, 2])
    expect(sortRankingEntries(current.repositories, 'stars').map(({ repositoryId }) => repositoryId)).toEqual([3, 2, 1])
    expect(sortRankingEntries(current.repositories, 'newest').map(({ repositoryId }) => repositoryId)).toEqual([2, 3, 1])
    expect(sortRankingEntries(current.repositories, 'updated').map(({ repositoryId }) => repositoryId)).toEqual([3, 1, 2])
  })

  it('uses total Stars as the tie-breaker when daily growth is equal', () => {
    const lower = buildCatalog([repository(1)], '2026-08-16T12:00:00.000Z').repositories[0]
    const higher = buildCatalog([repository(2, { stargazers_count: 100 })], '2026-08-16T12:00:00.000Z').repositories[0]

    expect(sortRankingEntries([lower, higher], 'starsToday').map(({ repositoryId }) => repositoryId)).toEqual([2, 1])
  })

  it('creates a stable nonblank sparkline for changing and flat histories', () => {
    expect(buildSparklinePoints([
      { capturedAt: '2026-08-16T10:00:00Z', stars: 1 },
      { capturedAt: '2026-08-16T11:00:00Z', stars: 2 },
      { capturedAt: '2026-08-16T12:00:00Z', stars: 4 },
    ])).toBe('2,26 48,18 94,2')
    expect(buildSparklinePoints([
      { capturedAt: '2026-08-16T10:00:00Z', stars: 4 },
      { capturedAt: '2026-08-16T12:00:00Z', stars: 4 },
    ])).toBe('2,14 94,14')
  })
})
