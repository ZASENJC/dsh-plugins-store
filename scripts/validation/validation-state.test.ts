import { describe, expect, it } from 'vitest'

import type { ValidationReport } from '../../src/lib/validation-report'
import type { ValidationRecord } from '../../src/lib/validation'
import {
  buildValidationState,
  reconcileValidationState,
  selectValidationDelta,
  type ValidationSelection,
  type ValidationState,
  type ValidationStateTarget,
} from './validation-state'

const target: ValidationStateTarget = {
  dshVersion: '0.1.0-rc.6',
  platform: 'linux-x64',
  validatorVersion: '0.1.0',
  baselineDigest: 'a'.repeat(64),
}

const catalog = {
  schemaVersion: 1,
  generatedAt: '2026-08-14T16:00:00.000Z',
  repositories: [
    { repositoryId: 1, projectType: 'plugin', pushedAt: '2026-08-14T10:00:00.000Z' },
    { repositoryId: 2, projectType: 'skill', pushedAt: '2026-08-14T11:00:00.000Z' },
    { repositoryId: 3, projectType: 'application', pushedAt: '2026-08-14T12:00:00.000Z' },
    { repositoryId: 4, projectType: 'channel', pushedAt: '2026-08-14T13:00:00.000Z' },
  ],
}

function state(entries: ValidationState['entries'], overrides: Partial<ValidationStateTarget> = {}): ValidationState {
  return {
    schemaVersion: 1,
    generatedAt: '2026-08-14T15:00:00.000Z',
    catalogGeneratedAt: '2026-08-14T15:00:00.000Z',
    target: { ...target, ...overrides },
    entries,
  }
}

function report(repositoryId: number, attribution: 'verified' | 'infrastructure'): ValidationReport {
  const at = '2026-08-14T16:10:00.000Z'
  const events: ValidationReport['events'] = [
    { sequence: 1, stage: 'discovery', status: 'discovered', at },
    { sequence: 2, stage: 'classification', status: 'recognized', at },
    { sequence: 3, stage: 'structure', status: 'structure_passed', at },
    { sequence: 4, stage: 'sandbox', status: 'queued', at },
  ]
  if (attribution === 'verified') {
    events.push(
      { sequence: 5, stage: 'sandbox', status: 'running', at },
      { sequence: 6, stage: 'installation', status: 'install_passed', at },
      { sequence: 7, stage: 'runtime', status: 'runtime_passed', at },
      { sequence: 8, stage: 'smoke', status: 'smoke_passed', at },
      { sequence: 9, stage: 'final', status: 'verified', at },
    )
  } else {
    events.push({
      sequence: 5,
      stage: 'sandbox',
      status: 'inconclusive',
      at,
      code: 'CANDIDATE_INFRASTRUCTURE_FAILED',
      reason: 'CANDIDATE_INFRASTRUCTURE_FAILED',
      attribution: 'infrastructure',
    })
  }
  return {
    schemaVersion: 1,
    reportId: `report-${repositoryId}`,
    mode: 'shadow',
    validationKind: 'linux-headless',
    executionType: 'host-tool',
    repository: {
      id: repositoryId,
      fullName: `fixture/plugin-${repositoryId}`,
      url: `https://github.com/fixture/plugin-${repositoryId}`,
      sourceSha: String(repositoryId).repeat(40),
      sourcePushedAt: catalog.repositories.find(({ repositoryId: id }) => id === repositoryId)!.pushedAt,
    },
    target: {
      dshVersion: target.dshVersion,
      platform: target.platform,
      nodeVersion: '22.22.0',
      validatorVersion: target.validatorVersion,
    },
    startedAt: at,
    completedAt: at,
    currentStatus: attribution === 'verified' ? 'verified' : 'inconclusive',
    events,
    structureChecks: [],
    failure: null,
    artifacts: [],
  }
}

describe('incremental validation cursor', () => {
  it('selects every validation-eligible project only when no compatible cursor exists', () => {
    expect(selectValidationDelta(catalog, null, target, 20, '2026-08-14T16:01:00.000Z')).toMatchObject({
      mode: 'full',
      repositoryIds: [1, 2, 4],
      shards: [0, 1, 3],
    })
    expect(selectValidationDelta(
      catalog,
      state([], { validatorVersion: '0.2.0' }),
      target,
      20,
      '2026-08-14T16:01:00.000Z',
    ).mode).toBe('full')
  })

  it('selects only new or pushed repositories and produces no work for an unchanged catalog', () => {
    const previous = state([
      { repositoryId: 1, pushedAt: catalog.repositories[0].pushedAt },
      { repositoryId: 2, pushedAt: '2026-08-14T09:00:00.000Z' },
    ])
    expect(selectValidationDelta(catalog, previous, target, 20, '2026-08-14T16:01:00.000Z')).toMatchObject({
      mode: 'incremental',
      repositoryIds: [2, 4],
      shards: [1, 3],
    })

    const current = state([1, 2, 4].map((repositoryId) => ({
      repositoryId,
      pushedAt: catalog.repositories.find(({ repositoryId: id }) => id === repositoryId)!.pushedAt,
    })))
    expect(selectValidationDelta(catalog, current, target, 20, '2026-08-14T16:01:00.000Z')).toMatchObject({
      mode: 'none',
      repositoryIds: [],
      shards: [],
    })
  })

  it('advances every completed entry so unchanged infrastructure outcomes do not repeat hourly', () => {
    const previous = state([{ repositoryId: 1, pushedAt: catalog.repositories[0].pushedAt }])
    const selection: ValidationSelection = {
      schemaVersion: 1,
      generatedAt: '2026-08-14T16:01:00.000Z',
      mode: 'incremental',
      catalogGeneratedAt: catalog.generatedAt,
      target,
      repositoryIds: [2, 4],
      shards: [1, 3],
    }
    const next = buildValidationState(
      catalog,
      previous,
      selection,
      [report(2, 'verified'), report(4, 'infrastructure')],
      '2026-08-14T16:20:00.000Z',
    )

    expect(next.entries).toEqual([
      { repositoryId: 1, pushedAt: catalog.repositories[0].pushedAt },
      { repositoryId: 2, pushedAt: catalog.repositories[1].pushedAt },
      { repositoryId: 4, pushedAt: catalog.repositories[3].pushedAt },
    ])
    expect(selectValidationDelta(catalog, next, target, 20, '2026-08-14T17:01:00.000Z').repositoryIds)
      .toEqual([])
  })

  it('does not carry an old cursor through a forced full revalidation', () => {
    const previous = state([{ repositoryId: 4, pushedAt: catalog.repositories[3].pushedAt }])
    const selection: ValidationSelection = {
      schemaVersion: 1,
      generatedAt: '2026-08-14T16:01:00.000Z',
      mode: 'full',
      catalogGeneratedAt: catalog.generatedAt,
      target,
      repositoryIds: [4],
      shards: [3],
    }

    expect(buildValidationState(
      catalog,
      previous,
      selection,
      [report(4, 'infrastructure')],
      '2026-08-14T16:20:00.000Z',
    ).entries).toEqual([{ repositoryId: 4, pushedAt: catalog.repositories[3].pushedAt }])
  })

  it('repairs an older cursor only from exact-source and exact-target published records', () => {
    const records = new Map<number, ValidationRecord>([
      [2, {
        repositoryId: 2,
        sourceSha: 'b'.repeat(40),
        sourcePushedAt: catalog.repositories[1].pushedAt,
        updatedAt: '2026-08-14T16:10:00.000Z',
        dshVersion: target.dshVersion,
        platform: target.platform,
        validatorVersion: target.validatorVersion,
        structure: { status: 'failed', reason: '验证基础设施暂不可用' },
        sandbox: { status: 'skipped' },
      }],
      [4, {
        repositoryId: 4,
        sourceSha: 'c'.repeat(40),
        sourcePushedAt: catalog.repositories[3].pushedAt,
        updatedAt: '2026-08-14T16:10:00.000Z',
        dshVersion: target.dshVersion,
        platform: target.platform,
        validatorVersion: target.validatorVersion,
        structure: { status: 'quarantined' as any },
        sandbox: { status: 'skipped' },
      }],
    ])

    const repaired = reconcileValidationState(
      catalog,
      state([{ repositoryId: 1, pushedAt: catalog.repositories[0].pushedAt }]),
      records,
      target,
      '2026-08-14T16:20:00.000Z',
    )

    expect(repaired?.entries).toEqual([
      { repositoryId: 1, pushedAt: catalog.repositories[0].pushedAt },
      { repositoryId: 2, pushedAt: catalog.repositories[1].pushedAt },
      { repositoryId: 4, pushedAt: catalog.repositories[3].pushedAt },
    ])
    expect(reconcileValidationState(catalog, null, records, target, '2026-08-14T16:20:00.000Z')).toBeNull()
  })
})
