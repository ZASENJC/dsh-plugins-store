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
  default_branch: 'main',
}

describe('catalog data', () => {
  it('converts GitHub metadata into a stable classified catalog entry', () => {
    const entry = createCatalogEntry(githubRepository)

    expect(entry.id).toBe('github:1333496313')
    expect(entry.slug).toBe('1333496313')
    expect(entry.owner.avatarUrl).toContain('avatars.githubusercontent.com')
    expect(entry.defaultBranch).toBe('main')
    expect(entry.projectType).toBe('channel')
    expect(entry.category).toBe('communication')
    expect(entry.status).toEqual({ discovery: 'topic-listed', verification: 'not-verified' })
  })

  it('matches verified plugins by exact full repository name without accepting same-name forks', () => {
    const verified = {
      ...githubRepository,
      id: 11,
      full_name: 'Owner/Verified-Plugin',
      name: 'Verified-Plugin',
    }
    const sameNameFork = {
      ...verified,
      id: 12,
      full_name: 'Other/Verified-Plugin',
    }
    const catalog = buildCatalog(
      [verified, sameNameFork],
      '2026-08-14T00:00:00.000Z',
      2,
      new Set(),
      new Set(['owner/verified-plugin']),
    )

    expect(catalog.stats.verified).toBe(1)
    expect(catalog.repositories.find(({ repositoryId }) => repositoryId === 11)).toMatchObject({
      verified: true,
      verificationUrl: 'https://github.com/qing3a/dsh-plugin-verify#verified-%E7%9B%AE%E5%BD%95',
      status: { discovery: 'topic-listed', verification: 'verified' },
    })
    expect(catalog.repositories.find(({ repositoryId }) => repositoryId === 12)).toMatchObject({
      verified: false,
      verificationUrl: null,
      status: { discovery: 'topic-listed', verification: 'not-verified' },
    })
  })

  it('keeps the explicitly verified dsh-TUI repository without attributing it to the external directory', () => {
    const repository = {
      ...githubRepository,
      id: 1333111893,
      name: 'dsh-TUI',
      full_name: 'ccch1mneyyy/dsh-TUI',
      html_url: 'https://github.com/ccch1mneyyy/dsh-TUI',
      stargazers_count: 288,
    }
    const entry = buildCatalog([repository]).repositories[0]

    expect(entry).toMatchObject({
      verified: true,
      verificationUrl: 'https://github.com/ccch1mneyyy/dsh-TUI',
      status: { discovery: 'topic-listed', verification: 'verified' },
    })
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

  it('matches awesome mirrors by exact repository name', () => {
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
  })

  it('interleaves two priority projects with one high-star discovery project', () => {
    const ordinaryPopular = {
      ...githubRepository,
      id: 21,
      name: 'ordinary-popular',
      full_name: 'owner/ordinary-popular',
      stargazers_count: 10_000,
    }
    const ordinaryNext = {
      ...githubRepository,
      id: 22,
      name: 'ordinary-next',
      full_name: 'owner/ordinary-next',
      stargazers_count: 9_000,
    }
    const awesomeHigh = {
      ...githubRepository,
      id: 23,
      name: 'awesome-high',
      full_name: 'owner/awesome-high',
      stargazers_count: 100,
    }
    const verifiedTie = {
      ...githubRepository,
      id: 24,
      name: 'verified-tie',
      full_name: 'owner/verified-tie',
      stargazers_count: 100,
    }
    const awesomeNext = {
      ...githubRepository,
      id: 25,
      name: 'awesome-next',
      full_name: 'owner/awesome-next',
      stargazers_count: 90,
    }
    const verifiedLast = {
      ...githubRepository,
      id: 26,
      name: 'verified-last',
      full_name: 'owner/verified-last',
      stargazers_count: 80,
    }
    const catalog = buildCatalog(
      [ordinaryPopular, ordinaryNext, awesomeHigh, verifiedTie, awesomeNext, verifiedLast],
      '2026-08-14T00:00:00.000Z',
      6,
      new Set(['awesome-high', 'awesome-next']),
      new Set(['owner/verified-tie', 'owner/verified-last']),
    )

    expect(catalog.repositories.map(({ fullName }) => fullName)).toEqual([
      'owner/verified-tie',
      'owner/awesome-high',
      'owner/ordinary-popular',
      'owner/awesome-next',
      'owner/verified-last',
      'owner/ordinary-next',
    ])
    expect(sortCatalogEntries(catalog.repositories, 'recommended').map(({ fullName }) => fullName)).toEqual([
      'owner/verified-tie',
      'owner/awesome-high',
      'owner/ordinary-popular',
      'owner/awesome-next',
      'owner/verified-last',
      'owner/ordinary-next',
    ])
  })

  it('uses the selected global sort before status tie-breakers', () => {
    const ordinaryPopular = {
      ...githubRepository,
      id: 31,
      name: 'zulu-popular',
      full_name: 'owner/zulu-popular',
      stargazers_count: 10_000,
      pushed_at: '2026-08-15T00:00:00Z',
    }
    const awesomeOlder = {
      ...githubRepository,
      id: 32,
      name: 'middle-awesome',
      full_name: 'owner/middle-awesome',
      stargazers_count: 1,
      pushed_at: '2025-01-01T00:00:00Z',
    }
    const ordinaryAlpha = {
      ...githubRepository,
      id: 33,
      name: 'alpha-ordinary',
      full_name: 'owner/alpha-ordinary',
      stargazers_count: 2,
      pushed_at: '2026-08-14T00:00:00Z',
    }
    const catalog = buildCatalog(
      [ordinaryPopular, awesomeOlder, ordinaryAlpha],
      '2026-08-14T00:00:00.000Z',
      3,
      new Set(['middle-awesome']),
    )

    expect(sortCatalogEntries(catalog.repositories, 'stars')[0].fullName).toBe('owner/zulu-popular')
    expect(sortCatalogEntries(catalog.repositories, 'updated')[0].fullName).toBe('owner/zulu-popular')
    expect(sortCatalogEntries(catalog.repositories, 'name')[0].fullName).toBe('owner/alpha-ordinary')
  })

  it('prefers priority and then verified projects only when global sort values are equal', () => {
    const ordinaryTie = {
      ...githubRepository,
      id: 41,
      name: 'ordinary-tie',
      full_name: 'owner-c/ordinary-tie',
      stargazers_count: 100,
    }
    const awesomeTie = {
      ...githubRepository,
      id: 42,
      name: 'awesome-tie',
      full_name: 'owner-b/awesome-tie',
      stargazers_count: 100,
    }
    const verifiedTie = {
      ...githubRepository,
      id: 43,
      name: 'verified-tie',
      full_name: 'owner-a/verified-tie',
      stargazers_count: 100,
    }
    const catalog = buildCatalog(
      [ordinaryTie, awesomeTie, verifiedTie],
      '2026-08-14T00:00:00.000Z',
      3,
      new Set(['awesome-tie']),
      new Set(['owner-a/verified-tie']),
    )

    expect(sortCatalogEntries(catalog.repositories, 'stars').map(({ fullName }) => fullName)).toEqual([
      'owner-a/verified-tie',
      'owner-b/awesome-tie',
      'owner-c/ordinary-tie',
    ])
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
