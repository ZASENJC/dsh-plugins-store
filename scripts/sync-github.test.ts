import { describe, expect, it } from 'vitest'

import {
  buildSearchQuery,
  filterEligibleRepositories,
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

  it('keeps a non-application repository and defensively excludes archived repositories and forks', () => {
    const kept = repository()
    const result = filterEligibleRepositories([
      kept,
      repository({ id: 2, archived: true }),
      repository({ id: 3, fork: true }),
    ])

    expect(result).toEqual([kept])
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
})
