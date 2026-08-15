import {
  appendValidationEvent,
  parseValidationReport,
  type ValidationReport,
} from '../../src/lib/validation-report'
import { routeValidator } from './validator-router'

interface QueuedCandidatePlan {
  disposition: 'queue'
  validator: 'linux-headless'
  smokeMode: 'loader'
}

interface InconclusiveCandidatePlan {
  disposition: 'inconclusive'
  validator: string
  code: string
}

interface SkippedCandidatePlan {
  disposition: 'skip'
  validator: string
  code: string
}

export type CandidatePlan = QueuedCandidatePlan | InconclusiveCandidatePlan | SkippedCandidatePlan

export interface CandidateBatchResult {
  attempted: number
  verified: number
  inconclusive: number
  failed: number
  reports: ValidationReport[]
}

export function planCandidate(rawReport: ValidationReport): CandidatePlan {
  const report = parseValidationReport(rawReport)
  if (report.currentStatus !== 'structure_passed' || report.executionType === null) {
    return { disposition: 'skip', validator: 'none', code: 'STRUCTURE_NOT_PASSED' }
  }
  if (report.structureChecks.some(({ code }) => code === 'EXTERNAL_CREDENTIALS_REQUIRED')) {
    return {
      disposition: 'inconclusive',
      validator: 'linux-headless',
      code: 'EXTERNAL_CREDENTIALS_REQUIRED',
    }
  }

  const route = routeValidator(report.executionType)
  if (report.executionType === 'host-tool'
    || report.executionType === 'command'
    || report.executionType === 'web'
    || report.executionType === 'channel-mcp'
    || report.executionType === 'skill') {
    return { disposition: 'queue', validator: 'linux-headless', smokeMode: 'loader' }
  }
  if (route.disposition === 'inconclusive') {
    return {
      disposition: 'inconclusive',
      validator: route.validator,
      code: route.code ?? 'VALIDATOR_CONTRACT_REQUIRED',
    }
  }
  if (route.disposition === 'not-applicable') {
    return { disposition: 'skip', validator: route.validator, code: 'PLUGIN_VALIDATION_NOT_APPLICABLE' }
  }
  return {
    disposition: 'inconclusive',
    validator: route.validator,
    code: `${report.executionType.toUpperCase().replaceAll('-', '_')}_VALIDATOR_REQUIRED`,
  }
}

export function needsLinuxValidatorImage(rawReports: ValidationReport[]): boolean {
  return rawReports.some((report) => {
    const plan = planCandidate(report)
    return plan.disposition === 'queue' && plan.validator === 'linux-headless'
  })
}

function markInconclusive(
  structureReport: ValidationReport,
  code: string,
  attribution: 'infrastructure' | 'inconclusive',
  now: () => string,
): ValidationReport {
  let report = appendValidationEvent(structureReport, {
    stage: 'sandbox',
    status: 'queued',
    at: now(),
  })
  report = appendValidationEvent(report, {
    stage: 'sandbox',
    status: 'inconclusive',
    at: now(),
    code,
    reason: code,
    attribution,
  })
  return report
}

export async function runCandidateBatch(
  rawReports: ValidationReport[],
  {
    executeQueued,
    onReport = async () => {},
    now = () => new Date().toISOString(),
    concurrency = 1,
  }: {
    executeQueued: (report: ValidationReport, plan: QueuedCandidatePlan) => Promise<ValidationReport>
    onReport?: (report: ValidationReport) => Promise<void>
    now?: () => string
    concurrency?: number
  },
): Promise<CandidateBatchResult> {
  const reports = new Array<ValidationReport>(rawReports.length)
  const requestedConcurrency = concurrency ?? 1
  if (!Number.isSafeInteger(requestedConcurrency) || requestedConcurrency < 1) {
    throw new Error('Candidate concurrency must be a positive integer')
  }
  let nextIndex = 0
  async function runWorker(): Promise<void> {
    while (true) {
      const index = nextIndex
      nextIndex += 1
      if (index >= rawReports.length) return
      const report = parseValidationReport(rawReports[index])
      const plan = planCandidate(report)
      let result = report
      if (plan.disposition === 'queue') {
        try {
          result = parseValidationReport(await executeQueued(report, plan))
        } catch {
          result = markInconclusive(report, 'CANDIDATE_INFRASTRUCTURE_FAILED', 'infrastructure', now)
        }
      } else if (plan.disposition === 'inconclusive') {
        result = markInconclusive(report, plan.code, 'inconclusive', now)
      }
      reports[index] = result
      try {
        await onReport(result)
      } catch {
        // A report persistence failure is isolated to this repository; the shard
        // continues so the archive can mark the missing observation for retry.
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(requestedConcurrency, rawReports.length) }, () => runWorker()))

  return {
    attempted: reports.length,
    verified: reports.filter(({ currentStatus }) => currentStatus === 'verified').length,
    inconclusive: reports.filter(({ currentStatus }) => currentStatus === 'inconclusive').length,
    failed: reports.filter(({ currentStatus }) => currentStatus === 'failed').length,
    reports,
  }
}
