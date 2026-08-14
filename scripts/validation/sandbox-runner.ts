import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { promisify } from 'node:util'

import {
  appendValidationEvent,
  parseValidationReport,
  type FailureAttribution,
  type ValidationReport,
} from '../../src/lib/validation-report'
import {
  summarizeSandboxExecution,
  type DockerCommand,
  type LinuxSandboxPlan,
  type SandboxExecutionSummary,
  type SandboxStepId,
  type SandboxStepResult,
} from './linux-sandbox'

const execFileAsync = promisify(execFile)

interface ExecutorResult {
  exitCode: number | null
  timedOut: boolean
  stdout: string
  stderr: string
}

type Executor = (
  command: DockerCommand,
  id: SandboxStepId | 'remove-container' | 'remove-volume',
  timeoutMs: number,
) => Promise<ExecutorResult>

export interface SandboxRunResult {
  report: ValidationReport
  summary: SandboxExecutionSummary
  results: SandboxStepResult[]
  cleanupFailures: Array<'remove-container' | 'remove-volume'>
}

async function defaultExecutor(
  command: DockerCommand,
  _id: SandboxStepId | 'remove-container' | 'remove-volume',
  timeoutMs: number,
): Promise<ExecutorResult> {
  try {
    const result = await execFileAsync(command.file, command.args, {
      encoding: 'utf8',
      timeout: timeoutMs,
      killSignal: 'SIGKILL',
      maxBuffer: 16 * 1024 * 1024,
    })
    return { exitCode: 0, timedOut: false, stdout: result.stdout, stderr: result.stderr }
  } catch (error) {
    const failure = error as Error & { code?: number | string, killed?: boolean, stdout?: string, stderr?: string }
    return {
      exitCode: typeof failure.code === 'number' ? failure.code : null,
      timedOut: failure.killed === true || failure.code === 'ETIMEDOUT',
      stdout: failure.stdout ?? '',
      stderr: failure.stderr ?? '',
    }
  }
}

function fingerprint(report: ValidationReport, code: string): string {
  return createHash('sha256')
    .update(`${report.repository.id}:${report.repository.sourceSha}:${report.target.dshVersion}:${code}`)
    .digest('hex')
}

function appendFailure(
  report: ValidationReport,
  status: 'install_failed' | 'runtime_failed' | 'smoke_failed',
  summary: SandboxExecutionSummary,
  at: string,
): ValidationReport {
  return appendValidationEvent(report, {
    stage: status === 'install_failed' ? 'installation' : status === 'runtime_failed' ? 'runtime' : 'smoke',
    status,
    at,
    code: summary.code,
    reason: summary.code,
    attribution: summary.attribution as FailureAttribution,
    fingerprint: fingerprint(report, summary.code),
  })
}

function assertBinding(report: ValidationReport, plan: LinuxSandboxPlan): void {
  if (report.currentStatus !== 'structure_passed'
    || report.repository.id !== plan.binding.repositoryId
    || report.repository.sourceSha !== plan.binding.sourceSha
    || report.target.dshVersion !== plan.binding.dshVersion
    || report.target.platform !== plan.binding.platform
    || report.target.validatorVersion !== plan.binding.validatorVersion) {
    throw new Error('Sandbox report binding does not match the command plan')
  }
}

export async function executeLinuxSandboxPlan(
  structureReport: ValidationReport,
  plan: LinuxSandboxPlan,
  {
    executor = defaultExecutor,
    now = () => new Date().toISOString(),
  }: { executor?: Executor, now?: () => string } = {},
): Promise<SandboxRunResult> {
  assertBinding(structureReport, plan)
  let report = appendValidationEvent(structureReport, {
    stage: 'sandbox',
    status: 'queued',
    at: now(),
  })
  report = appendValidationEvent(report, {
    stage: 'sandbox',
    status: 'running',
    at: now(),
  })

  const results: SandboxStepResult[] = []
  const cleanupFailures: SandboxRunResult['cleanupFailures'] = []
  try {
    for (const step of plan.steps) {
      const execution = await executor(step.command, step.id, step.timeoutMs)
      results.push({ stepId: step.id, exitCode: execution.exitCode, timedOut: execution.timedOut })
      if (execution.timedOut || execution.exitCode !== 0) break

      if (step.id === 'install-plugin') {
        report = appendValidationEvent(report, { stage: 'installation', status: 'install_passed', at: now() })
      } else if (step.id === 'load') {
        report = appendValidationEvent(report, { stage: 'runtime', status: 'runtime_passed', at: now() })
      } else if (step.id === 'postflight') {
        report = appendValidationEvent(report, { stage: 'smoke', status: 'smoke_passed', at: now() })
      }
    }

    const summary = summarizeSandboxExecution(results)
    if (summary.finalStatus === 'verified') {
      report = appendValidationEvent(report, { stage: 'final', status: 'verified', at: now() })
    } else if (summary.finalStatus === 'inconclusive') {
      report = appendValidationEvent(report, {
        stage: 'sandbox',
        status: 'inconclusive',
        at: now(),
        code: summary.code,
        reason: summary.code,
        attribution: summary.attribution,
      })
    } else {
      report = appendFailure(report, summary.failedStatus!, summary, now())
      report = appendValidationEvent(report, {
        stage: 'final',
        status: 'failed',
        at: now(),
        code: summary.code,
        reason: summary.code,
        attribution: summary.attribution,
        fingerprint: fingerprint(report, summary.code),
      })
    }
    return { report: parseValidationReport(report), summary, results, cleanupFailures }
  } finally {
    for (const cleanup of plan.cleanup) {
      const execution = await executor(cleanup.command, cleanup.id, 30_000)
      if (execution.exitCode !== 0 && cleanup.id === 'remove-volume') cleanupFailures.push(cleanup.id)
    }
  }
}
