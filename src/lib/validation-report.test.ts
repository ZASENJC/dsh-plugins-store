import { describe, expect, it } from 'vitest'

import {
  appendValidationEvent,
  assessValidationFreshness,
  expireValidationReport,
  parseValidationReport,
  type ValidationReport,
} from './validation-report'

const baseReport: ValidationReport = {
  schemaVersion: 1,
  reportId: '1333496313-aaaaaaaaaaaa-linux-x64-dsh-0.1.0-rc.6',
  mode: 'shadow',
  validationKind: 'linux-headless',
  executionType: 'host-tool',
  repository: {
    id: 1333496313,
    fullName: 'PlutoKeating/dsh-lark-bot',
    url: 'https://github.com/PlutoKeating/dsh-lark-bot',
    sourceSha: 'a'.repeat(40),
    sourcePushedAt: '2026-08-14T08:00:00Z',
  },
  target: {
    dshVersion: '0.1.0-rc.6',
    platform: 'linux-x64',
    nodeVersion: '22.19.0',
    validatorVersion: '1.0.0',
  },
  startedAt: '2026-08-14T08:10:00Z',
  completedAt: '2026-08-14T08:20:00Z',
  currentStatus: 'verified',
  events: [
    { sequence: 1, stage: 'discovery', status: 'discovered', at: '2026-08-14T08:10:00Z' },
    { sequence: 2, stage: 'classification', status: 'recognized', at: '2026-08-14T08:10:01Z' },
    { sequence: 3, stage: 'structure', status: 'structure_passed', at: '2026-08-14T08:12:00Z' },
    { sequence: 4, stage: 'sandbox', status: 'queued', at: '2026-08-14T08:12:01Z' },
    { sequence: 5, stage: 'sandbox', status: 'running', at: '2026-08-14T08:13:00Z' },
    { sequence: 6, stage: 'installation', status: 'install_passed', at: '2026-08-14T08:15:00Z' },
    { sequence: 7, stage: 'runtime', status: 'runtime_passed', at: '2026-08-14T08:17:00Z' },
    { sequence: 8, stage: 'smoke', status: 'smoke_passed', at: '2026-08-14T08:19:00Z' },
    { sequence: 9, stage: 'final', status: 'verified', at: '2026-08-14T08:20:00Z' },
  ],
  structureChecks: [
    { code: 'REPOSITORY_PINNED', status: 'passed', severity: 'required', message: 'Repository ID and SHA are pinned.' },
  ],
  failure: null,
  artifacts: [],
}

describe('validation report contract', () => {
  it('accepts the complete evidence ladder bound to a reproducible target', () => {
    expect(parseValidationReport(baseReport)).toEqual(baseReport)
  })

  it('rejects skipped stages and illegal state transitions', () => {
    expect(() => parseValidationReport({
      ...baseReport,
      currentStatus: 'runtime_passed',
      events: [
        baseReport.events[0],
        baseReport.events[1],
        baseReport.events[2],
        {
          sequence: 4,
          stage: 'runtime',
          status: 'runtime_passed',
          at: '2026-08-14T08:17:00Z',
        },
      ],
    })).toThrow('非法状态迁移')
  })

  it('requires deterministic failures to carry attribution, code, and fingerprint', () => {
    expect(() => appendValidationEvent(
      {
        ...baseReport,
        completedAt: null,
        currentStatus: 'running',
        events: baseReport.events.slice(0, 5),
      },
      {
        stage: 'installation',
        status: 'install_failed',
        at: '2026-08-14T08:15:00Z',
        code: 'PLUGIN_INSTALL_FAILED',
      },
    )).toThrow('失败指纹')
  })

  it.each([
    ['sourceSha', { sourceSha: 'b'.repeat(40) }],
    ['dshVersion', { dshVersion: '0.1.0-rc.7' }],
    ['platform', { platform: 'linux-arm64' }],
    ['validatorVersion', { validatorVersion: '1.1.0' }],
  ])('expires current verification when %s changes', (_field, change) => {
    const current = {
      repositoryId: baseReport.repository.id,
      sourceSha: baseReport.repository.sourceSha,
      dshVersion: baseReport.target.dshVersion,
      platform: baseReport.target.platform,
      validatorVersion: baseReport.target.validatorVersion,
    }
    const next = 'sourceSha' in change
      ? { ...current, ...change }
      : { ...current, ...change }

    expect(assessValidationFreshness(baseReport, next)).toMatchObject({
      current: false,
      shouldQueue: true,
    })
  })

  it('appends expiry evidence without deleting the verified history', () => {
    const expired = expireValidationReport(
      baseReport,
      'SOURCE_SHA_CHANGED',
      '2026-08-14T09:00:00Z',
    )

    expect(expired.currentStatus).toBe('expired')
    expect(expired.events.map(({ status }) => status)).toEqual([
      ...baseReport.events.map(({ status }) => status),
      'expired',
    ])
    expect(expired.events.at(-1)).toMatchObject({
      stage: 'final',
      code: 'SOURCE_SHA_CHANGED',
    })
  })
})
