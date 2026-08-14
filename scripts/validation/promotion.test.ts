import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import type { ValidationReport, ValidationStatus } from '../../src/lib/validation-report'
import { parseBaseline, type BaselineTarget } from './baseline'
import {
  assessPromotionGate,
  buildPublicValidationFeed,
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

describe('P4 promotion quality gate', () => {
  it('requires all 20 baseline targets and two fresh sandbox observations per target', () => {
    const partial = baseline.targets.slice(0, 1).flatMap((target) => [reportFor(target, 1), reportFor(target, 2)])
    expect(assessPromotionGate(baseline, partial)).toMatchObject({
      eligible: false,
      reasons: expect.arrayContaining(['BASELINE_COVERAGE_INSUFFICIENT']),
      metrics: { configuredTargets: 20, observedTargets: 1 },
    })

    const singleRuns = reportsForAll(1)
    expect(assessPromotionGate(baseline, singleRuns)).toMatchObject({
      eligible: false,
      reasons: expect.arrayContaining(['REPEAT_OBSERVATION_INSUFFICIENT']),
      metrics: { observedTargets: 20, repeatableTargets: 0 },
    })
  })

  it('does not count stale target bindings or inconsistent outcomes as promotion evidence', () => {
    const reports = reportsForAll()
    reports[0] = reportFor(baseline.targets[0], 1, 'verified', { dshVersion: '0.1.0-rc.7' })
    reports[3] = reportFor(baseline.targets[1], 2, 'inconclusive')

    expect(assessPromotionGate(baseline, reports)).toMatchObject({
      eligible: false,
      reasons: expect.arrayContaining([
        'EVIDENCE_BINDING_MISMATCH',
        'REPEAT_OBSERVATION_INSUFFICIENT',
        'BASELINE_OUTCOME_INCONSISTENT',
      ]),
      metrics: { mismatchedReports: 1 },
    })
  })

  it('promotes only repeatable current verified bindings after the baseline gate passes', () => {
    const reports = reportsForAll()
    const assessment = assessPromotionGate(baseline, reports)
    expect(assessment).toMatchObject({
      eligible: true,
      reasons: [],
      metrics: {
        configuredTargets: 20,
        observedTargets: 20,
        repeatableTargets: 20,
        inconsistentTargets: 0,
        unexpectedOutcomeRate: 0,
      },
    })

    const feed = buildPublicValidationFeed(baseline, reports, '2026-08-14T14:00:00.000Z')
    expect(feed.records).toHaveLength(20)
    expect(feed.records[0]).toMatchObject({
      sourceSha: baseline.targets[0].sourceSha,
      dshVersion: baseline.dshVersion,
      platform: baseline.platform,
      validatorVersion: baseline.validatorVersion,
      structure: { status: 'passed' },
      sandbox: { status: 'passed' },
    })
  })
})
