import { describe, expect, it } from 'vitest'

import {
  appendValidationEvent,
  type ExecutionType,
  type ValidationReport,
} from '../../src/lib/validation-report'
import { planCandidate, runCandidateBatch } from './candidate-runner'

function structureReport(repositoryId: number, executionType: ExecutionType): ValidationReport {
  const at = `2026-08-14T15:${String(repositoryId).padStart(2, '0')}:00.000Z`
  return {
    schemaVersion: 1,
    reportId: `candidate-${repositoryId}`,
    mode: 'shadow',
    validationKind: executionType === 'web' ? 'dsh-web' : 'linux-headless',
    executionType,
    repository: {
      id: repositoryId,
      fullName: `fixture/plugin-${repositoryId}`,
      url: `https://github.com/fixture/plugin-${repositoryId}`,
      sourceSha: String(repositoryId).repeat(40),
      sourcePushedAt: '2026-08-14T12:00:00.000Z',
    },
    target: {
      dshVersion: '0.1.0-rc.6',
      platform: 'linux-x64',
      nodeVersion: '22.22.0',
      validatorVersion: '0.1.0',
    },
    startedAt: at,
    completedAt: null,
    currentStatus: 'structure_passed',
    events: [
      { sequence: 1, stage: 'discovery', status: 'discovered', at },
      { sequence: 2, stage: 'classification', status: 'recognized', at },
      { sequence: 3, stage: 'structure', status: 'structure_passed', at },
    ],
    structureChecks: [],
    failure: null,
    artifacts: [],
  }
}

function verified(report: ValidationReport): ValidationReport {
  const at = report.startedAt
  let next = appendValidationEvent(report, { stage: 'sandbox', status: 'queued', at })
  next = appendValidationEvent(next, { stage: 'sandbox', status: 'running', at })
  next = appendValidationEvent(next, { stage: 'installation', status: 'install_passed', at })
  next = appendValidationEvent(next, { stage: 'runtime', status: 'runtime_passed', at })
  next = appendValidationEvent(next, { stage: 'smoke', status: 'smoke_passed', at })
  return appendValidationEvent(next, { stage: 'final', status: 'verified', at })
}

describe('dynamic validation candidate runner', () => {
  it('queues generic Linux plugins and retains unsupported contracts as inconclusive', () => {
    expect(planCandidate(structureReport(1, 'host-tool'))).toMatchObject({
      disposition: 'queue',
      validator: 'linux-headless',
      smokeMode: 'loader',
    })
    expect(planCandidate(structureReport(2, 'command'))).toMatchObject({
      disposition: 'queue',
      validator: 'linux-headless',
      smokeMode: 'loader',
    })
    expect(planCandidate(structureReport(3, 'web'))).toMatchObject({
      disposition: 'inconclusive',
      code: 'WEB_SMOKE_CONTRACT_REQUIRED',
    })
  })

  it('executes one candidate at a time and continues after an infrastructure failure', async () => {
    let active = 0
    let maxActive = 0
    const result = await runCandidateBatch([
      structureReport(1, 'host-tool'),
      structureReport(2, 'host-tool'),
      structureReport(3, 'web'),
    ], {
      executeQueued: async (report) => {
        active += 1
        maxActive = Math.max(maxActive, active)
        await Promise.resolve()
        active -= 1
        if (report.repository.id === 2) throw new Error('runner unavailable')
        return verified(report)
      },
      now: () => '2026-08-14T16:00:00.000Z',
    })

    expect(maxActive).toBe(1)
    expect(result).toMatchObject({ attempted: 3, verified: 1, inconclusive: 2, failed: 0 })
    expect(result.reports.map(({ currentStatus }) => currentStatus)).toEqual([
      'verified', 'inconclusive', 'inconclusive',
    ])
  })
})
