import {
  parseSourceClassificationArchive,
  resolveSourceValidationDisposition,
  type SourceClassificationArchive,
  type SourceValidationResult,
} from '../../src/lib/source-classification-archive'
import { parseValidationReport, type ValidationReport } from '../../src/lib/validation-report'
import type { ValidationSelection } from './validation-state'

export interface ValidationArchiveMergeResult {
  archive: SourceClassificationArchive
  verified: number[]
  autoFailed: number[]
  retryable: number[]
  manualReview: number[]
}

function reportTime(report: ValidationReport): number {
  return Date.parse(report.completedAt ?? report.startedAt)
}

function latestReports(reports: readonly ValidationReport[]): Map<number, ValidationReport> {
  const latest = new Map<number, ValidationReport>()
  const terminalStatuses = new Set(['unrecognized', 'structure_failed', 'inconclusive', 'failed', 'verified'])
  for (const report of reports.map(parseValidationReport).filter(({ currentStatus }) => terminalStatuses.has(currentStatus))) {
    const current = latest.get(report.repository.id)
    if (!current
      || reportTime(report) > reportTime(current)
      || (reportTime(report) === reportTime(current) && report.events.length > current.events.length)) {
      latest.set(report.repository.id, report)
    }
  }
  return latest
}

function resultFromReport(report: ValidationReport, fallbackCheckedAt: string): SourceValidationResult {
  const status: SourceValidationResult['status'] = report.currentStatus === 'verified'
    ? 'passed'
    : report.currentStatus === 'inconclusive'
      ? 'inconclusive'
      : 'failed'
  const errorCode = report.failure?.code ?? report.events.at(-1)?.code
  const attribution = report.failure?.attribution ?? report.events.at(-1)?.attribution
  const durationMs = report.completedAt === null
    ? undefined
    : Math.max(0, Date.parse(report.completedAt) - Date.parse(report.startedAt))
  const disposition: SourceValidationResult['disposition'] = resolveSourceValidationDisposition({
    status,
    attribution,
    errorCode,
  })
  return {
    status,
    disposition,
    stage: report.events.some(({ status }) => status === 'structure_failed')
      && !report.events.some(({ status }) => ['queued', 'running', 'install_passed', 'install_failed', 'runtime_passed', 'runtime_failed', 'smoke_passed', 'smoke_failed'].includes(status))
      ? 'structure'
      : 'sandbox',
    sourceSha: report.repository.sourceSha,
    checkedAt: report.completedAt ?? fallbackCheckedAt,
    dshVersion: report.target.dshVersion,
    platform: report.target.platform,
    validatorVersion: report.target.validatorVersion,
    executionType: report.executionType,
    ...(durationMs === undefined ? {} : { durationMs }),
    ...(errorCode ? { errorCode } : {}),
    ...(attribution ? { attribution } : {}),
  }
}

function missingResult(selection: ValidationSelection, checkedAt: string): SourceValidationResult {
  return {
    status: 'inconclusive',
    disposition: 'retryable',
    stage: 'sandbox',
    sourceSha: null,
    checkedAt,
    dshVersion: selection.target.dshVersion,
    platform: selection.target.platform,
    validatorVersion: selection.target.validatorVersion,
    executionType: null,
    errorCode: 'VALIDATION_NOT_OBSERVED',
    attribution: 'infrastructure',
  }
}

export function buildValidationArchive(
  rawArchive: SourceClassificationArchive,
  selection: ValidationSelection,
  rawReports: readonly ValidationReport[],
  generatedAt: string,
): ValidationArchiveMergeResult {
  const archive = parseSourceClassificationArchive(rawArchive)
  const reports = latestReports(rawReports)
  const byId = new Map(archive.records.map((record) => [record.repositoryId, record]))
  const verified: number[] = []
  const autoFailed: number[] = []
  const retryable: number[] = []
  const manualReview: number[] = []

  for (const repositoryId of selection.repositoryIds) {
    const record = byId.get(repositoryId)
    const report = reports.get(repositoryId)
    if (!record) {
      retryable.push(repositoryId)
      continue
    }
    const matchingReport = report
      && report.repository.sourcePushedAt === record.sourcePushedAt
      && report.repository.sourceSha === record.sourceSha
      ? report
      : undefined
    const validation = matchingReport
      ? resultFromReport(matchingReport, generatedAt)
      : missingResult(selection, generatedAt)
    record.validation = validation
    if (validation.disposition === 'verified') verified.push(repositoryId)
    else if (validation.disposition === 'auto_failed') autoFailed.push(repositoryId)
    else if (validation.disposition === 'retryable') retryable.push(repositoryId)
    else manualReview.push(repositoryId)
  }

  return {
    archive: parseSourceClassificationArchive({
      ...archive,
      generatedAt,
      records: archive.records.map((record) => ({ ...record })),
    }),
    verified: verified.sort((a, b) => a - b),
    autoFailed: [...new Set(autoFailed)].sort((a, b) => a - b),
    retryable: [...new Set(retryable)].sort((a, b) => a - b),
    manualReview: [...new Set(manualReview)].sort((a, b) => a - b),
  }
}

export function selectedRepositoryIds(selection: ValidationSelection): ReadonlySet<number> {
  return new Set(selection.repositoryIds)
}
