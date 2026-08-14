import { describe, expect, it, vi } from 'vitest'

import {
  buildScannerCommands,
  parseGitleaksReport,
  parseOsvReport,
  parseTrivyReport,
  runScannerCommands,
} from './scanner-adapters'

describe('pinned scanner adapters', () => {
  it('builds version-pinned Docker commands with read-only source mounts and no shell', () => {
    const commands = buildScannerCommands('/tmp/dsh-source')

    expect(commands.map(({ tool, file }) => [tool, file])).toEqual([
      ['trivy', 'docker'],
      ['osv', 'docker'],
      ['gitleaks', 'docker'],
    ])
    for (const command of commands) {
      expect(command.args).toContain('--read-only')
      expect(command.args).toContain('--cap-drop=ALL')
      expect(command.args).toContain('type=bind,src=/tmp/dsh-source,dst=/workspace,readonly')
      expect(command.args.join(' ')).not.toMatch(/sh -c|bash -c/)
      expect(command.outputPath.startsWith('/tmp/dsh-source/')).toBe(false)
    }
    expect(commands[0].args).toContain('aquasec/trivy:0.74.0')
    expect(commands[0].args).toContain('--tmpfs=/tmp:rw,noexec,nosuid,size=1g')
    expect(commands[0].args).toContain('--memory=2g')
    expect(commands[0].args).toContain('--cache-dir=/tmp/trivy-cache')
    expect(commands[1].args).toContain('ghcr.io/google/osv-scanner:v2.5.0')
    expect(commands[2].args).toContain('ghcr.io/gitleaks/gitleaks:v8.30.1')
  })

  it('normalizes scanner reports without leaking secret content', () => {
    expect(parseTrivyReport({ Results: [{ Vulnerabilities: [{ VulnerabilityID: 'CVE-1', Severity: 'HIGH', PkgPath: 'lock' }] }] }))
      .toEqual({ status: 'findings', vulnerabilities: [{ id: 'CVE-1', severity: 'HIGH', path: 'lock' }], secrets: [] })
    expect(parseOsvReport({ results: [{ packages: [{ vulnerabilities: [{ id: 'GHSA-1' }], source: { path: 'package-lock.json' } }] }] }))
      .toEqual({ status: 'findings', vulnerabilities: [{ id: 'GHSA-1', path: 'package-lock.json' }] })
    const gitleaks = parseGitleaksReport([{ RuleID: 'generic-api-key', File: '.env', Secret: 'must-not-escape' }])
    expect(gitleaks).toEqual({ status: 'findings', secrets: [{ ruleId: 'generic-api-key', path: '.env' }] })
    expect(JSON.stringify(gitleaks)).not.toContain('must-not-escape')
  })

  it('marks only the failed scanner unavailable and continues collecting results', async () => {
    const executor = vi.fn(async (_file: string, args: string[]) => {
      const image = args.find((value) => value.includes(':v') || value.includes('/trivy:')) ?? ''
      if (image.includes('osv-scanner')) throw new Error('scanner timeout')
      if (image.includes('trivy')) return JSON.stringify({ Results: [] })
      return '[]'
    })

    const result = await runScannerCommands('/tmp/dsh-source', { executor })

    expect(result).toEqual({
      trivy: { status: 'passed', vulnerabilities: [], secrets: [] },
      osv: { status: 'unavailable', vulnerabilities: [] },
      gitleaks: { status: 'passed', secrets: [] },
    })
    expect(executor).toHaveBeenCalledTimes(3)
  })
})
