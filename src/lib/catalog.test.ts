import { describe, expect, it } from 'vitest'

import {
  buildCatalog,
  createCatalogEntry,
  formatCompactNumber,
  formatRelativeDate,
  getCatalogDefinitions,
  getEmptyCatalog,
  sortCatalogEntries,
} from './catalog'

const githubRepository = {
  id: 1333496313,
  name: 'dsh-lark-bot',
  full_name: 'PlutoKeating/dsh-lark-bot',
  owner: {
    login: 'PlutoKeating',
    avatar_url: 'https://avatars.githubusercontent.com/u/62868186?v=4',
  },
  html_url: 'https://github.com/PlutoKeating/dsh-lark-bot',
  description: 'Bridge DeepSeek Harness into Feishu/Lark.',
  fork: false,
  created_at: '2026-08-13T20:03:14Z',
  updated_at: '2026-08-13T21:08:17Z',
  pushed_at: '2026-08-13T21:09:43Z',
  homepage: null,
  size: 50,
  stargazers_count: 2,
  forks_count: 0,
  open_issues_count: 0,
  language: 'TypeScript',
  archived: false,
  license: { spdx_id: 'AGPL-3.0' },
  topics: ['bot', 'bridge', 'deepseek-harness', 'dsh-plugin', 'feishu', 'lark'],
}

describe('catalog data', () => {
  it('converts GitHub metadata into a stable classified catalog entry', () => {
    const entry = createCatalogEntry(githubRepository)

    expect(entry.id).toBe('github:1333496313')
    expect(entry.slug).toBe('1333496313')
    expect(entry.owner.avatarUrl).toContain('avatars.githubusercontent.com')
    expect(entry.projectType).toBe('channel')
    expect(entry.category).toBe('communication')
    expect(entry.status).toEqual({ discovery: 'topic-listed', verification: 'not-verified' })
  })

  it('builds deterministic counts and removes duplicate repository ids', () => {
    const duplicate = { ...githubRepository, full_name: 'Renamed/dsh-lark-bot' }
    const catalog = buildCatalog([githubRepository, duplicate], '2026-08-14T00:00:00.000Z', 2)

    expect(catalog.repositories).toHaveLength(1)
    expect(catalog.stats).toMatchObject({
      fetched: 1,
      reportedByGitHub: 2,
      categories: { communication: 1 },
      projectTypes: { channel: 1 },
    })
  })

  it('matches awesome mirrors by exact repository name and keeps them first in every sort mode', () => {
    const popular = {
      ...githubRepository,
      id: 1,
      name: 'popular-plugin',
      full_name: 'owner/popular-plugin',
      stargazers_count: 10_000,
      pushed_at: '2026-08-14T00:00:00Z',
    }
    const awesomeMirror = {
      ...githubRepository,
      id: 2,
      name: 'DSH-Live-Stats',
      full_name: 'original-owner/DSH-Live-Stats',
      stargazers_count: 1,
      pushed_at: '2025-01-01T00:00:00Z',
    }
    const catalog = buildCatalog(
      [popular, awesomeMirror],
      '2026-08-14T00:00:00.000Z',
      2,
      new Set(['dsh-live-stats']),
    )

    expect(catalog.repositories[0]).toMatchObject({
      fullName: 'original-owner/DSH-Live-Stats',
      awesomeListed: true,
    })
    expect(catalog.repositories[1].awesomeListed).toBe(false)
    expect(sortCatalogEntries(catalog.repositories, 'updated')[0].awesomeListed).toBe(true)
    expect(sortCatalogEntries(catalog.repositories, 'name')[0].awesomeListed).toBe(true)
  })

  it('formats user-facing metadata without depending on the browser locale', () => {
    expect(formatCompactNumber(38265)).toBe('38.3k')
    expect(formatCompactNumber(999)).toBe('999')
    expect(formatCompactNumber(2_000_000)).toBe('2m')
    expect(formatRelativeDate('2026-08-13T00:00:00Z', new Date('2026-08-14T00:00:00Z'))).toBe('1 天前')
    expect(formatRelativeDate('2026-08-14T00:00:00Z', new Date('2026-08-14T12:00:00Z'))).toBe('今天')
    expect(formatRelativeDate('2026-06-01T00:00:00Z', new Date('2026-08-14T00:00:00Z'))).toBe('2 个月前')
    expect(formatRelativeDate('2024-08-01T00:00:00Z', new Date('2026-08-14T00:00:00Z'))).toBe('2 年前')
    expect(formatRelativeDate('invalid', new Date('2026-08-14T00:00:00Z'))).toBe('未知')
  })

  it('provides a safe empty state and the filter definitions used by the UI', () => {
    expect(getEmptyCatalog().repositories).toEqual([])
    expect(getCatalogDefinitions().categories.some(({ id }) => id === 'security')).toBe(true)
    expect(getCatalogDefinitions().projectTypes.some(({ id }) => id === 'plugin')).toBe(true)
  })
})
