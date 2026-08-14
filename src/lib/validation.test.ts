import { describe, expect, it } from 'vitest'

import {
  buildValidationStatus,
  parseValidationFeed,
} from './validation'

const baseInput = {
  repositoryId: 101,
  projectType: 'plugin' as const,
  repositoryPushedAt: '2026-08-14T08:00:00Z',
  legacyVerificationUrl: null,
}

describe('validation ladder', () => {
  it('routes recognized plugins, unknown projects, and non-plugin entries to honest defaults', () => {
    expect(buildValidationStatus(baseInput)).toMatchObject({
      overall: 'check-pending',
      label: '待结构检查',
      eligible: true,
      verified: false,
      stages: {
        discovery: { status: 'passed' },
        identification: { status: 'passed' },
        structure: { status: 'pending' },
        sandbox: { status: 'pending' },
      },
    })

    expect(buildValidationStatus({ ...baseInput, projectType: 'unknown' })).toMatchObject({
      overall: 'unrecognized',
      label: '待识别',
      eligible: false,
      stages: { identification: { status: 'pending' } },
    })

    expect(buildValidationStatus({ ...baseInput, projectType: 'application' })).toMatchObject({
      overall: 'not-applicable',
      label: '非插件验证范围',
      eligible: false,
      stages: { identification: { status: 'passed' }, structure: { status: 'skipped' } },
    })
  })

  it('advances from structure check into sandbox validation without skipping a gate', () => {
    const feed = parseValidationFeed({
      schemaVersion: 1,
      generatedAt: '2026-08-14T08:30:00Z',
      records: [{
        repositoryId: 101,
        sourceSha: 'a'.repeat(40),
        sourcePushedAt: baseInput.repositoryPushedAt,
        updatedAt: '2026-08-14T08:25:00Z',
        structure: { status: 'passed', checkedAt: '2026-08-14T08:20:00Z' },
        sandbox: { status: 'running', checkedAt: '2026-08-14T08:25:00Z' },
      }],
    })

    expect(buildValidationStatus({ ...baseInput, record: feed.get(101) })).toMatchObject({
      overall: 'sandbox-running',
      label: '实机验证中',
      level: 3,
      verified: false,
      stages: {
        structure: { status: 'passed' },
        sandbox: { status: 'running' },
      },
    })
  })

  it('marks a pinned passing result verified and expires it when the repository changes', () => {
    const record = {
      repositoryId: 101,
      sourceSha: 'b'.repeat(40),
      sourcePushedAt: baseInput.repositoryPushedAt,
      updatedAt: '2026-08-14T09:00:00Z',
      dshVersion: '0.1.0-rc.6',
      platform: 'linux-x64',
      validatorVersion: '0.1.0',
      structure: { status: 'passed' as const, checkedAt: '2026-08-14T08:40:00Z' },
      sandbox: {
        status: 'passed' as const,
        checkedAt: '2026-08-14T09:00:00Z',
        reportUrl: 'https://reports.example/101.json',
      },
    }

    expect(buildValidationStatus({ ...baseInput, record })).toMatchObject({
      overall: 'verified',
      label: '已验证',
      level: 4,
      verified: true,
      sourceSha: 'b'.repeat(40),
      validatorVersion: '0.1.0',
      reportUrl: 'https://reports.example/101.json',
    })
    expect(buildValidationStatus({
      ...baseInput,
      repositoryPushedAt: '2026-08-14T10:00:00Z',
      record,
    })).toMatchObject({
      overall: 'expired',
      label: '需重新验证',
      verified: false,
    })
  })

  it('keeps unpinned external verification as a record instead of current verification', () => {
    expect(buildValidationStatus({
      ...baseInput,
      legacyVerificationUrl: 'https://github.com/example/verification',
    })).toMatchObject({
      overall: 'recorded',
      label: '已有验证记录',
      verified: false,
      reportUrl: 'https://github.com/example/verification',
    })
  })

  it('rejects duplicate records and sandbox results that bypass structure checks', () => {
    const duplicate = {
      repositoryId: 101,
      sourceSha: 'c'.repeat(40),
      sourcePushedAt: baseInput.repositoryPushedAt,
      updatedAt: '2026-08-14T08:30:00Z',
      structure: { status: 'passed' },
      sandbox: { status: 'pending' },
    }
    expect(() => parseValidationFeed({
      schemaVersion: 1,
      generatedAt: '2026-08-14T08:30:00Z',
      records: [duplicate, duplicate],
    })).toThrow('重复')

    expect(() => parseValidationFeed({
      schemaVersion: 1,
      generatedAt: '2026-08-14T08:30:00Z',
      records: [{
        ...duplicate,
        structure: { status: 'failed' },
        sandbox: { status: 'passed' },
      }],
    })).toThrow('结构检查')
  })

  it('rejects a passing public record without complete SHA, DSH, platform, and validator bindings', () => {
    expect(() => parseValidationFeed({
      schemaVersion: 1,
      generatedAt: '2026-08-14T08:30:00Z',
      records: [{
        repositoryId: 101,
        sourceSha: 'a'.repeat(40),
        sourcePushedAt: baseInput.repositoryPushedAt,
        updatedAt: '2026-08-14T08:30:00Z',
        structure: { status: 'passed' },
        sandbox: { status: 'passed' },
      }],
    })).toThrow('完整验证绑定')
  })
})
