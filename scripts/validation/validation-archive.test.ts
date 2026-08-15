import { describe, expect, it } from 'vitest'

import type { ValidationReport } from '../../src/lib/validation-report'
import { buildValidationArchive } from './validation-archive'

const archive = {
  schemaVersion: 1 as const,
  generatedAt: '2026-08-16T00:00:00.000Z',
  mode: 'full' as const,
  classifierVersion: '0.1.0',
  records: [
    {
      repositoryId: 1,
      fullName: 'owner/plugin',
      sourcePushedAt: '2026-08-15T00:00:00.000Z',
      sourceSha: 'a'.repeat(40),
      disposition: 'include' as const,
    },
    {
      repositoryId: 2,
      fullName: 'owner/app',
      sourcePushedAt: '2026-08-15T00:00:00.000Z',
      sourceSha: 'b'.repeat(40),
      disposition: 'exclude' as const,
    },
  ],
}

const selection = {
  schemaVersion: 1 as const,
  generatedAt: '2026-08-16T00:00:00.000Z',
  mode: 'full' as const,
  catalogGeneratedAt: '2026-08-16T00:00:00.000Z',
  target: {
    dshVersion: '0.1.0-rc.6',
    platform: 'linux-x64',
    validatorVersion: '0.1.2',
    baselineDigest: 'c'.repeat(64),
  },
  repositoryIds: [1, 2, 3],
  shards: [0],
}

function report(status: ValidationReport['currentStatus'], repositoryId = 1): ValidationReport {
  const sourceSha = repositoryId === 1 ? 'a'.repeat(40) : repositoryId === 2 ? 'b'.repeat(40) : 'd'.repeat(40)
  const at = '2026-08-16T00:01:00.000Z'
  const events = status === 'verified'
    ? [
      { sequence: 1, stage: 'discovery' as const, status: 'discovered' as const, at },
      { sequence: 2, stage: 'classification' as const, status: 'recognized' as const, at },
      { sequence: 3, stage: 'structure' as const, status: 'structure_passed' as const, at },
      { sequence: 4, stage: 'sandbox' as const, status: 'queued' as const, at },
      { sequence: 5, stage: 'sandbox' as const, status: 'running' as const, at },
      { sequence: 6, stage: 'installation' as const, status: 'install_passed' as const, at },
      { sequence: 7, stage: 'runtime' as const, status: 'runtime_passed' as const, at },
      { sequence: 8, stage: 'smoke' as const, status: 'smoke_passed' as const, at },
      { sequence: 9, stage: 'final' as const, status: 'verified' as const, at },
    ]
    : [
      { sequence: 1, stage: 'discovery' as const, status: 'discovered' as const, at },
      { sequence: 2, stage: 'classification' as const, status: 'recognized' as const, at },
      { sequence: 3, stage: 'structure' as const, status: 'structure_passed' as const, at },
      { sequence: 4, stage: 'sandbox' as const, status: 'queued' as const, at },
      { sequence: 5, stage: 'sandbox' as const, status: 'inconclusive' as const, at, code: 'PLUGIN_LOAD_FAILED', reason: 'failed', attribution: 'plugin' as const },
    ]
  return {
    schemaVersion: 1,
    reportId: `report-${repositoryId}`,
    mode: 'enforce',
    validationKind: 'linux-headless',
    executionType: 'host-tool',
    repository: {
      id: repositoryId,
      fullName: repositoryId === 1 ? 'owner/plugin' : 'owner/other',
      url: `https://github.com/${repositoryId === 1 ? 'owner/plugin' : 'owner/other'}`,
      sourceSha,
      sourcePushedAt: '2026-08-15T00:00:00.000Z',
    },
    target: { dshVersion: '0.1.0-rc.6', platform: 'linux-x64', nodeVersion: '22', validatorVersion: '0.1.2' },
    startedAt: '2026-08-16T00:00:00.000Z',
    completedAt: at,
    currentStatus: status,
    events,
    structureChecks: [],
    failure: null,
    artifacts: [],
  }
}

describe('validation archive merge', () => {
  it('records passed and failed outcomes without changing source exclusion disposition', () => {
    const result = buildValidationArchive(archive, selection, [report('verified'), report('inconclusive', 2)], '2026-08-16T00:02:00.000Z')
    expect(result.archive.records[0].validation).toMatchObject({ status: 'passed', disposition: 'verified' })
    expect(result.archive.records[1].disposition).toBe('exclude')
    expect(result.archive.records[1].validation).toMatchObject({ status: 'inconclusive', disposition: 'auto_failed', errorCode: 'PLUGIN_LOAD_FAILED' })
    expect(result.autoFailed).toEqual([2])
    expect(result.retryable).toEqual([3])
    expect(result.manualReview).toEqual([])
  })
})
