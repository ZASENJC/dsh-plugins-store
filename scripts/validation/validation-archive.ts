import {
  parseSourceClassificationArchive,
  type SourceClassificationArchive,
  type SourceValidationResult,
} from '../../src/lib/source-classification-archive'
import { parseValidationReport, type ValidationReport } from '../../src/lib/validation-report'
import type { ValidationSelection } from './validation-state'

export interface ValidationArchiveMergeResult {
  archive: SourceClassificationArchive
  verified: number[]
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
  const durationMs = report.completedAt === null
    ? undefined
    : Math.max(0, Date.parse(report.completedAt) - Date.parse(report.startedAt))
  return {
    status,
    disposition: status === 'passed' ? 'verified' : 'manual_review',
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
    ...(report.failure?.attribution ? { attribution: report.failure.attribution } : {}),
  }
}

function missingResult(selection: ValidationSelection, checkedAt: string): SourceValidationResult {
  return {
    status: 'inconclusive',
    disposition: 'manual_review',
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
  const manualReview: number[] = []

  for (const repositoryId of selection.repositoryIds) {
    const record = byId.get(repositoryId)
    const report = reports.get(repositoryId)
    if (!record) {
      manualReview.push(repositoryId)
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
    if (validation.status === 'passed') verified.push(repositoryId)
    else manualReview.push(repositoryId)
  }

  return {
    archive: parseSourceClassificationArchive({
      ...archive,
      generatedAt,
      records: archive.records.map((record) => ({ ...record })),
    }),
    verified: verified.sort((a, b) => a - b),
    manualReview: [...new Set(manualReview)].sort((a, b) => a - b),
  }
}

export function selectedRepositoryIds(selection: ValidationSelection): ReadonlySet<number> {
  return new Set(selection.repositoryIds)
}
