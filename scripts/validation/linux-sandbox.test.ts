import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { buildLinuxSandboxPlan, summarizeSandboxExecution } from './linux-sandbox'

const target = {
  repositoryId: 1323526209,
  fullName: 'omdsh-dev/dsh-tool-calculator',
  sourceSha: '701f6549b4e1b648351403dc8a18a9bc9a2b713d',
  executionType: 'host-tool' as const,
  smokeMode: 'tool-registration' as const,
  expectedFinalStatuses: ['verified' as const],
}

const temporaryDirectories: string[] = []

function pinnedSourceWith(lockfile: 'package-lock.json' | 'npm-shrinkwrap.json' | 'pnpm-lock.yaml'): string {
  const sourceDirectory = join(tmpdir(), `dsh-lockfile-${process.pid}-${temporaryDirectories.length}`)
  mkdirSync(sourceDirectory, { recursive: true })
  writeFileSync(join(sourceDirectory, lockfile), '{}\n')
  temporaryDirectories.push(sourceDirectory)
  return sourceDirectory
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

describe('P2 restricted Linux sandbox command plan', () => {
  it('separates network acquisition from non-network execution and destroys the volume', () => {
    const plan = buildLinuxSandboxPlan(target, {
      runId: 'fixture-run',
      sourceDirectory: '/tmp/pinned-source',
      dshVersion: '0.1.0-rc.6',
      validatorVersion: '0.1.0',
    })

    expect(plan.binding).toEqual({
      repositoryId: target.repositoryId,
      sourceSha: target.sourceSha,
      dshVersion: '0.1.0-rc.6',
      platform: 'linux-x64',
      validatorVersion: '0.1.0',
    })
    expect(plan.steps.map(({ id }) => id)).toEqual([
      'create-volume',
      'copy-source',
      'install-dependencies',
      'build',
      'install-plugin',
      'load',
      'smoke',
      'postflight',
    ])
    expect(plan.cleanup.map(({ id }) => id)).toEqual(['remove-container', 'remove-volume'])

    const installDependencies = plan.steps.find(({ id }) => id === 'install-dependencies')!
    expect(installDependencies.phase).toBe('acquisition')
    expect(installDependencies.network).toBe('bridge')
    expect(installDependencies.command.args).toEqual(expect.arrayContaining(['npm', 'ci', '--ignore-scripts']))

    for (const step of plan.steps.filter(({ phase }) => phase === 'execution')) {
      expect(step.network).toBe('none')
      expect(step.command.args).toEqual(expect.arrayContaining([
        '--platform=linux/amd64',
        '--read-only',
        '--cap-drop=ALL',
        '--security-opt=no-new-privileges',
        '--pids-limit=128',
        '--memory=1g',
        '--cpus=1',
        '--user=1000:1000',
      ]))
      expect(step.command.args.join(' ')).not.toMatch(/docker\.sock|--publish|-p\s/)
      expect(step.command.args.join(' ')).not.toContain('/tmp/pinned-source')
      expect(step.timeoutMs).toBeLessThanOrEqual(120_000)
    }
  })

  it('maps deterministic stage failures without turning timeouts into plugin defects', () => {
    expect(summarizeSandboxExecution([
      { stepId: 'install-dependencies', exitCode: 0, timedOut: false },
      { stepId: 'build', exitCode: 1, timedOut: false },
    ])).toMatchObject({
      finalStatus: 'failed',
      failedStatus: 'install_failed',
      attribution: 'plugin',
      code: 'PLUGIN_BUILD_FAILED',
    })

    expect(summarizeSandboxExecution([
      { stepId: 'install-dependencies', exitCode: null, timedOut: true },
    ])).toMatchObject({
      finalStatus: 'inconclusive',
      attribution: 'infrastructure',
      code: 'SANDBOX_TIMEOUT',
    })
  })

  it.each([
    ['package-lock.json', ['npm', 'ci', '--ignore-scripts', '--no-audit', '--no-fund']],
    ['npm-shrinkwrap.json', ['npm', 'ci', '--ignore-scripts', '--no-audit', '--no-fund']],
    ['pnpm-lock.yaml', ['pnpm', 'install', '--frozen-lockfile', '--ignore-scripts']],
  ] as const)('uses the package manager pinned by %s instead of misattributing install failures', (lockfile, expectedCommand) => {
    const plan = buildLinuxSandboxPlan(target, {
      runId: `fixture-${lockfile.replaceAll('.', '-')}`,
      sourceDirectory: pinnedSourceWith(lockfile),
      dshVersion: '0.1.0-rc.6',
      validatorVersion: '0.1.0',
    })

    const installDependencies = plan.steps.find(({ id }) => id === 'install-dependencies')!
    expect(installDependencies.command.args.slice(-expectedCommand.length)).toEqual(expectedCommand)
  })
})
