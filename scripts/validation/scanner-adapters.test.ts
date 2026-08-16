import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  buildScannerCommands,
  parseGitleaksReport,
  parseOsvReport,
  parseTrivyReport,
  runScannerCommands,
} from './scanner-adapters'

const temporaryRoots: string[] = []

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

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
    expect(commands[0].args).toContain('--memory=1g')
    expect(commands[0].args).toContain('--tmpfs=/tmp:rw,noexec,nosuid,size=512m')
    expect(commands[0].args).toContain('--cache-dir=/tmp/trivy-cache')
    expect(commands[0].args).toEqual(expect.arrayContaining([
      expect.stringMatching(/^type=bind,src=.+,dst=\/tmp\/trivy-cache$/),
    ]))
    expect(commands[1].args).toContain('ghcr.io/google/osv-scanner:v2.5.0')
    expect(commands[1].args).toContain('--allow-no-lockfiles')
    const osvImageIndex = commands[1].args.indexOf('ghcr.io/google/osv-scanner:v2.5.0')
    expect(commands[1].args.slice(osvImageIndex + 1, osvImageIndex + 3)).toEqual(['scan', 'source'])
    expect(commands[2].args).toContain('ghcr.io/gitleaks/gitleaks:v8.30.1')
    expect(commands[2].args).toContain('--redact=100')
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

  it('marks only generic non-runtime Gitleaks signals as low-confidence', () => {
    const result = parseGitleaksReport([
      {
        RuleID: 'generic-api-key',
        File: '/workspace/tests/plugin.test.ts',
        StartLine: 12,
        Match: "secret = 'REDACTED'",
        Secret: 'must-not-escape',
      },
      {
        RuleID: 'private-key',
        File: '/workspace/tests/fixtures/key.pem',
        StartLine: 1,
        Match: 'REDACTED',
        Secret: 'must-not-escape',
      },
    ])

    expect(result).toEqual({
      status: 'findings',
      secrets: [
        {
          ruleId: 'generic-api-key',
          path: 'tests/plugin.test.ts',
          line: 12,
          triage: 'generic-non-runtime',
        },
        {
          ruleId: 'private-key',
          path: 'tests/fixtures/key.pem',
          line: 1,
        },
      ],
    })
    expect(JSON.stringify(result)).not.toContain('must-not-escape')
  })

  it('marks malformed generic matches as syntax noise without weakening runtime assignments', () => {
    const result = parseGitleaksReport([
      {
        RuleID: 'generic-api-key',
        File: '/workspace/src/index.ts',
        StartLine: 5,
        Match: 'parseAesKey, REDACTED',
      },
      {
        RuleID: 'generic-api-key',
        File: '/workspace/src/config.ts',
        StartLine: 9,
        Match: "apiKey = 'REDACTED'",
      },
    ])

    expect(result.secrets).toEqual([
      {
        ruleId: 'generic-api-key',
        path: 'src/index.ts',
        line: 5,
        triage: 'generic-syntax-noise',
      },
      {
        ruleId: 'generic-api-key',
        path: 'src/config.ts',
        line: 9,
      },
    ])
  })

  it('recognizes a Cloudflare Web Analytics token as a public client identifier', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-public-client-'))
    temporaryRoots.push(root)
    await mkdir(join(root, 'src'), { recursive: true })
    await writeFile(join(root, 'src/layout.astro'), [
      'const analytics = JSON.stringify({',
      "  token: 'public-client-value',",
      '})',
      '<script src="https://static.cloudflareinsights.com/beacon.min.js"',
      '  data-cf-beacon={analytics}></script>',
    ].join('\n'))
    const executor = vi.fn(async (_file: string, args: string[]) => {
      const image = args.find((value) => value.includes(':v') || value.includes('/trivy:')) ?? ''
      if (image.includes('trivy')) return JSON.stringify({ Results: [] })
      if (image.includes('osv-scanner')) return JSON.stringify({ results: [] })
      return JSON.stringify([{
        RuleID: 'generic-api-key',
        File: '/workspace/src/layout.astro',
        StartLine: 2,
        Match: "token: 'REDACTED'",
        Secret: 'REDACTED',
      }])
    })

    const result = await runScannerCommands(root, { executor })

    expect(result.gitleaks).toEqual({
      status: 'findings',
      secrets: [{
        ruleId: 'generic-api-key',
        path: 'src/layout.astro',
        line: 2,
        triage: 'public-client-identifier',
      }],
    })
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

  it('parses structured findings from a scanner non-zero exit instead of calling it unavailable', async () => {
    const executor = vi.fn(async (_file: string, args: string[]) => {
      const image = args.find((value) => value.includes(':v') || value.includes('/trivy:')) ?? ''
      if (image.includes('osv-scanner')) {
        throw Object.assign(new Error('scanner reported findings'), {
          stdout: JSON.stringify({
            results: [{ packages: [{
              source: { path: 'package-lock.json' },
              vulnerabilities: [{ id: 'GHSA-fixture' }],
            }] }],
          }),
        })
      }
      if (image.includes('trivy')) return JSON.stringify({ Results: [] })
      return '[]'
    })

    const result = await runScannerCommands('/tmp/dsh-source', { executor })

    expect(result.osv).toEqual({
      status: 'findings',
      vulnerabilities: [{ id: 'GHSA-fixture', path: 'package-lock.json' }],
    })
  })

  it('fails closed when a scanner exits non-zero with an empty report', async () => {
    const executor = vi.fn(async (_file: string, args: string[]) => {
      const image = args.find((value) => value.includes(':v') || value.includes('/trivy:')) ?? ''
      if (image.includes('osv-scanner')) {
        return { stdout: JSON.stringify({ results: [] }), exitCode: 2, timedOut: false, truncated: false }
      }
      if (image.includes('trivy')) return JSON.stringify({ Results: [] })
      return '[]'
    })

    const result = await runScannerCommands('/tmp/dsh-source', { executor })

    expect(result.osv).toEqual({ status: 'unavailable', vulnerabilities: [] })
  })
})
