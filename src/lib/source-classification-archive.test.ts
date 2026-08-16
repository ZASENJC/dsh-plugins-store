import { describe, expect, it } from 'vitest'

import {
  buildSourceClassificationArchive,
  buildValidationCatalog,
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
  it('selects every active repository on the first run and only new or changed repositories later', () => {
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
        disposition: 'include' as const,
      })).filter(({ repositoryId }) => repositoryId !== 3),
    }

    expect(selectSourceClassificationTargets(discovery, previous, false).map(({ repositoryId }) => repositoryId))
      .toEqual([3])
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
      .toEqual([1, 3])

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
      .toContain(2)
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
      ],
    })

    expect(archive.records.map((record) => record.validation?.disposition)).toEqual([
      'auto_failed',
      'retryable',
      'manual_review',
      'capability_pending',
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
