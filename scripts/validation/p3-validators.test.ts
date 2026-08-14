import { describe, expect, it } from 'vitest'

import type { ValidationReport } from '../../src/lib/validation-report'
import {
  buildChannelMockPlan,
  buildWebValidationPlan,
  parseChannelMockContract,
  validateCollectionMembers,
} from './p3-validators'

describe('P3 DSH Web + Playwright validator', () => {
  it('loads, checks a declared slot, uninstalls, and verifies cleanup without network or host mounts', () => {
    const plan = buildWebValidationPlan({
      repositoryId: 1,
      sourceSha: 'a'.repeat(40),
      packageName: '@fixture/web-plugin',
      expectedSelector: '[data-plugin="fixture"]',
    }, {
      containerName: 'dsh-web-fixture',
      volumeName: 'dsh-web-fixture',
    })

    expect(plan.steps.map(({ id }) => id)).toEqual([
      'install-web', 'web-smoke', 'uninstall-web', 'uninstall-check',
    ])
    for (const step of plan.steps) {
      expect(step.command.args).toContain('--platform=linux/amd64')
      expect(step.command.args).toContain('--network=none')
      expect(step.command.args).toContain('dsh-web-validator:0.1.0')
      expect(step.command.args.join(' ')).not.toMatch(/docker\.sock|type=bind|TOKEN|SECRET/)
    }
    expect(plan.steps.find(({ id }) => id === 'web-smoke')?.command.args)
      .toEqual(expect.arrayContaining(['[data-plugin="fixture"]']))
  })
})

describe('P3 collection validator', () => {
  const manifest = {
    members: [
      { repositoryId: 1, sourceSha: 'a'.repeat(40), required: true },
      { repositoryId: 2, sourceSha: 'b'.repeat(40), required: true },
    ],
  }
  const report = (repositoryId: number, sourceSha: string, currentStatus: ValidationReport['currentStatus']) => ({
    currentStatus,
    repository: { id: repositoryId, sourceSha },
    target: { dshVersion: '0.1.0-rc.6', platform: 'linux-x64' },
  }) as ValidationReport

  it('passes only when every required member has current matching verified evidence', () => {
    expect(validateCollectionMembers(manifest, [
      report(1, 'a'.repeat(40), 'verified'),
      report(2, 'b'.repeat(40), 'verified'),
    ], { dshVersion: '0.1.0-rc.6', platform: 'linux-x64' })).toEqual({
      status: 'verified',
      code: 'COLLECTION_MEMBERS_VERIFIED',
      memberCount: 2,
    })
  })

  it('is inconclusive for stale or missing member evidence instead of verifying the bundle', () => {
    expect(validateCollectionMembers(manifest, [
      report(1, 'c'.repeat(40), 'verified'),
    ], { dshVersion: '0.1.0-rc.6', platform: 'linux-x64' })).toMatchObject({
      status: 'inconclusive',
      code: 'COLLECTION_MEMBER_NOT_CURRENT',
    })
  })
})

describe('P3 Channel/MCP mock validator', () => {
  it('requires an explicit local mock contract and builds a networkless smoke plan', () => {
    const contract = parseChannelMockContract({
      protocol: 'http',
      endpointEnv: 'DSH_CHANNEL_ENDPOINT',
      request: { method: 'POST', path: '/messages' },
      response: { status: 200, body: { ok: true } },
      smokeCommand: ['node', 'validation/channel-smoke.mjs'],
      requiresCredentials: false,
    })
    const plan = buildChannelMockPlan(contract, {
      containerName: 'dsh-channel-fixture',
      volumeName: 'dsh-channel-fixture',
    })

    expect(plan.command.args).toEqual(expect.arrayContaining([
      '--platform=linux/amd64',
      '--network=none',
      'dsh-web-validator:0.1.0',
      '/validator/channel-mock-smoke.mjs',
    ]))
    expect(plan.command.args.join(' ')).not.toMatch(/api\.example|TOKEN|SECRET|docker\.sock|type=bind/)
  })

  it('rejects real credentials, external endpoints, shell commands, and missing mocks', () => {
    expect(() => parseChannelMockContract(null)).toThrow('mock contract')
    expect(() => parseChannelMockContract({
      protocol: 'http',
      endpointEnv: 'API_TOKEN',
      endpoint: 'https://api.example.com',
      smokeCommand: ['sh', '-c', 'curl example.com'],
      requiresCredentials: true,
    })).toThrow('mock contract')
  })
})
