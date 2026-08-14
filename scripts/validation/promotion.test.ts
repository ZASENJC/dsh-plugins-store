import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import type { ValidationReport, ValidationStatus } from '../../src/lib/validation-report'
import { parseBaseline, type BaselineTarget } from './baseline'
import {
  assessPromotionGate,
  buildPublicValidationFeed,
  mergeValidationFeeds,
} from './promotion'

const baseline = parseBaseline(JSON.parse(readFileSync('validation/baseline.json', 'utf8')))

function reportFor(
  target: BaselineTarget,
  run: number,
  status: Extract<ValidationStatus, 'verified' | 'inconclusive'> = 'verified',
  overrides: {
    sourceSha?: string
    dshVersion?: string
    platform?: string
    validatorVersion?: string
  } = {},
): ValidationReport {
  const minute = String(run).padStart(2, '0')
  const startedAt = `2026-08-14T13:${minute}:00.000Z`
  const events: ValidationReport['events'] = [
    { sequence: 1, stage: 'discovery', status: 'discovered', at: startedAt },
    { sequence: 2, stage: 'classification', status: 'recognized', at: startedAt },
    { sequence: 3, stage: 'structure', status: 'structure_passed', at: startedAt },
    { sequence: 4, stage: 'sandbox', status: 'queued', at: startedAt },
    { sequence: 5, stage: 'sandbox', status: 'running', at: startedAt },
  ]
  if (status === 'verified') {
    events.push(
      { sequence: 6, stage: 'installation', status: 'install_passed', at: startedAt },
      { sequence: 7, stage: 'runtime', status: 'runtime_passed', at: startedAt },
      { sequence: 8, stage: 'smoke', status: 'smoke_passed', at: startedAt },
      { sequence: 9, stage: 'final', status: 'verified', at: startedAt },
    )
  } else {
    events.push({
      sequence: 6,
      stage: 'sandbox',
      status: 'inconclusive',
      at: startedAt,
      code: 'FIXTURE_INCONCLUSIVE',
      reason: 'Fixture cannot determine the result.',
      attribution: 'inconclusive',
    })
  }
  return {
    schemaVersion: 1,
    reportId: `${target.repositoryId}-run-${run}`,
    mode: 'shadow',
    validationKind: 'linux-headless',
    executionType: target.executionType,
    repository: {
      id: target.repositoryId,
      fullName: target.fullName,
      url: `https://github.com/${target.fullName}`,
      sourceSha: overrides.sourceSha ?? target.sourceSha,
      sourcePushedAt: '2026-08-14T12:00:00.000Z',
    },
    target: {
      dshVersion: overrides.dshVersion ?? baseline.dshVersion,
      platform: overrides.platform ?? baseline.platform,
      nodeVersion: '22.22.0',
      validatorVersion: overrides.validatorVersion ?? baseline.validatorVersion,
    },
    startedAt,
    completedAt: startedAt,
    currentStatus: status,
    events,
    structureChecks: [],
    failure: null,
    artifacts: [{ kind: 'report', url: `reports/${target.repositoryId}-${run}.json` }],
  }
}

function reportsForAll(runs = 2): ValidationReport[] {
  return baseline.targets.flatMap((target) => (
    Array.from({ length: runs }, (_, index) => reportFor(target, index + 1))
  ))
}

function negativeReportFor(
  target: BaselineTarget,
  run: number,
  status: 'failed' | 'structure_failed',
): ValidationReport {
  const report = reportFor(target, run)
  const code = status === 'failed' ? 'PLUGIN_BUILD_FAILED' : 'PACKAGE_ENTRYPOINT_MISSING'
  const failure = {
    attribution: 'plugin' as const,
    code,
    reason: code,
    fingerprint: `${target.repositoryId}-${code}`,
    reproducibility: { attempts: 1, matchingFingerprints: 1 },
  }
  if (status === 'structure_failed') {
    return {
      ...report,
      currentStatus: status,
      events: [
        ...report.events.slice(0, 2),
        { sequence: 3, stage: 'structure', status, at: report.startedAt, ...failure },
      ],
      failure,
    }
  }
  return {
    ...report,
    currentStatus: status,
    events: [
      ...report.events.slice(0, 5),
      { sequence: 6, stage: 'installation', status: 'install_failed', at: report.startedAt, ...failure },
      { sequence: 7, stage: 'final', status, at: report.startedAt, ...failure },
    ],
    failure,
  }
}

describe('P4 promotion quality gate', () => {
  it('requires all 20 baseline targets and accepts one fresh observation per target', () => {
    const partial = baseline.targets.slice(0, 1).map((target) => reportFor(target, 1))
    expect(assessPromotionGate(baseline, partial)).toMatchObject({
      eligible: false,
      reasons: expect.arrayContaining(['BASELINE_COVERAGE_INSUFFICIENT']),
      metrics: { configuredTargets: 20, observedTargets: 1 },
    })

    const singleRuns = reportsForAll(1)
    expect(assessPromotionGate(baseline, singleRuns)).toMatchObject({
      eligible: true,
      reasons: [],
      metrics: { observedTargets: 20 },
    })
  })

  it('does not count stale target bindings or inconsistent outcomes as promotion evidence', () => {
    const reports = reportsForAll()
    reports[0] = reportFor(baseline.targets[0], 1, 'verified', { dshVersion: '0.1.0-rc.7' })
    reports[3] = reportFor(baseline.targets[1], 2, 'inconclusive')

    expect(assessPromotionGate(baseline, reports)).toMatchObject({
      eligible: false,
      reasons: [
        'EVIDENCE_BINDING_MISMATCH',
        'BASELINE_OUTCOME_INCONSISTENT',
        'BASELINE_OUTCOME_UNEXPECTED',
      ],
      metrics: { mismatchedReports: 1 },
    })
  })

  it('deduplicates repeated delivery without reporting a binding mismatch', () => {
    const reports = reportsForAll()
    reports.push(reports[0])

    expect(assessPromotionGate(baseline, reports)).toMatchObject({
      eligible: true,
      reasons: [],
      metrics: { mismatchedReports: 0 },
    })
  })

  it('accepts declared negative controls as coverage without promoting them as verified', () => {
    const rawBaseline = JSON.parse(JSON.stringify(baseline))
    rawBaseline.targets[0].expectedFinalStatuses = ['failed']
    rawBaseline.targets[1].expectedFinalStatuses = ['structure_failed']
    rawBaseline.targets[2].expectedFinalStatuses = ['inconclusive']
    const negativeBaseline = parseBaseline(rawBaseline)
    const reports = reportsForAll(1)
    reports[0] = negativeReportFor(negativeBaseline.targets[0], 1, 'failed')
    reports[1] = negativeReportFor(negativeBaseline.targets[1], 1, 'structure_failed')
    const offline = reportFor(negativeBaseline.targets[2], 1, 'inconclusive')
    Object.assign(offline.events.at(-1)!, {
      code: 'OFFLINE_DEPENDENCY_CACHE_MISS',
      reason: 'OFFLINE_DEPENDENCY_CACHE_MISS',
      attribution: 'infrastructure',
    })
    reports[2] = offline

    expect(assessPromotionGate(negativeBaseline, reports)).toMatchObject({
      eligible: true,
      reasons: [],
      metrics: { observedTargets: 20, unexpectedReports: 0 },
    })
    const feed = buildPublicValidationFeed(negativeBaseline, reports, '2026-08-14T14:00:00.000Z')
    expect(feed.records).toHaveLength(20)
    expect(feed.records.find(({ repositoryId }) => repositoryId === negativeBaseline.targets[0].repositoryId))
      .toMatchObject({
      structure: { status: 'passed' },
      sandbox: { status: 'failed', reason: expect.stringContaining('构建失败') },
    })
    expect(feed.records.find(({ repositoryId }) => repositoryId === negativeBaseline.targets[1].repositoryId))
      .toMatchObject({
      structure: { status: 'failed', reason: expect.any(String) },
      sandbox: { status: 'skipped' },
    })
    expect(feed.records.find(({ repositoryId }) => repositoryId === negativeBaseline.targets[2].repositoryId))
      .toMatchObject({
      structure: { status: 'passed' },
      sandbox: {
        status: 'inconclusive',
        reason: expect.stringContaining('离线'),
      },
    })
  })

  it('promotes one current verified binding per target after the baseline gate passes', () => {
    const reports = reportsForAll(1)
    const assessment = assessPromotionGate(baseline, reports)
    expect(assessment).toMatchObject({
      eligible: true,
      reasons: [],
      metrics: {
        configuredTargets: 20,
        observedTargets: 20,
        inconsistentTargets: 0,
        unexpectedOutcomeRate: 0,
      },
    })

    const feed = buildPublicValidationFeed(baseline, reports, '2026-08-14T14:00:00.000Z')
    expect(feed.records).toHaveLength(20)
    expect(feed.records.find(({ repositoryId }) => repositoryId === baseline.targets[0].repositoryId)).toMatchObject({
      sourceSha: baseline.targets[0].sourceSha,
      dshVersion: baseline.dshVersion,
      platform: baseline.platform,
      validatorVersion: baseline.validatorVersion,
      structure: { status: 'passed' },
      sandbox: { status: 'passed' },
    })
  })

  it('uses isolated canary reports for the gate and publishes one latest record per repository', () => {
    const gateReports = reportsForAll(1)
    const currentSha = 'f'.repeat(40)
    const currentReport = reportFor(baseline.targets[0], 3, 'verified', { sourceSha: currentSha })

    const feed = buildPublicValidationFeed(
      baseline,
      [...gateReports, currentReport],
      '2026-08-14T14:00:00.000Z',
      gateReports,
    )

    expect(feed.records).toHaveLength(20)
    expect(feed.records.filter(({ repositoryId }) => repositoryId === baseline.targets[0].repositoryId))
      .toEqual([expect.objectContaining({ sourceSha: currentSha })])
  })

  it('preserves unchanged verified records while replacing incremental repository results', () => {
    const previous = buildPublicValidationFeed(
      baseline,
      reportsForAll(1),
      '2026-08-14T14:00:00.000Z',
    )
    const changed = baseline.targets[0]
    const currentSha = 'f'.repeat(40)
    const incremental = buildPublicValidationFeed(
      baseline,
      [...reportsForAll(1), reportFor(changed, 3, 'verified', { sourceSha: currentSha })],
      '2026-08-14T16:00:00.000Z',
      reportsForAll(1),
    )

    const merged = mergeValidationFeeds(previous, {
      ...incremental,
      records: incremental.records.filter(({ repositoryId }) => repositoryId === changed.repositoryId),
    })
    expect(merged.records).toHaveLength(previous.records.length)
    expect(merged.records.find(({ repositoryId }) => repositoryId === changed.repositoryId)?.sourceSha)
      .toBe(currentSha)
  })
})
