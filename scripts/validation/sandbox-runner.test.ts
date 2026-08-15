import { createHash } from 'node:crypto'

import { describe, expect, it, vi } from 'vitest'

import { parseValidationReport, type ValidationReport } from '../../src/lib/validation-report'
import { buildLinuxSandboxPlan } from './linux-sandbox'
import { executeLinuxSandboxPlan } from './sandbox-runner'

const target = {
  repositoryId: 1323526209,
  fullName: 'omdsh-dev/dsh-tool-calculator',
  sourceSha: '701f6549b4e1b648351403dc8a18a9bc9a2b713d',
  executionType: 'host-tool' as const,
  smokeMode: 'tool-registration' as const,
  expectedFinalStatuses: ['verified' as const],
}

function structureReport(): ValidationReport {
  return parseValidationReport({
    schemaVersion: 1,
    reportId: 'fixture-report',
    mode: 'shadow',
    validationKind: 'linux-headless',
    executionType: 'host-tool',
    repository: {
      id: target.repositoryId,
      fullName: target.fullName,
      url: `https://github.com/${target.fullName}`,
      sourceSha: target.sourceSha,
      sourcePushedAt: '2026-08-14T03:10:54Z',
    },
    target: {
      dshVersion: '0.1.0-rc.6',
      platform: 'linux-x64',
      nodeVersion: '22.23.1',
      validatorVersion: '0.1.0',
    },
    startedAt: '2026-08-14T12:00:00Z',
    completedAt: '2026-08-14T12:00:00Z',
    currentStatus: 'structure_passed',
    events: [
      { sequence: 1, stage: 'discovery', status: 'discovered', at: '2026-08-14T12:00:00Z' },
      { sequence: 2, stage: 'classification', status: 'recognized', at: '2026-08-14T12:00:00Z' },
      { sequence: 3, stage: 'structure', status: 'structure_passed', at: '2026-08-14T12:00:00Z' },
    ],
    structureChecks: [],
    failure: null,
    artifacts: [],
  })
}

function plan() {
  return buildLinuxSandboxPlan(target, {
    runId: 'fixture-run',
    sourceDirectory: '/tmp/pinned-source',
    dshVersion: '0.1.0-rc.6',
    validatorVersion: '0.1.0',
  })
}

describe('P2 sandbox execution report', () => {
  it('records each successful ladder stage and always destroys sandbox resources', async () => {
    const executor = vi.fn(async (_command, _id: string) => ({ exitCode: 0, timedOut: false, stdout: '', stderr: '' }))

    const result = await executeLinuxSandboxPlan(structureReport(), plan(), {
      executor,
      now: () => '2026-08-14T12:01:00Z',
    })

    expect(result.report.currentStatus).toBe('verified')
    expect(result.report.events.map(({ status }) => status)).toEqual([
      'discovered', 'recognized', 'structure_passed', 'queued', 'running',
      'install_passed', 'runtime_passed', 'smoke_passed', 'verified',
    ])
    expect(result.results).toHaveLength(8)
    expect(executor.mock.calls.slice(-2).map((call) => call[1])).toEqual(['remove-container', 'remove-volume'])
  })

  it('stops after a deterministic build failure, fingerprints it, and still cleans up', async () => {
    const executor = vi.fn(async (_command, id: string) => ({
      exitCode: id === 'build' ? 1 : 0,
      timedOut: false,
      stdout: id === 'build' ? 'host path /Users/private' : '',
      stderr: id === 'build' ? 'TOKEN=must-not-escape' : '',
    }))

    const result = await executeLinuxSandboxPlan(structureReport(), plan(), {
      executor,
      now: () => '2026-08-14T12:02:00Z',
    })

    expect(result.report).toMatchObject({
      currentStatus: 'failed',
      failure: {
        attribution: 'plugin',
        code: 'PLUGIN_BUILD_FAILED',
        fingerprint: createHash('sha256')
          .update(`${target.repositoryId}:${target.sourceSha}:0.1.0-rc.6:PLUGIN_BUILD_FAILED`)
          .digest('hex'),
      },
    })
    expect(JSON.stringify(result)).not.toMatch(/must-not-escape|\/Users\/private/)
    expect(executor.mock.calls.map((call) => call[1])).not.toContain('load')
    expect(executor.mock.calls.slice(-2).map((call) => call[1])).toEqual(['remove-container', 'remove-volume'])
  })

  it('keeps a timeout inconclusive and does not manufacture a plugin failure', async () => {
    const executor = vi.fn(async (_command, id: string) => ({
      exitCode: id === 'install-dependencies' ? null : 0,
      timedOut: id === 'install-dependencies',
      stdout: '',
      stderr: '',
    }))

    const result = await executeLinuxSandboxPlan(structureReport(), plan(), {
      executor,
      now: () => '2026-08-14T12:03:00Z',
    })

    expect(result.report).toMatchObject({ currentStatus: 'inconclusive', failure: null })
    expect(result.summary).toMatchObject({ attribution: 'infrastructure', code: 'SANDBOX_TIMEOUT' })
  })

  it('keeps a pnpm offline metadata miss inconclusive without retaining registry diagnostics', async () => {
    const executor = vi.fn(async (_command, id: string) => ({
      exitCode: id === 'install-plugin' ? 1 : 0,
      timedOut: false,
      stdout: '',
      stderr: id === 'install-plugin'
        ? 'ERR_PNPM_NO_OFFLINE_META GET https://registry.npmjs.org/private-package TOKEN=must-not-escape'
        : '',
    }))

    const result = await executeLinuxSandboxPlan(structureReport(), plan(), {
      executor,
      now: () => '2026-08-14T12:04:00Z',
    })

    expect(result.report).toMatchObject({
      currentStatus: 'inconclusive',
      failure: null,
      events: expect.arrayContaining([expect.objectContaining({
        status: 'inconclusive',
        code: 'OFFLINE_DEPENDENCY_CACHE_MISS',
        attribution: 'infrastructure',
      })]),
    })
    expect(JSON.stringify(result)).not.toMatch(/registry\.npmjs|must-not-escape|private-package/)
  })
})
