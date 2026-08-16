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

const catalogWithUnknown = {
  ...catalog,
  repositories: [
    ...catalog.repositories,
    { repositoryId: 5, projectType: 'unknown', pushedAt: '2026-08-14T14:00:00.000Z' },
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
  it('includes unknown projects in the source-classification audit set', () => {
    expect(selectValidationDelta(catalogWithUnknown, null, target, 20, '2026-08-14T16:01:00.000Z'))
      .toMatchObject({ repositoryIds: [1, 2, 4, 5] })
  })

  it('selects every validation-eligible project only when no compatible cursor exists', () => {
    expect(selectValidationDelta(catalog, null, target, 20, '2026-08-14T16:01:00.000Z')).toMatchObject({
      mode: 'full',
      repositoryIds: [1, 2, 4],
      shards: [0, 1, 2],
    })
    expect(selectValidationDelta(
      catalog,
      state([], { validatorVersion: '0.2.0' }),
      target,
      20,
      '2026-08-14T16:01:00.000Z',
    ).mode).toBe('full')
  })

  it('uses deterministic cost-balanced shard assignments instead of catalog position modulo', () => {
    const selected = selectValidationDelta({
      ...catalog,
      repositories: [
        { repositoryId: 90, projectType: 'plugin', pushedAt: '2026-08-14T10:00:00.000Z', sizeKb: 10_000 },
        { repositoryId: 10, projectType: 'plugin', pushedAt: '2026-08-14T10:00:00.000Z', sizeKb: 1 },
        { repositoryId: 30, projectType: 'channel', pushedAt: '2026-08-14T10:00:00.000Z', sizeKb: 500 },
        { repositoryId: 20, projectType: 'plugin', pushedAt: '2026-08-14T10:00:00.000Z', sizeKb: 500 },
      ],
    }, null, target, 2, '2026-08-14T16:01:00.000Z')

    expect(selected.shardPlan).toHaveLength(4)
    expect(new Set(selected.shardPlan?.map(({ shard }) => shard)).size).toBe(2)
    expect(selected.shardPlan?.map(({ repositoryId }) => repositoryId)).toEqual([10, 20, 30, 90])
    expect(selectValidationDelta({
      ...catalog,
      repositories: [
        { repositoryId: 20, projectType: 'plugin', pushedAt: '2026-08-14T10:00:00.000Z', sizeKb: 500 },
        { repositoryId: 90, projectType: 'plugin', pushedAt: '2026-08-14T10:00:00.000Z', sizeKb: 10_000 },
        { repositoryId: 10, projectType: 'plugin', pushedAt: '2026-08-14T10:00:00.000Z', sizeKb: 1 },
        { repositoryId: 30, projectType: 'channel', pushedAt: '2026-08-14T10:00:00.000Z', sizeKb: 500 },
      ],
    }, null, target, 2, '2026-08-14T16:01:00.000Z').shardPlan).toEqual(selected.shardPlan)
  })

  it('selects only new or pushed repositories and produces no work for an unchanged catalog', () => {
    const previous = state([
      { repositoryId: 1, pushedAt: catalog.repositories[0].pushedAt },
      { repositoryId: 2, pushedAt: '2026-08-14T09:00:00.000Z' },
    ])
    expect(selectValidationDelta(catalog, previous, target, 20, '2026-08-14T16:01:00.000Z')).toMatchObject({
      mode: 'incremental',
      repositoryIds: [2, 4],
      shards: [0, 1],
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

  it('keeps infrastructure outcomes out of the cursor so they retry on the next run', () => {
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
      {
        repositoryId: 4,
        pushedAt: catalog.repositories[3].pushedAt,
        executionType: 'host-tool',
        retryCount: 1,
        nextRetryAt: '2026-08-14T16:35:00.000Z',
      },
    ])
    expect(selectValidationDelta(catalog, next, target, 20, '2026-08-14T16:30:00.000Z').repositoryIds)
      .toEqual([])
    expect(selectValidationDelta(catalog, next, target, 20, '2026-08-14T17:01:00.000Z').repositoryIds)
      .toEqual([4])
  })

  it('backs off retryable outcomes and continues low-frequency retries after five attempts', () => {
    let current = state([
      { repositoryId: 1, pushedAt: catalog.repositories[0].pushedAt },
      { repositoryId: 2, pushedAt: catalog.repositories[1].pushedAt },
      {
        repositoryId: 4,
        pushedAt: catalog.repositories[3].pushedAt,
        retryCount: 1,
        nextRetryAt: '2026-08-14T16:35:00.000Z',
      },
    ])
    expect(selectValidationDelta(catalog, current, target, 20, '2026-08-14T16:30:00.000Z').repositoryIds)
      .toEqual([])

    for (const now of [
      '2026-08-14T16:35:00.000Z',
      '2026-08-14T17:05:00.000Z',
      '2026-08-14T18:05:00.000Z',
      '2026-08-14T20:05:00.000Z',
    ]) {
      const selection = selectValidationDelta(catalog, current, target, 20, now)
      expect(selection.repositoryIds).toEqual([4])
      current = buildValidationState(catalog, current, selection, [report(4, 'infrastructure')], now)
    }

    expect(current.entries).toEqual([
      { repositoryId: 1, pushedAt: catalog.repositories[0].pushedAt },
      { repositoryId: 2, pushedAt: catalog.repositories[1].pushedAt },
      {
        repositoryId: 4,
        pushedAt: catalog.repositories[3].pushedAt,
        executionType: 'host-tool',
        retryCount: 5,
        retryExhausted: true,
        nextRetryAt: '2026-08-15T00:05:00.000Z',
      },
    ])
    expect(selectValidationDelta(catalog, current, target, 20, '2026-08-15T00:05:00.000Z').repositoryIds)
      .toEqual([4])
  })

  it('retains the latest duration and execution type as the next shard cost signal', () => {
    const selection: ValidationSelection = {
      schemaVersion: 1,
      generatedAt: '2026-08-14T16:01:00.000Z',
      mode: 'incremental',
      catalogGeneratedAt: catalog.generatedAt,
      target,
      repositoryIds: [2],
      shards: [0],
    }
    const timed = report(2, 'verified')
    timed.startedAt = '2026-08-14T15:00:00.000Z'
    const next = buildValidationState(catalog, null, selection, [timed], '2026-08-14T16:20:00.000Z')
    expect(next.entries).toEqual([{
      repositoryId: 2,
      pushedAt: catalog.repositories[1].pushedAt,
      lastDurationMs: 70 * 60 * 1000,
      executionType: 'host-tool',
    }])
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
    ).entries).toEqual([{
      repositoryId: 4,
      pushedAt: catalog.repositories[3].pushedAt,
      executionType: 'host-tool',
      retryCount: 1,
      nextRetryAt: '2026-08-14T16:35:00.000Z',
    }])
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
