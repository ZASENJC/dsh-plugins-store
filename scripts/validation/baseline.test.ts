import { readFile } from 'node:fs/promises'

import { describe, expect, it } from 'vitest'

import { parseBaseline } from './baseline'

describe('P2 Linux headless/tool baseline', () => {
  it('pins approximately 20 unique known repositories to complete SHAs and one validator target', async () => {
    const baseline = parseBaseline(JSON.parse(await readFile('validation/baseline.json', 'utf8')))

    expect(baseline.targets).toHaveLength(20)
    expect(new Set(baseline.targets.map(({ repositoryId }) => repositoryId)).size).toBe(20)
    expect(new Set(baseline.targets.map(({ fullName }) => fullName.toLowerCase())).size).toBe(20)
    expect(baseline).toMatchObject({
      schemaVersion: 1,
      dshVersion: '0.1.0-rc.6',
      platform: 'linux-x64',
      validatorVersion: '0.1.0',
    })
    for (const target of baseline.targets) {
      expect(target.sourceSha).toMatch(/^[a-f0-9]{40}$/)
      expect(target.executionType).toBe('host-tool')
      expect(target.expectedFinalStatuses.length).toBeGreaterThan(0)
    }
  })

  it('rejects mutable refs and duplicate numeric identities', () => {
    const target = {
      repositoryId: 1,
      fullName: 'fixture/plugin',
      sourceSha: 'a'.repeat(40),
      executionType: 'host-tool',
      smokeMode: 'tool-registration',
      expectedFinalStatuses: ['verified'],
    }
    const base = {
      schemaVersion: 1,
      generatedAt: '2026-08-14T12:00:00Z',
      dshVersion: '0.1.0-rc.6',
      platform: 'linux-x64',
      validatorVersion: '0.1.0',
      targets: [target],
    }

    expect(() => parseBaseline({ ...base, targets: [{ ...target, sourceSha: 'main' }] })).toThrow('sourceSha')
    expect(() => parseBaseline({ ...base, targets: [target, { ...target, fullName: 'fixture/renamed' }] })).toThrow('duplicate')
  })

  it('supports loader smoke for host plugins that do not register tools', () => {
    const baseline = parseBaseline({
      schemaVersion: 1,
      generatedAt: '2026-08-14T12:00:00Z',
      dshVersion: '0.1.0-rc.6',
      platform: 'linux-x64',
      validatorVersion: '0.1.0',
      targets: [{
        repositoryId: 1,
        fullName: 'fixture/host-plugin',
        sourceSha: 'a'.repeat(40),
        executionType: 'host-tool',
        smokeMode: 'loader',
        expectedFinalStatuses: ['verified'],
      }],
    })

    expect(baseline.targets[0].smokeMode).toBe('loader')
  })
})
