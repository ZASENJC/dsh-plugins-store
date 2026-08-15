import { describe, expect, it } from 'vitest'

import {
  buildCatalog,
  createCatalogEntry,
  formatCompactNumber,
  formatRelativeDate,
  getCatalogDefinitions,
  getEmptyCatalog,
  hydrateCatalogValidation,
  mixRecommendedEntries,
  sortCatalogEntries,
} from './catalog'
import type { SourceClassificationArchive } from './source-classification-archive'
import { extractInstallReference } from './install-reference'

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

  it('does not expose the removed external curation state', () => {
    const entry = createCatalogEntry(githubRepository)

    expect(Object.keys(entry)).not.toContain(['awesome', 'Listed'].join(''))
  })

  it('stores README-derived installation evidence separately from repository identity', () => {
    const reference = extractInstallReference(`
## Install

\`\`\`sh
dsh plugin --profile web add github:PlutoKeating/dsh-lark-bot
\`\`\`
`)
    const entry = createCatalogEntry(
      githubRepository,
      new Set(),
      {
        repositoryId: githubRepository.id,
        sourceSha: 'a'.repeat(40),
        sourcePushedAt: githubRepository.pushed_at,
        updatedAt: '2026-08-14T00:00:00Z',
        structure: { status: 'passed' },
        sandbox: { status: 'passed' },
      },
      reference,
    )

    expect(entry.install).toMatchObject({
      status: 'recognized',
      candidate: {
        source: 'github',
        target: 'PlutoKeating/dsh-lark-bot',
        executable: true,
      },
    })
  })

  it('rebinds a recognized install command when validation is refreshed', () => {
    const reference = extractInstallReference(`
## Install

\`\`\`sh
dsh plugin --profile web add github:PlutoKeating/dsh-lark-bot
\`\`\`
`)
    const entry = createCatalogEntry(
      githubRepository,
      new Set(),
      {
        repositoryId: githubRepository.id,
        sourceSha: 'a'.repeat(40),
        sourcePushedAt: githubRepository.pushed_at,
        updatedAt: '2026-08-14T00:00:00Z',
        dshVersion: '0.1.0-rc.6',
        platform: 'linux-x64',
        validatorVersion: '0.1.2',
        structure: { status: 'passed' },
        sandbox: { status: 'passed' },
      },
      reference,
    )
    const hydrated = hydrateCatalogValidation({
      schemaVersion: 1,
      generatedAt: '2026-08-15T00:00:00Z',
      source: { label: 'GitHub Topic', topic: 'dsh-plugin', url: 'https://github.com/topics/dsh-plugin' },
      stats: { fetched: 1, reportedByGitHub: 1, verified: 1, categories: {}, projectTypes: {}, validationStatuses: {} },
      repositories: [entry],
    }, new Map([[githubRepository.id, {
      repositoryId: githubRepository.id,
      sourceSha: 'a'.repeat(40),
      sourcePushedAt: '2026-08-13T20:00:00Z',
      updatedAt: '2026-08-15T00:00:00Z',
      dshVersion: '0.1.0-rc.6',
      platform: 'linux-x64',
      validatorVersion: '0.1.2',
      structure: { status: 'passed' },
      sandbox: { status: 'passed' },
    }]]))

    expect(hydrated.repositories[0]).toMatchObject({
      validation: { overall: 'expired', reason: '仓库源码已更新' },
      install: { status: 'recognized', candidate: { executable: true } },
    })
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
      new Set(['owner/verified-plugin']),
    )

    expect(catalog.stats.verified).toBe(0)
    expect(catalog.repositories.find(({ repositoryId }) => repositoryId === 11)).toMatchObject({
      verified: false,
      verificationUrl: 'https://github.com/qing3a/dsh-plugin-verify#verified-%E7%9B%AE%E5%BD%95',
      status: { discovery: 'topic-listed', verification: 'not-verified' },
      validation: {
        overall: 'recorded',
        label: '已有验证记录',
        verified: false,
      },
    })
    expect(catalog.repositories.find(({ repositoryId }) => repositoryId === 12)).toMatchObject({
      verified: false,
      verificationUrl: null,
      status: { discovery: 'topic-listed', verification: 'not-verified' },
    })
  })

  it('keeps the dsh-TUI reference as historical evidence without granting current verification', () => {
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
      verified: false,
      verificationUrl: 'https://github.com/ccch1mneyyy/dsh-TUI',
      status: { discovery: 'topic-listed', verification: 'not-verified' },
      validation: { overall: 'recorded', verified: false },
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
      validationStatuses: { 'check-pending': 1 },
    })
  })

  it('matches validation evidence by stable repository id and counts the current ladder state', () => {
    const validationRecords = new Map([[githubRepository.id, {
      repositoryId: githubRepository.id,
      sourceSha: 'd'.repeat(40),
      sourcePushedAt: githubRepository.pushed_at,
      updatedAt: '2026-08-14T09:00:00Z',
      dshVersion: '0.1.0-rc.6',
      platform: 'linux-x64',
      validatorVersion: '0.1.2',
      structure: { status: 'passed' as const },
      sandbox: { status: 'passed' as const, reportUrl: 'https://reports.example/current.json' },
    }]])
    const catalog = buildCatalog(
      [githubRepository],
      '2026-08-14T09:05:00.000Z',
      1,
      new Set(),
      validationRecords,
    )

    expect(catalog.stats).toMatchObject({
      verified: 1,
      validationStatuses: { verified: 1 },
    })
    expect(catalog.repositories[0]).toMatchObject({
      verified: true,
      validation: {
        overall: 'verified',
        sourceSha: 'd'.repeat(40),
        reportUrl: 'https://reports.example/current.json',
      },
    })
  })

  it('uses current SHA-bound source classification on the next catalog refresh', () => {
    const catalog = buildCatalog(
      [{ ...githubRepository, id: 77, projectType: undefined } as never],
      '2026-08-14T09:05:00.000Z',
      1,
      new Set(),
      new Map([[77, {
        repositoryId: 77,
        sourceSha: 'a'.repeat(40),
        sourcePushedAt: githubRepository.pushed_at,
        updatedAt: '2026-08-14T09:00:00Z',
        dshVersion: '0.1.0-rc.6',
        platform: 'linux-x64',
        validatorVersion: '0.1.2',
        structure: { status: 'passed' as const },
        sandbox: { status: 'inconclusive' as const },
        sourceClassification: {
          sourceSha: 'a'.repeat(40),
          classifierVersion: '0.1.0',
          projectType: 'plugin' as const,
          category: 'model-mcp' as const,
          categories: ['model-mcp' as const],
          matchedSignals: ['package.json:dsh.bundle.patch'],
          confidence: 'high' as const,
        },
      }]]),
    )

    expect(catalog.repositories[0]).toMatchObject({
      projectType: 'plugin',
      category: 'model-mcp',
      classificationSource: 'source',
    })
  })

  it('keeps rough classification when the source result is stale', () => {
    const catalog = buildCatalog(
      [githubRepository],
      '2026-08-14T09:05:00.000Z',
      1,
      new Set(),
      new Map([[githubRepository.id, {
        repositoryId: githubRepository.id,
        sourceSha: 'b'.repeat(40),
        sourcePushedAt: '2026-08-14T07:00:00Z',
        updatedAt: '2026-08-14T09:00:00Z',
        dshVersion: '0.1.0-rc.6',
        platform: 'linux-x64',
        validatorVersion: '0.1.2',
        structure: { status: 'passed' as const },
        sandbox: { status: 'inconclusive' as const },
        sourceClassification: {
          sourceSha: 'b'.repeat(40),
          classifierVersion: '0.1.0',
          projectType: 'application' as const,
          category: 'development' as const,
          categories: ['development' as const],
          matchedSignals: ['package.json:application'],
          confidence: 'high' as const,
        },
      }]]),
    )

    expect(catalog.repositories[0]).toMatchObject({
      projectType: 'channel',
      category: 'communication',
      classificationSource: 'topics',
    })
  })

  it('uses the current classification archive to exclude unrelated repositories and expose source signals', () => {
    const archive: SourceClassificationArchive = {
      schemaVersion: 1,
      generatedAt: '2026-08-16T09:00:00Z',
      mode: 'full',
      classifierVersion: '0.1.0',
      records: [{
        repositoryId: githubRepository.id,
        fullName: githubRepository.full_name,
        sourcePushedAt: githubRepository.pushed_at,
        sourceSha: 'a'.repeat(40),
        disposition: 'include',
        classification: {
          sourceSha: 'a'.repeat(40),
          classifierVersion: '0.1.0',
          projectType: 'plugin',
          category: 'model-mcp',
          categories: ['model-mcp'],
          matchedSignals: ['package.json:dsh'],
          confidence: 'high',
        },
      }, {
        repositoryId: 88,
        fullName: 'owner/host-app',
        sourcePushedAt: githubRepository.pushed_at,
        sourceSha: 'c'.repeat(40),
        disposition: 'exclude',
        exclusionReason: 'source project type is application',
      }],
    }
    const excluded = { ...githubRepository, id: 88, full_name: 'owner/host-app' }
    const catalog = buildCatalog(
      [githubRepository, excluded],
      '2026-08-16T09:05:00Z',
      2,
      new Set(),
      new Map(),
      new Map(),
      archive,
    )

    expect(catalog.repositories.map(({ repositoryId }) => repositoryId)).toEqual([githubRepository.id])
    expect(catalog.repositories[0]).toMatchObject({
      classificationSource: 'source',
      classificationSignals: ['package.json:dsh'],
      projectType: 'plugin',
      category: 'model-mcp',
    })
  })

  it('interleaves two verified projects with one high-star discovery project', () => {
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
    const unverifiedHigh = {
      ...githubRepository,
      id: 23,
      name: 'unverified-high',
      full_name: 'owner/unverified-high',
      stargazers_count: 100,
    }
    const verifiedTie = {
      ...githubRepository,
      id: 24,
      name: 'verified-tie',
      full_name: 'owner/verified-tie',
      stargazers_count: 100,
    }
    const unverifiedNext = {
      ...githubRepository,
      id: 25,
      name: 'unverified-next',
      full_name: 'owner/unverified-next',
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
      [ordinaryPopular, ordinaryNext, unverifiedHigh, verifiedTie, unverifiedNext, verifiedLast],
      '2026-08-14T00:00:00.000Z',
      6,
      new Set(),
      new Map([
        [24, {
          repositoryId: 24,
          sourceSha: 'd'.repeat(40),
          sourcePushedAt: verifiedTie.pushed_at,
          updatedAt: '2026-08-14T01:00:00Z',
          dshVersion: '0.1.0-rc.6',
          platform: 'linux-x64',
          validatorVersion: '0.1.2',
          structure: { status: 'passed' as const },
          sandbox: { status: 'passed' as const },
        }],
        [26, {
          repositoryId: 26,
          sourceSha: 'e'.repeat(40),
          sourcePushedAt: verifiedLast.pushed_at,
          updatedAt: '2026-08-14T01:00:00Z',
          dshVersion: '0.1.0-rc.6',
          platform: 'linux-x64',
          validatorVersion: '0.1.2',
          structure: { status: 'passed' as const },
          sandbox: { status: 'passed' as const },
        }],
      ]),
    )

    const catalogNames = catalog.repositories.map(({ fullName }) => fullName)
    expect(catalogNames).toHaveLength(6)
    expect(new Set(catalogNames)).toEqual(new Set([
      'owner/verified-tie',
      'owner/verified-last',
      'owner/ordinary-popular',
      'owner/ordinary-next',
      'owner/unverified-high',
      'owner/unverified-next',
    ]))
    expect(sortCatalogEntries(catalog.repositories, 'recommended', catalog.generatedAt)
      .map(({ fullName }) => fullName)).toEqual(catalogNames)
  })

  it('randomizes the discovery position within each recommendation batch', () => {
    const priority = ['verified-a', 'verified-b', 'verified-c', 'verified-d']
    const discovery = ['discovery-a', 'discovery-b']

    expect(mixRecommendedEntries(priority, discovery, () => 0)).toEqual([
      'discovery-a', 'verified-a', 'verified-b',
      'discovery-b', 'verified-c', 'verified-d',
    ])
    expect(mixRecommendedEntries(priority, discovery, () => 0.99)).toEqual([
      'verified-a', 'verified-b', 'discovery-a',
      'verified-c', 'verified-d', 'discovery-b',
    ])
  })

  it('keeps seeded recommendation positions stable across server and browser renders', () => {
    const entries = ['verified-a', 'verified-b', 'verified-c', 'verified-d', 'discovery-a', 'discovery-b']
      .map((fullName, index) => ({
        ...githubRepository,
        id: 100 + index,
        name: fullName,
        full_name: `owner/${fullName}`,
        stargazers_count: 100 - index,
      }))
    const catalog = buildCatalog(
      entries,
      '2026-08-15T00:00:00.000Z',
      entries.length,
      new Set(),
      new Map(entries.slice(0, 4).map((entry) => [entry.id, {
        repositoryId: entry.id,
        sourceSha: 'a'.repeat(40),
        sourcePushedAt: entry.pushed_at,
        updatedAt: '2026-08-15T01:00:00Z',
        dshVersion: '0.1.0-rc.6',
        platform: 'linux-x64',
        validatorVersion: '0.1.2',
        structure: { status: 'passed' as const },
        sandbox: { status: 'passed' as const },
      }])),
    )

    const first = sortCatalogEntries(catalog.repositories, 'recommended', catalog.generatedAt)
    const second = sortCatalogEntries(catalog.repositories, 'recommended', catalog.generatedAt)
    const otherSeed = sortCatalogEntries(catalog.repositories, 'recommended', '2026-08-16T00:00:00.000Z')

    expect(second.map(({ fullName }) => fullName)).toEqual(first.map(({ fullName }) => fullName))
    expect(otherSeed.map(({ fullName }) => fullName)).not.toEqual(first.map(({ fullName }) => fullName))
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
    const middleOlder = {
      ...githubRepository,
      id: 32,
      name: 'middle-older',
      full_name: 'owner/middle-older',
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
      [ordinaryPopular, middleOlder, ordinaryAlpha],
      '2026-08-14T00:00:00.000Z',
      3,
    )

    expect(sortCatalogEntries(catalog.repositories, 'stars')[0].fullName).toBe('owner/zulu-popular')
    expect(sortCatalogEntries(catalog.repositories, 'updated')[0].fullName).toBe('owner/zulu-popular')
    expect(sortCatalogEntries(catalog.repositories, 'name')[0].fullName).toBe('owner/alpha-ordinary')
  })

  it('prefers verified projects only when global sort values are equal', () => {
    const ordinaryTie = {
      ...githubRepository,
      id: 41,
      name: 'ordinary-tie',
      full_name: 'owner-c/ordinary-tie',
      stargazers_count: 100,
    }
    const unverifiedTie = {
      ...githubRepository,
      id: 42,
      name: 'unverified-tie',
      full_name: 'owner-z/unverified-tie',
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
      [ordinaryTie, unverifiedTie, verifiedTie],
      '2026-08-14T00:00:00.000Z',
      3,
      new Set(),
      new Map([[43, {
        repositoryId: 43,
        sourceSha: 'f'.repeat(40),
        sourcePushedAt: verifiedTie.pushed_at,
        updatedAt: '2026-08-14T01:00:00Z',
        dshVersion: '0.1.0-rc.6',
        platform: 'linux-x64',
        validatorVersion: '0.1.2',
        structure: { status: 'passed' as const },
        sandbox: { status: 'passed' as const },
      }]]),
    )

    expect(sortCatalogEntries(catalog.repositories, 'stars').map(({ fullName }) => fullName)).toEqual([
      'owner-a/verified-tie',
      'owner-c/ordinary-tie',
      'owner-z/unverified-tie',
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
