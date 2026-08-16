import { describe, expect, it } from 'vitest'

import {
  buildSourceClassificationArchive,
  buildValidationCatalog,
  filterCatalogRepositoriesByArchive,
  mergeSourceValidationHistory,
  parseSourceClassificationArchive,
  selectSourceClassificationTargets,
  type SourceClassificationArchive,
  type SourceDiscoverySnapshot,
} from './source-classification-archive'

const discovery: SourceDiscoverySnapshot = {
  schemaVersion: 1,
  generatedAt: '2026-08-16T00:00:00Z',
  reportedByGitHub: 3,
  repositories: [
    {
      repositoryId: 1,
      fullName: 'owner/plugin',
      url: 'https://github.com/owner/plugin',
      pushedAt: '2026-08-15T00:00:00Z',
      topics: ['dsh-plugin', 'deepseek-harness'],
      defaultBranch: 'main',
      archived: false,
      fork: false,
      sizeKb: 10,
      projectType: 'plugin',
    },
    {
      repositoryId: 2,
      fullName: 'owner/app',
      url: 'https://github.com/owner/app',
      pushedAt: '2026-08-15T00:00:00Z',
      topics: ['dsh-plugin', 'deepseek-harness'],
      defaultBranch: 'main',
      archived: false,
      fork: false,
      sizeKb: 10,
      projectType: 'application',
    },
    {
      repositoryId: 3,
      fullName: 'owner/changed',
      url: 'https://github.com/owner/changed',
      pushedAt: '2026-08-16T00:00:00Z',
      topics: ['dsh-plugin', 'deepseek-harness'],
      defaultBranch: 'main',
      archived: false,
      fork: false,
      sizeKb: 10,
      projectType: 'plugin',
    },
  ],
}

const pluginClassification = {
  sourceSha: 'a'.repeat(40),
  classifierVersion: '0.1.0',
  projectType: 'plugin' as const,
  category: 'development' as const,
  categories: ['development' as const],
  matchedSignals: ['package.json:dsh'],
  confidence: 'high' as const,
}

const appClassification = {
  ...pluginClassification,
  sourceSha: 'b'.repeat(40),
  projectType: 'application' as const,
  category: 'development' as const,
}

describe('source classification archive', () => {
  it('publishes only current include records and fails closed without an archive', () => {
    const archive = parseSourceClassificationArchive({
      schemaVersion: 1,
      generatedAt: '2026-08-16T01:00:00Z',
      mode: 'full',
      classifierVersion: '0.1.0',
      records: [{
        repositoryId: 1,
        fullName: 'owner/plugin',
        sourcePushedAt: '2026-08-15T00:00:00Z',
        sourceSha: 'a'.repeat(40),
        disposition: 'include',
      }, {
        repositoryId: 2,
        fullName: 'owner/excluded',
        sourcePushedAt: '2026-08-15T00:00:00Z',
        sourceSha: 'b'.repeat(40),
        disposition: 'exclude',
      }, {
        repositoryId: 3,
        fullName: 'owner/new',
        sourcePushedAt: '2026-08-15T00:00:00Z',
        sourceSha: null,
        disposition: 'inconclusive',
      }],
    })
    const repositories = [
      { id: 1, pushed_at: '2026-08-15T00:00:00Z' },
      { id: 2, pushed_at: '2026-08-15T00:00:00Z' },
      { id: 3, pushed_at: '2026-08-15T00:00:00Z' },
      { id: 4, pushed_at: '2026-08-15T00:00:00Z' },
    ]

    expect(filterCatalogRepositoriesByArchive(repositories, archive).map(({ id }) => id))
      .toEqual([1])
    expect(filterCatalogRepositoriesByArchive(repositories, null)).toEqual([])
  })

  it('selects every active repository on the first run and retries inconclusive repositories later', () => {
    expect(selectSourceClassificationTargets(discovery, null, false).map(({ repositoryId }) => repositoryId))
      .toEqual([1, 2, 3])

    const previous: SourceClassificationArchive = {
      schemaVersion: 1,
      generatedAt: '2026-08-15T00:00:00Z',
      mode: 'full',
      classifierVersion: '0.1.0',
      records: discovery.repositories.map((repository) => ({
        repositoryId: repository.repositoryId,
        fullName: repository.fullName,
        sourcePushedAt: repository.pushedAt,
        sourceSha: null,
        disposition: repository.repositoryId === 1 ? 'inconclusive' as const : 'include' as const,
      })).filter(({ repositoryId }) => repositoryId !== 3),
    }

    expect(selectSourceClassificationTargets(discovery, previous, false).map(({ repositoryId }) => repositoryId))
      .toEqual([1, 3])
    expect(selectSourceClassificationTargets(discovery, previous, true).map(({ repositoryId }) => repositoryId))
      .toEqual([1, 2, 3])
  })

  it('keeps a current source exclusion reusable but never applies a stale exclusion to a changed repository', () => {
    const previous: SourceClassificationArchive = {
      schemaVersion: 1,
      generatedAt: '2026-08-15T00:00:00Z',
      mode: 'full',
      classifierVersion: '0.1.0',
      records: [{
        repositoryId: 2,
        fullName: 'owner/app',
        sourcePushedAt: discovery.repositories[1].pushedAt,
        sourceSha: appClassification.sourceSha,
        disposition: 'exclude',
        exclusionReason: 'source project type is application',
        classification: appClassification,
      }],
    }
    const archive = buildSourceClassificationArchive({
      discovery,
      previous,
      results: [],
      mode: 'incremental',
      generatedAt: '2026-08-16T01:00:00Z',
    })

    expect(buildValidationCatalog(discovery, archive).repositories.map(({ repositoryId }) => repositoryId))
      .toEqual([])

    const changed = {
      ...discovery,
      repositories: discovery.repositories.map((repository) => repository.repositoryId === 2
        ? { ...repository, pushedAt: '2026-08-16T02:00:00Z' }
        : repository),
    }
    const staleArchive = buildSourceClassificationArchive({
      discovery: changed,
      previous,
      results: [],
      mode: 'incremental',
      generatedAt: '2026-08-16T03:00:00Z',
    })
    expect(buildValidationCatalog(changed, staleArchive).repositories.map(({ repositoryId }) => repositoryId))
      .not.toContain(2)
  })

  it('sends only current include records with source classification to the validation catalog', () => {
    const archive = buildSourceClassificationArchive({
      discovery,
      previous: null,
      results: [{
        repositoryId: 1,
        fullName: 'owner/plugin',
        sourcePushedAt: discovery.repositories[0].pushedAt,
        sourceSha: pluginClassification.sourceSha,
        disposition: 'include',
        classification: pluginClassification,
      }],
      mode: 'full',
      generatedAt: '2026-08-16T03:30:00Z',
    })

    expect(buildValidationCatalog(discovery, archive).repositories.map(({ repositoryId }) => repositoryId))
      .toEqual([1])
  })

  it('falls back to the discovery project type for low-confidence source classification', () => {
    const archive = buildSourceClassificationArchive({
      discovery,
      previous: null,
      results: [{
        repositoryId: 1,
        fullName: 'owner/plugin',
        sourcePushedAt: discovery.repositories[0].pushedAt,
        sourceSha: pluginClassification.sourceSha,
        disposition: 'include',
        classification: { ...pluginClassification, confidence: 'low' },
      }],
      mode: 'full',
      generatedAt: '2026-08-16T03:30:00Z',
    })

    expect(buildValidationCatalog(discovery, archive).repositories.find(({ repositoryId }) => repositoryId === 1))
      .toMatchObject({ repositoryId: 1, projectType: 'plugin' })
  })

  it('turns missing full-run observations into explicit inconclusive records instead of silently dropping them', () => {
    const archive = buildSourceClassificationArchive({
      discovery,
      previous: null,
      results: [{
        repositoryId: 1,
        fullName: 'owner/plugin',
        sourcePushedAt: discovery.repositories[0].pushedAt,
        sourceSha: pluginClassification.sourceSha,
        disposition: 'include',
        classification: pluginClassification,
      }],
      mode: 'full',
      generatedAt: '2026-08-16T04:00:00Z',
    })

    expect(archive.records).toHaveLength(3)
    expect(archive.records.find(({ repositoryId }) => repositoryId === 2)).toMatchObject({
      disposition: 'inconclusive',
      failureCode: 'CLASSIFICATION_NOT_OBSERVED',
    })
  })

  it('carries the newest exact-SHA validation history without reviving changed source evidence', () => {
    const validation = (sourceSha: string, checkedAt: string, disposition: 'verified' | 'auto_failed') => ({
      status: disposition === 'verified' ? 'passed' as const : 'failed' as const,
      disposition,
      stage: 'sandbox' as const,
      sourceSha,
      checkedAt,
      dshVersion: '0.1.0-rc.6',
      platform: 'linux-x64',
      validatorVersion: '0.1.2',
      executionType: 'host-tool',
      ...(disposition === 'auto_failed'
        ? { errorCode: 'PLUGIN_LOAD_FAILED', attribution: 'plugin' as const }
        : {}),
    })
    const current = parseSourceClassificationArchive({
      schemaVersion: 1,
      generatedAt: '2026-08-16T04:00:00Z',
      mode: 'incremental',
      classifierVersion: '0.1.0',
      records: [{
        repositoryId: 1,
        fullName: 'owner/plugin',
        sourcePushedAt: discovery.repositories[0].pushedAt,
        sourceSha: 'a'.repeat(40),
        disposition: 'include',
      }, {
        repositoryId: 3,
        fullName: 'owner/changed',
        sourcePushedAt: discovery.repositories[2].pushedAt,
        sourceSha: 'c'.repeat(40),
        disposition: 'include',
      }],
    })
    const older = parseSourceClassificationArchive({
      ...current,
      generatedAt: '2026-08-16T01:00:00Z',
      records: [{ ...current.records[0], validation: validation('a'.repeat(40), '2026-08-16T01:00:00Z', 'verified') }, {
        ...current.records[1],
        sourceSha: 'd'.repeat(40),
        validation: validation('d'.repeat(40), '2026-08-16T01:00:00Z', 'verified'),
      }],
    })
    const newerPartial = parseSourceClassificationArchive({
      ...current,
      generatedAt: '2026-08-16T02:00:00Z',
      records: [{
        ...current.records[0],
        validation: validation('a'.repeat(40), '2026-08-16T02:00:00Z', 'auto_failed'),
      }],
    })

    const merged = mergeSourceValidationHistory(current, [older, newerPartial])

    expect(merged.records[0].validation).toMatchObject({
      checkedAt: '2026-08-16T02:00:00Z',
      disposition: 'auto_failed',
    })
    expect(merged.records[1].validation).toBeUndefined()
  })

  it('migrates legacy manual-review validation outcomes by attribution and error code', () => {
    const base = {
      repositoryId: 1,
      fullName: 'owner/plugin',
      sourcePushedAt: discovery.repositories[0].pushedAt,
      sourceSha: pluginClassification.sourceSha,
      disposition: 'include' as const,
      validation: {
        status: 'failed' as const,
        disposition: 'manual_review' as const,
        stage: 'sandbox' as const,
        sourceSha: pluginClassification.sourceSha,
        checkedAt: '2026-08-16T04:00:00Z',
        dshVersion: '0.1.0-rc.6',
        platform: 'linux-x64',
        validatorVersion: '0.1.2',
        executionType: 'host-tool',
        errorCode: 'PLUGIN_LOAD_FAILED',
        attribution: 'plugin' as const,
      },
    }
    const archive = parseSourceClassificationArchive({
      schemaVersion: 1,
      generatedAt: '2026-08-16T04:00:00Z',
      mode: 'full',
      classifierVersion: '0.1.0',
      records: [
        base,
        {
          ...base,
          repositoryId: 2,
          fullName: 'owner/retry',
          sourceSha: 'b'.repeat(40),
          validation: {
            ...base.validation,
            status: 'inconclusive',
            sourceSha: 'b'.repeat(40),
            disposition: 'manual_review',
            errorCode: 'VALIDATION_NOT_OBSERVED',
            attribution: 'infrastructure',
          },
        },
        {
          ...base,
          repositoryId: 3,
          fullName: 'owner/security',
          sourceSha: 'c'.repeat(40),
          validation: {
            ...base.validation,
            sourceSha: 'c'.repeat(40),
            disposition: 'manual_review',
            errorCode: 'SECURITY_REVIEW_REQUIRED',
            attribution: 'policy',
          },
        },
        {
          ...base,
          repositoryId: 4,
          fullName: 'owner/capability',
          sourceSha: 'd'.repeat(40),
          validation: {
            ...base.validation,
            status: 'inconclusive',
            sourceSha: 'd'.repeat(40),
            disposition: 'manual_review',
            errorCode: 'PLATFORM_RUNNER_REQUIRED',
            attribution: 'inconclusive',
          },
        },
        {
          ...base,
          repositoryId: 5,
          fullName: 'owner/postflight',
          sourceSha: 'e'.repeat(40),
          validation: {
            ...base.validation,
            sourceSha: 'e'.repeat(40),
            errorCode: 'SANDBOX_POSTFLIGHT_FAILED',
            attribution: 'policy',
          },
        },
      ],
    })

    expect(archive.records.map((record) => record.validation?.disposition)).toEqual([
      'auto_failed',
      'retryable',
      'manual_review',
      'capability_pending',
      'auto_failed',
    ])
  })

  it('rejects a classification record whose classifier version differs from the archive', () => {
    expect(() => parseSourceClassificationArchive({
      schemaVersion: 1,
      generatedAt: '2026-08-16T04:00:00Z',
      mode: 'full',
      classifierVersion: '0.1.0',
      records: [{
        repositoryId: 1,
        fullName: 'owner/plugin',
        sourcePushedAt: discovery.repositories[0].pushedAt,
        sourceSha: pluginClassification.sourceSha,
        disposition: 'include',
        classification: { ...pluginClassification, classifierVersion: '0.0.9' },
      }],
    })).toThrow('classifier version')
  })

  it('rejects validation evidence whose SHA does not match the classified source', () => {
    expect(() => parseSourceClassificationArchive({
      schemaVersion: 1,
      generatedAt: '2026-08-16T00:00:00Z',
      mode: 'full',
      classifierVersion: '0.1.0',
      records: [{
        repositoryId: 1,
        fullName: 'owner/plugin',
        sourcePushedAt: discovery.repositories[0].pushedAt,
        sourceSha: pluginClassification.sourceSha,
        disposition: 'include',
        validation: {
          status: 'passed',
          disposition: 'verified',
          stage: 'sandbox',
          sourceSha: 'b'.repeat(40),
          checkedAt: '2026-08-16T00:00:00Z',
          dshVersion: '0.1.0-rc.6',
          platform: 'linux-x64',
          validatorVersion: '0.1.2',
          executionType: 'host-tool',
        },
      }],
    })).toThrow('SHA binding')
  })
})
