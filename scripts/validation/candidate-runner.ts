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
  if (report.executionType === 'host-tool' || report.executionType === 'command') {
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
  }: {
    executeQueued: (report: ValidationReport, plan: QueuedCandidatePlan) => Promise<ValidationReport>
    onReport?: (report: ValidationReport) => Promise<void>
    now?: () => string
  },
): Promise<CandidateBatchResult> {
  const reports: ValidationReport[] = []
  for (const rawReport of rawReports) {
    const report = parseValidationReport(rawReport)
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
    reports.push(result)
    await onReport(result)
  }

  return {
    attempted: reports.length,
    verified: reports.filter(({ currentStatus }) => currentStatus === 'verified').length,
    inconclusive: reports.filter(({ currentStatus }) => currentStatus === 'inconclusive').length,
    failed: reports.filter(({ currentStatus }) => currentStatus === 'failed').length,
    reports,
  }
}
