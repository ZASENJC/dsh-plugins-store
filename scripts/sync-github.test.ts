import { describe, expect, it } from 'vitest'

import {
  buildSearchQuery,
  fetchAllSearchRepositories,
  filterEligibleRepositories,
  type SearchPartition,
  type SearchRepository,
} from '../src/lib/github-discovery'

function repository(overrides: Partial<SearchRepository> = {}): SearchRepository {
  return {
    id: 1,
    name: 'example-plugin',
    full_name: 'example/example-plugin',
    owner: { login: 'example', avatar_url: 'https://example.com/avatar.png' },
    html_url: 'https://github.com/example/example-plugin',
    description: 'A DSH plugin',
    fork: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    pushed_at: '2026-01-01T00:00:00Z',
    homepage: null,
    size: 1,
    stargazers_count: 1,
    forks_count: 0,
    open_issues_count: 0,
    language: 'TypeScript',
    archived: false,
    license: null,
    topics: ['dsh-plugin', 'deepseek-harness'],
    ...overrides,
  }
}

describe('GitHub catalog discovery filter', () => {
  it('requires both ecosystem topics and excludes archived repositories and forks at query level', () => {
    const query = buildSearchQuery(1)

    expect(query.get('q')).toBe(
      'topic:dsh-plugin topic:deepseek-harness archived:false fork:false',
    )
    expect(query.get('page')).toBe('1')
    expect(query.get('per_page')).toBe('100')
  })

  it('adds date and star qualifiers to partition queries', () => {
    const query = buildSearchQuery(
      2,
      { createdStart: '2026-01-01', createdEnd: '2026-01-02', starsStart: 4, starsEnd: 9 },
      { sort: 'stars', order: 'asc' },
    )

    expect(query.get('q')).toContain('created:2026-01-01..2026-01-02')
    expect(query.get('q')).toContain('stars:4..9')
    expect(query.get('sort')).toBe('stars')
    expect(query.get('order')).toBe('asc')
    expect(query.get('page')).toBe('2')
  })

  it('keeps a non-application repository and defensively excludes archived repositories and forks', () => {
    const kept = repository()
    const result = filterEligibleRepositories([
      kept,
      repository({ id: 2, archived: true }),
      repository({ id: 3, fork: true }),
    ])

    expect(result).toEqual([kept])
  })

  it('excludes repositories missing either required ecosystem topic', () => {
    const result = filterEligibleRepositories([
      repository({ id: 5, topics: ['dsh-plugin'] }),
      repository({ id: 6, topics: ['deepseek-harness'] }),
    ])

    expect(result).toEqual([])
  })

  it('excludes the host application even when it has both ecosystem topics', () => {
    const result = filterEligibleRepositories([
      repository({
        id: 4,
        name: 'deepseek-harness',
        full_name: 'deepseek-ai/deepseek-harness',
        description: 'The DSH host application',
      }),
    ])

    expect(result).toEqual([])
  })

  it('fetches every repository by splitting an oversized search into date partitions', async () => {
    const rows = Array.from({ length: 5 }, (_, index) => repository({
      id: index + 1,
      created_at: `2026-01-0${index < 3 ? 1 : 2}T00:00:00Z`,
    }))
    const calls: Array<{ page: number; partition: SearchPartition }> = []
    const fetcher = async (
      page: number,
      partition: SearchPartition,
      request: { sort: 'stars' | 'created'; order: 'asc' | 'desc' },
    ) => {
      calls.push({ page, partition })
      const key = partition.createdStart === undefined
        ? 'root'
        : String(partition.createdStart)
      const matching = key === 'root'
        ? rows
        : rows.filter((row) => row.created_at.startsWith(key))
      matching.sort((left, right) => request.order === 'asc'
        ? left.created_at.localeCompare(right.created_at)
        : right.created_at.localeCompare(left.created_at))
      const pageSize = 2
      return {
        total_count: matching.length,
        incomplete_results: false,
        items: matching.slice((page - 1) * pageSize, page * pageSize),
      }
    }

    const result = await fetchAllSearchRepositories(fetcher, {
      maxResultsPerQuery: 3,
      pageSize: 2,
      initialDateStart: '2026-01-01',
      initialDateEnd: '2026-01-02',
    })

    expect(result.reportedByGitHub).toBe(5)
    expect(result.repositories.map(({ id }) => id)).toEqual([1, 2, 3, 4, 5])
    expect(result.allRepositories.map(({ id }) => id)).toEqual([1, 2, 3, 4, 5])
    expect(calls.some(({ partition }) => partition.createdStart === '2026-01-01')).toBe(true)
    expect(calls.some(({ partition }) => partition.createdStart === '2026-01-02')).toBe(true)
  })

  it('falls back to star partitions when one creation day is still oversized', async () => {
    const rows = Array.from({ length: 5 }, (_, index) => repository({
      id: index + 1,
      stargazers_count: index,
      created_at: '2026-01-01T00:00:00Z',
    }))
    const fetcher = async (
      page: number,
      partition: SearchPartition,
      request: { sort: 'stars' | 'created'; order: 'asc' | 'desc' },
    ) => {
      const matching = rows
        .filter((row) => partition.starsStart === undefined
          || (row.stargazers_count >= partition.starsStart
            && row.stargazers_count <= partition.starsEnd!))
        .sort((left, right) => request.order === 'asc'
          ? left.stargazers_count - right.stargazers_count
          : right.stargazers_count - left.stargazers_count)
      const pageSize = 2
      return {
        total_count: matching.length,
        incomplete_results: false,
        items: matching.slice((page - 1) * pageSize, page * pageSize),
      }
    }

    const result = await fetchAllSearchRepositories(fetcher, {
      maxResultsPerQuery: 3,
      pageSize: 2,
      initialDateStart: '2026-01-01',
      initialDateEnd: '2026-01-01',
    })

    expect(new Set(result.repositories.map(({ id }) => id))).toEqual(new Set([1, 2, 3, 4, 5]))
  })

  it('uses historical date partitions without relying on created sort ordering', async () => {
    const rows = Array.from({ length: 4 }, (_, index) => repository({
      id: index + 1,
      stargazers_count: 1,
      created_at: `2026-01-0${index + 1}T00:00:00Z`,
    }))
    const requests: Array<{ partition: SearchPartition; sort: string }> = []
    const fetcher = async (
      page: number,
      partition: SearchPartition,
      request: { sort: 'stars' | 'created'; order: 'asc' | 'desc' },
    ) => {
      requests.push({ partition, sort: request.sort })
      const matching = rows.filter((row) => {
        const createdDay = row.created_at.slice(0, 10)
        return (partition.createdStart === undefined || createdDay >= partition.createdStart)
          && (partition.createdEnd === undefined || createdDay <= partition.createdEnd)
      })
      const pageSize = 2
      return {
        total_count: matching.length,
        incomplete_results: false,
        items: matching.slice((page - 1) * pageSize, page * pageSize),
      }
    }

    const result = await fetchAllSearchRepositories(fetcher, {
      maxResultsPerQuery: 3,
      pageSize: 2,
    })

    expect(result.repositories.map(({ id }) => id)).toEqual([1, 2, 3, 4])
    expect(requests.every(({ sort }) => sort === 'stars')).toBe(true)
  })

  it('recursively splits an existing star range when it is still oversized', async () => {
    const rows = Array.from({ length: 7 }, (_, index) => repository({
      id: index + 1,
      stargazers_count: index,
      created_at: '2026-01-01T00:00:00Z',
    }))
    const fetcher = async (
      page: number,
      partition: SearchPartition,
      request: { sort: 'stars' | 'created'; order: 'asc' | 'desc' },
    ) => {
      const matching = rows
        .filter((row) => partition.starsStart === undefined
          || (row.stargazers_count >= partition.starsStart
            && row.stargazers_count <= partition.starsEnd!))
        .sort((left, right) => request.order === 'asc'
          ? left.stargazers_count - right.stargazers_count
          : right.stargazers_count - left.stargazers_count)
      const pageSize = 2
      return {
        total_count: matching.length,
        incomplete_results: false,
        items: matching.slice((page - 1) * pageSize, page * pageSize),
      }
    }

    const result = await fetchAllSearchRepositories(fetcher, {
      maxResultsPerQuery: 3,
      pageSize: 2,
      initialDateStart: '2026-01-01',
      initialDateEnd: '2026-01-01',
    })

    expect(new Set(result.repositories.map(({ id }) => id))).toEqual(
      new Set([1, 2, 3, 4, 5, 6, 7]),
    )
  })
})
