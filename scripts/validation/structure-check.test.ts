import { describe, expect, it } from 'vitest'

import {
  inferExecutionType,
  runStructureCheck,
  type RepositoryStructureSnapshot,
} from './structure-check'

const validScans = {
  trivy: { status: 'passed' as const, vulnerabilities: [], secrets: [] },
  osv: { status: 'passed' as const, vulnerabilities: [] },
}

const hostToolSnapshot: RepositoryStructureSnapshot = {
  repository: {
    id: 1001,
    fullName: 'example/dsh-tool-json',
    url: 'https://github.com/example/dsh-tool-json',
    sourceSha: 'a'.repeat(40),
    sourcePushedAt: '2026-08-14T08:00:00Z',
    isPrivate: false,
    archived: false,
    deleted: false,
    sizeKb: 120,
  },
  projectType: 'plugin',
  topics: ['dsh-plugin', 'tool'],
  files: {
    'package.json': JSON.stringify({
      name: '@example/dsh-tool-json',
      version: '1.0.0',
      type: 'module',
      main: './lib/index.js',
      exports: {
        '.': './lib/index.js',
        './package.json': './package.json',
      },
      files: ['lib', 'cordis.patch.yml', 'LICENSE'],
      dsh: { bundle: { patch: './cordis.patch.yml' } },
      license: 'MIT',
    }),
    'lib/index.js': 'export default function plugin() {}',
    'cordis.patch.yml': '- insert:\n    - id: json-tool\n      name: "@example/dsh-tool-json"\n',
    'pnpm-lock.yaml': 'lockfileVersion: 9\n',
    'LICENSE': 'MIT License',
  },
  scans: validScans,
}

describe('execution type recognition', () => {
  it.each([
    ['plugin', { dsh: { bundle: { patch: './cordis.patch.yml' } } }, [], 'host-tool'],
    ['plugin', { dsh: { bundle: { patch: './cordis.patch.yml' }, client: { platform: 'web' } } }, [], 'web'],
    ['plugin', { bin: { example: './bin/example.mjs' } }, [], 'command'],
    ['channel', { bin: { bot: './bin/bot.mjs' } }, [], 'channel-mcp'],
    ['skill', {}, [], 'skill'],
    ['collection', {}, [], 'collection'],
    ['application', {}, [], 'non-plugin'],
    ['plugin', { os: ['win32'] }, [], 'native'],
    ['plugin', {}, ['mcp-server'], 'channel-mcp'],
  ])('routes %s with manifest signals to %s', (projectType, manifest, topics, expected) => {
    expect(inferExecutionType({
      projectType: projectType as RepositoryStructureSnapshot['projectType'],
      manifest,
      topics,
    })).toBe(expected)
  })
})

describe('shadow structure check', () => {
  it('stops unknown projects at unrecognized without manufacturing a plugin failure', () => {
    const result = runStructureCheck({
      ...hostToolSnapshot,
      projectType: 'unknown',
      files: {},
    }, {
      now: '2026-08-14T08:10:00Z',
      dshVersion: '0.1.0-rc.6',
      nodeVersion: '22.19.0',
      validatorVersion: '1.0.0',
      platform: 'linux-x64',
    })

    expect(result).toMatchObject({
      decision: 'inconclusive',
      queueSandbox: false,
      report: {
        currentStatus: 'unrecognized',
        failure: null,
      },
    })
  })

  it('passes a pinned host/tool package without executing source code', () => {
    const result = runStructureCheck(hostToolSnapshot, {
      now: '2026-08-14T08:10:00Z',
      dshVersion: '0.1.0-rc.6',
      nodeVersion: '22.19.0',
      validatorVersion: '1.0.0',
      platform: 'linux-x64',
    })

    expect(result.decision).toBe('passed')
    expect(result.report).toMatchObject({
      mode: 'shadow',
      executionType: 'host-tool',
      currentStatus: 'structure_passed',
      failure: null,
    })
    expect(result.report.structureChecks).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'REPOSITORY_PINNED', status: 'passed' }),
      expect.objectContaining({ code: 'DSH_BUNDLE_PATCH_VALID', status: 'passed' }),
      expect.objectContaining({ code: 'PACKAGE_ENTRYPOINTS_VALID', status: 'passed' }),
      expect.objectContaining({ code: 'TRIVY_SCAN_CLEAN', status: 'passed' }),
      expect.objectContaining({ code: 'OSV_SCAN_CLEAN', status: 'passed' }),
    ]))
  })

  it('fails missing package entrypoints before sandbox execution', () => {
    const snapshot = {
      ...hostToolSnapshot,
      files: {
        ...hostToolSnapshot.files,
        'package.json': JSON.stringify({
          name: '@example/broken',
          version: '1.0.0',
          main: './dist/missing.js',
          dsh: { bundle: { patch: './cordis.patch.yml' } },
        }),
        'lib/index.js': undefined,
      },
    }
    const result = runStructureCheck(snapshot, {
      now: '2026-08-14T08:10:00Z',
      dshVersion: '0.1.0-rc.6',
      nodeVersion: '22.19.0',
      validatorVersion: '1.0.0',
      platform: 'linux-x64',
    })

    expect(result.decision).toBe('failed')
    expect(result.report).toMatchObject({
      currentStatus: 'structure_failed',
      failure: {
        attribution: 'plugin',
        code: 'PACKAGE_ENTRYPOINT_MISSING',
      },
    })
  })

  it('accepts a declared bare relative main entrypoint when the pinned Git tree contains it', () => {
    const manifest = JSON.parse(hostToolSnapshot.files['package.json'] as string)
    manifest.main = 'index.js'
    delete manifest.exports
    const result = runStructureCheck({
      ...hostToolSnapshot,
      files: {
        ...hostToolSnapshot.files,
        'package.json': JSON.stringify(manifest),
        'lib/index.js': undefined,
        'index.js': '',
      },
    }, {
      now: '2026-08-14T08:10:00Z',
      dshVersion: '0.1.0-rc.6',
      nodeVersion: '22.19.0',
      validatorVersion: '1.0.0',
      platform: 'linux-x64',
    })

    expect(result.decision).toBe('passed')
    expect(result.report.structureChecks).toContainEqual(expect.objectContaining({
      code: 'PACKAGE_ENTRYPOINTS_VALID',
      status: 'passed',
    }))
  })

  it('records a private package registry as an external credential requirement without executing it', () => {
    const result = runStructureCheck({
      ...hostToolSnapshot,
      files: {
        ...hostToolSnapshot.files,
        '.npmrc': '@dsh-external:registry=https://npm.pkg.github.com/\n',
      },
    }, {
      now: '2026-08-14T08:10:00Z',
      dshVersion: '0.1.0-rc.6',
      nodeVersion: '22.19.0',
      validatorVersion: '1.0.0',
      platform: 'linux-x64',
    })

    expect(result.decision).toBe('passed')
    expect(result.report.structureChecks).toContainEqual(expect.objectContaining({
      code: 'EXTERNAL_CREDENTIALS_REQUIRED',
      status: 'warning',
    }))
  })

  it('records prepare as a build requirement instead of running it', () => {
    const manifest = JSON.parse(hostToolSnapshot.files['package.json'] as string)
    manifest.scripts = { prepare: 'npm run build', build: 'tsc' }
    manifest.main = './dist/index.js'
    const result = runStructureCheck({
      ...hostToolSnapshot,
      files: {
        ...hostToolSnapshot.files,
        'package.json': JSON.stringify(manifest),
        'lib/index.js': undefined,
      },
    }, {
      now: '2026-08-14T08:10:00Z',
      dshVersion: '0.1.0-rc.6',
      nodeVersion: '22.19.0',
      validatorVersion: '1.0.0',
      platform: 'linux-x64',
    })

    expect(result.decision).toBe('passed')
    expect(result.report.structureChecks).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'BUILD_ARTIFACT_REQUIRES_BUILD', status: 'warning' }),
      expect.objectContaining({ code: 'PREPARE_SCRIPT_DECLARED', status: 'warning' }),
    ]))
  })

  it('quarantines secret findings without publishing a malicious-code accusation', () => {
    const result = runStructureCheck({
      ...hostToolSnapshot,
      scans: {
        ...validScans,
        trivy: {
          status: 'findings',
          vulnerabilities: [],
          secrets: [{ ruleId: 'github-pat', path: 'fixture.txt' }],
        },
      },
    }, {
      now: '2026-08-14T08:10:00Z',
      dshVersion: '0.1.0-rc.6',
      nodeVersion: '22.19.0',
      validatorVersion: '1.0.0',
      platform: 'linux-x64',
    })

    expect(result.decision).toBe('quarantined')
    expect(result.publicReason).toBe('需要人工安全复核')
    expect(result.report.failure).toMatchObject({
      attribution: 'policy',
      code: 'SECURITY_REVIEW_REQUIRED',
    })
    expect(JSON.stringify(result)).not.toContain('github-pat')
  })

  it('attributes unavailable scanners to infrastructure and blocks sandbox queueing', () => {
    const result = runStructureCheck({
      ...hostToolSnapshot,
      scans: {
        trivy: { status: 'unavailable', vulnerabilities: [], secrets: [] },
        osv: { status: 'unavailable', vulnerabilities: [] },
      },
    }, {
      now: '2026-08-14T08:10:00Z',
      dshVersion: '0.1.0-rc.6',
      nodeVersion: '22.19.0',
      validatorVersion: '1.0.0',
      platform: 'linux-x64',
    })

    expect(result.decision).toBe('inconclusive')
    expect(result.queueSandbox).toBe(false)
    expect(result.report.failure).toMatchObject({
      attribution: 'infrastructure',
      code: 'SCANNER_UNAVAILABLE',
    })
  })
})
