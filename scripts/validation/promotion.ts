import { parseValidationReport, type ValidationReport } from '../../src/lib/validation-report'
import { parseValidationFeed, type ValidationFeed, type ValidationRecord } from '../../src/lib/validation'
import type { BaselineTarget, ValidationBaseline } from './baseline'

export const MINIMUM_BASELINE_TARGETS = 20

export type PromotionBlockReason =
  | 'BASELINE_TARGET_COUNT_INSUFFICIENT'
  | 'BASELINE_COVERAGE_INSUFFICIENT'
  | 'EVIDENCE_BINDING_MISMATCH'
  | 'BASELINE_OUTCOME_INCONSISTENT'
  | 'BASELINE_OUTCOME_UNEXPECTED'

export interface PromotionAssessment {
  eligible: boolean
  reasons: PromotionBlockReason[]
  metrics: {
    configuredTargets: number
    observedTargets: number
    inconsistentTargets: number
    unexpectedReports: number
    mismatchedReports: number
    unexpectedOutcomeRate: number
  }
}

const TERMINAL_OBSERVATIONS = new Set(['verified', 'failed', 'inconclusive', 'structure_failed'])

function isTerminalObservation(report: ValidationReport): boolean {
  return TERMINAL_OBSERVATIONS.has(report.currentStatus)
}

function matchesBaselineBinding(
  report: ValidationReport,
  baseline: ValidationBaseline,
  target: BaselineTarget,
): boolean {
  return report.repository.id === target.repositoryId
    && report.repository.fullName.toLowerCase() === target.fullName.toLowerCase()
    && report.repository.sourceSha === target.sourceSha
    && report.executionType === target.executionType
    && report.validationKind === 'linux-headless'
    && report.target.dshVersion === baseline.dshVersion
    && report.target.platform === baseline.platform
    && report.target.validatorVersion === baseline.validatorVersion
}

function uniqueFreshReports(reports: ValidationReport[]): ValidationReport[] {
  const reportIds = new Set<string>()
  const startedTimes = new Set<string>()
  return [...reports]
    .sort((left, right) => Date.parse(left.startedAt) - Date.parse(right.startedAt))
    .filter((report) => {
      if (reportIds.has(report.reportId) || startedTimes.has(report.startedAt)) return false
      reportIds.add(report.reportId)
      startedTimes.add(report.startedAt)
      return true
    })
}

export function assessPromotionGate(
  baseline: ValidationBaseline,
  rawReports: ValidationReport[],
): PromotionAssessment {
  const reports = rawReports.map(parseValidationReport)
  let observedTargets = 0
  let inconsistentTargets = 0
  let unexpectedReports = 0
  let mismatchedReports = 0
  let exactObservedReports = 0

  for (const target of baseline.targets) {
    const repositoryReports = reports.filter((report) => (
      report.repository.id === target.repositoryId && isTerminalObservation(report)
    ))
    const exactBindingReports = repositoryReports.filter((report) => (
      matchesBaselineBinding(report, baseline, target)
    ))
    const exact = uniqueFreshReports(exactBindingReports)
    mismatchedReports += repositoryReports.length - exactBindingReports.length
    exactObservedReports += exact.length
    if (exact.length > 0) observedTargets += 1

    const outcomes = new Set(exact.map(({ currentStatus }) => currentStatus))
    if (outcomes.size > 1) inconsistentTargets += 1
    unexpectedReports += exact.filter((report) => (
      !target.expectedFinalStatuses.includes(
        report.currentStatus as BaselineTarget['expectedFinalStatuses'][number],
      )
    )).length
  }

  const reasons: PromotionBlockReason[] = []
  if (baseline.targets.length < MINIMUM_BASELINE_TARGETS) reasons.push('BASELINE_TARGET_COUNT_INSUFFICIENT')
  if (observedTargets < baseline.targets.length) reasons.push('BASELINE_COVERAGE_INSUFFICIENT')
  if (mismatchedReports > 0) reasons.push('EVIDENCE_BINDING_MISMATCH')
  if (inconsistentTargets > 0) reasons.push('BASELINE_OUTCOME_INCONSISTENT')
  if (unexpectedReports > 0) reasons.push('BASELINE_OUTCOME_UNEXPECTED')

  return {
    eligible: reasons.length === 0,
    reasons,
    metrics: {
      configuredTargets: baseline.targets.length,
      observedTargets,
      inconsistentTargets,
      unexpectedReports,
      mismatchedReports,
      unexpectedOutcomeRate: exactObservedReports === 0 ? 0 : unexpectedReports / exactObservedReports,
    },
  }
}

function eventTime(report: ValidationReport, status: string): string | undefined {
  return report.events.find((event) => event.status === status)?.at
}

function observationTime(report: ValidationReport): number {
  return Date.parse(report.completedAt ?? report.startedAt)
}

function publicRecord(report: ValidationReport): ValidationRecord {
  const reportUrl = report.artifacts.find(({ kind }) => kind === 'report')?.url
  return {
    repositoryId: report.repository.id,
    sourceSha: report.repository.sourceSha,
    sourcePushedAt: report.repository.sourcePushedAt,
    updatedAt: report.completedAt ?? report.startedAt,
    dshVersion: report.target.dshVersion,
    platform: report.target.platform,
    validatorVersion: report.target.validatorVersion,
    structure: {
      status: 'passed',
      ...(eventTime(report, 'structure_passed') ? { checkedAt: eventTime(report, 'structure_passed') } : {}),
    },
    sandbox: {
      status: 'passed',
      ...(report.completedAt ? { checkedAt: report.completedAt } : {}),
      ...(reportUrl ? { reportUrl } : {}),
    },
  }
}

export function buildPublicValidationFeed(
  baseline: ValidationBaseline,
  rawReports: ValidationReport[],
  generatedAt: string,
  gateReports: ValidationReport[] = rawReports,
): ValidationFeed {
  const assessment = assessPromotionGate(baseline, gateReports)
  if (!assessment.eligible) throw new Error(`P4 质量门禁未通过：${assessment.reasons.join(', ')}`)
  const reports = rawReports.map(parseValidationReport).filter((report) => (
    report.target.dshVersion === baseline.dshVersion
    && report.target.platform === baseline.platform
    && report.target.validatorVersion === baseline.validatorVersion
    && isTerminalObservation(report)
  ))
  const latestByRepository = new Map<number, ValidationReport>()
  for (const report of reports) {
    const current = latestByRepository.get(report.repository.id)
    if (!current
      || observationTime(report) > observationTime(current)
      || (observationTime(report) === observationTime(current) && report.reportId > current.reportId)) {
      latestByRepository.set(report.repository.id, report)
    }
  }

  const records: ValidationRecord[] = [...latestByRepository.values()]
    .filter(({ currentStatus }) => currentStatus === 'verified')
    .map(publicRecord)

  return {
    schemaVersion: 1,
    generatedAt,
    records: records.sort((left, right) => left.repositoryId - right.repositoryId),
  }
}

export function mergeValidationFeeds(
  previous: ValidationFeed,
  current: ValidationFeed,
): ValidationFeed {
  const records = parseValidationFeed(previous)
  for (const [repositoryId, record] of parseValidationFeed(current)) records.set(repositoryId, record)
  return {
    schemaVersion: 1,
    generatedAt: current.generatedAt,
    records: [...records.values()].sort((left, right) => left.repositoryId - right.repositoryId),
  }
}
