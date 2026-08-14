import { existsSync } from 'node:fs'
import { join } from 'node:path'

import type { ValidationBinding, ValidationStatus } from '../../src/lib/validation-report'

export interface LinuxSandboxTarget {
  repositoryId: number
  sourceSha: string
  smokeMode: 'loader' | 'tool-registration'
}

export type SandboxStepId =
  | 'create-volume'
  | 'copy-source'
  | 'install-dependencies'
  | 'build'
  | 'install-plugin'
  | 'load'
  | 'smoke'
  | 'postflight'

export interface DockerCommand {
  file: 'docker'
  args: string[]
}

export interface SandboxStep {
  id: SandboxStepId
  phase: 'setup' | 'acquisition' | 'execution'
  network: 'none' | 'bridge'
  timeoutMs: number
  command: DockerCommand
}

export interface LinuxSandboxPlan {
  binding: ValidationBinding
  containerName: string
  volumeName: string
  steps: SandboxStep[]
  cleanup: Array<{ id: 'remove-container' | 'remove-volume', command: DockerCommand }>
}

export interface SandboxStepResult {
  stepId: SandboxStepId
  exitCode: number | null
  timedOut: boolean
}

export interface SandboxExecutionSummary {
  finalStatus: Extract<ValidationStatus, 'verified' | 'failed' | 'inconclusive'>
  failedStatus?: Extract<ValidationStatus, 'install_failed' | 'runtime_failed' | 'smoke_failed'>
  attribution: 'plugin' | 'infrastructure' | 'policy'
  code: string
}

const VALIDATOR_IMAGE = 'dsh-plugin-validator:0.1.0'

function dependencyInstallCommand(sourceDirectory: string): string[] {
  if (existsSync(join(sourceDirectory, 'package-lock.json'))
    || existsSync(join(sourceDirectory, 'npm-shrinkwrap.json'))) {
    return ['npm', 'ci', '--ignore-scripts', '--no-audit', '--no-fund']
  }
  if (existsSync(join(sourceDirectory, 'pnpm-lock.yaml'))) {
    return ['pnpm', 'install', '--frozen-lockfile', '--ignore-scripts']
  }
  return ['npm', 'ci', '--ignore-scripts', '--no-audit', '--no-fund']
}

function runArgs({
  containerName,
  volumeName,
  network,
  sourceDirectory,
  image,
  command,
}: {
  containerName: string
  volumeName: string
  network: 'none' | 'bridge'
  sourceDirectory?: string
  image: string
  command: string[]
}): string[] {
  return [
    'run', '--rm', '--name', containerName, '--platform=linux/amd64',
    `--network=${network}`,
    '--read-only', '--cap-drop=ALL', '--security-opt=no-new-privileges',
    '--pids-limit=128', '--memory=1g', '--cpus=1', '--user=1000:1000',
    '--tmpfs=/tmp:rw,noexec,nosuid,size=128m',
    '--mount', `type=volume,src=${volumeName},dst=/validation`,
    ...(sourceDirectory ? ['--mount', `type=bind,src=${sourceDirectory},dst=/source,readonly`] : []),
    '--env=HOME=/validation/home', '--env=DSH_HOME=/validation/dsh-home', '--env=CI=1',
    '--workdir=/validation/workspace/plugin',
    image,
    ...command,
  ]
}

export function buildLinuxSandboxPlan(
  target: LinuxSandboxTarget,
  {
    runId,
    sourceDirectory,
    dshVersion,
    validatorVersion,
    validatorImage = VALIDATOR_IMAGE,
  }: {
    runId: string
    sourceDirectory: string
    dshVersion: string
    validatorVersion: string
    validatorImage?: string
  },
): LinuxSandboxPlan {
  if (!/^[a-zA-Z0-9_.-]+$/.test(runId)) throw new Error('Sandbox runId is invalid')
  const resourceName = `dsh-validate-${target.repositoryId}-${target.sourceSha.slice(0, 12)}-${runId}`.toLowerCase()
  const makeStep = (
    id: SandboxStepId,
    phase: SandboxStep['phase'],
    network: SandboxStep['network'],
    command: string[],
    source?: string,
  ): SandboxStep => ({
    id,
    phase,
    network,
    timeoutMs: id === 'install-dependencies' ? 120_000 : 60_000,
    command: {
      file: 'docker',
      args: runArgs({
        containerName: resourceName,
        volumeName: resourceName,
        network,
        sourceDirectory: source,
        image: validatorImage,
        command,
      }),
    },
  })

  return {
    binding: {
      repositoryId: target.repositoryId,
      sourceSha: target.sourceSha,
      dshVersion,
      platform: 'linux-x64',
      validatorVersion,
    },
    containerName: resourceName,
    volumeName: resourceName,
    steps: [
      {
        id: 'create-volume',
        phase: 'setup',
        network: 'none',
        timeoutMs: 30_000,
        command: { file: 'docker', args: ['volume', 'create', resourceName] },
      },
      makeStep('copy-source', 'acquisition', 'none', ['node', '/validator/copy-source.mjs', '/source', '/validation/workspace/plugin'], sourceDirectory),
      makeStep('install-dependencies', 'acquisition', 'bridge', dependencyInstallCommand(sourceDirectory)),
      makeStep('build', 'execution', 'none', ['npm', 'run', 'build', '--if-present']),
      makeStep('install-plugin', 'execution', 'none', ['dsh', 'plugin', '--profile', 'validation', 'add', '--ignore-scripts', 'file:/validation/workspace/plugin']),
      makeStep('load', 'execution', 'none', ['dsh', '--profile', 'validation', '--dump-config']),
      makeStep('smoke', 'execution', 'none', ['node', '/validator/host-tool-smoke.mjs', '/validation/workspace/plugin', target.smokeMode]),
      makeStep('postflight', 'execution', 'none', ['node', '/validator/postflight.mjs', '/validation']),
    ],
    cleanup: [
      { id: 'remove-container', command: { file: 'docker', args: ['rm', '--force', resourceName] } },
      { id: 'remove-volume', command: { file: 'docker', args: ['volume', 'rm', '--force', resourceName] } },
    ],
  }
}

export function summarizeSandboxExecution(results: SandboxStepResult[]): SandboxExecutionSummary {
  const failed = results.find((result) => result.timedOut || result.exitCode !== 0)
  if (!failed) return { finalStatus: 'verified', attribution: 'plugin', code: 'SANDBOX_PASSED' }
  if (failed.timedOut) {
    return { finalStatus: 'inconclusive', attribution: 'infrastructure', code: 'SANDBOX_TIMEOUT' }
  }
  if (failed.stepId === 'create-volume' || failed.stepId === 'copy-source') {
    return { finalStatus: 'inconclusive', attribution: 'infrastructure', code: 'SANDBOX_INFRASTRUCTURE_FAILED' }
  }
  if (failed.stepId === 'install-dependencies') {
    return { finalStatus: 'failed', failedStatus: 'install_failed', attribution: 'plugin', code: 'DEPENDENCY_INSTALL_FAILED' }
  }
  if (failed.stepId === 'build') {
    return { finalStatus: 'failed', failedStatus: 'install_failed', attribution: 'plugin', code: 'PLUGIN_BUILD_FAILED' }
  }
  if (failed.stepId === 'install-plugin') {
    return { finalStatus: 'failed', failedStatus: 'install_failed', attribution: 'plugin', code: 'PLUGIN_INSTALL_FAILED' }
  }
  if (failed.stepId === 'load') {
    return { finalStatus: 'failed', failedStatus: 'runtime_failed', attribution: 'plugin', code: 'PLUGIN_LOAD_FAILED' }
  }
  if (failed.stepId === 'postflight') {
    return { finalStatus: 'failed', failedStatus: 'smoke_failed', attribution: 'policy', code: 'SANDBOX_POSTFLIGHT_FAILED' }
  }
  return { finalStatus: 'failed', failedStatus: 'smoke_failed', attribution: 'plugin', code: 'PLUGIN_SMOKE_FAILED' }
}
