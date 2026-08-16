import {
  PROJECT_TYPES,
  classifyRepository,
  type ProjectType,
} from './classification'
import {
  SOURCE_CLASSIFIER_VERSION,
  parseSourceClassification,
  type SourceClassification,
} from './source-classification'
import type { ValidationRecord } from './validation'

export const SOURCE_CLASSIFICATION_ARCHIVE_SCHEMA_VERSION = 1 as const

export type SourceClassificationDisposition = 'include' | 'exclude' | 'inconclusive'

export type SourceValidationStatus = 'passed' | 'failed' | 'inconclusive'
export type SourceValidationDisposition = 'verified' | 'auto_failed' | 'retryable' | 'capability_pending' | 'external_dependency_pending' | 'manual_review'

// These outcomes are transient and can be retried without asking a reviewer to
// inspect plugin source. Unsupported execution contracts are listed separately
// below so they do not consume an automatic retry budget.
export const RETRYABLE_SOURCE_VALIDATION_CODES = new Set([
  'VALIDATION_NOT_OBSERVED',
  'SOURCE_CHANGED_DURING_RUN',
  'CANDIDATE_INFRASTRUCTURE_FAILED',
  'SANDBOX_TIMEOUT',
  'SANDBOX_INFRASTRUCTURE_FAILED',
  'SCANNER_UNAVAILABLE',
  'SNAPSHOT_LOAD_FAILED',
  'STRUCTURE_CHECK_FAILED',
  'REPORT_WRITE_FAILED',
])

// These outcomes are deterministic until a validator or platform adapter is
// added. They should remain visible in the archive without consuming an
// automatic retry budget on every scheduled run.
export const CAPABILITY_PENDING_SOURCE_VALIDATION_CODES = new Set([
  'WEB_SMOKE_CONTRACT_REQUIRED',
  'CHANNEL_MOCK_REQUIRED',
  'CHANNEL_MOCK_INVALID',
  'COLLECTION_MANIFEST_REQUIRED',
  'SKILL_VALIDATOR_REQUIRED',
  'PLATFORM_RUNNER_REQUIRED',
  'VALIDATOR_CONTRACT_REQUIRED',
])

export const EXTERNAL_DEPENDENCY_SOURCE_VALIDATION_CODES = new Set([
  'EXTERNAL_CREDENTIALS_REQUIRED',
])

// Only an explicit security signal requires source inspection. Other policy
// outcomes, such as sandbox hygiene failures, remain fully automated.
export const MANUAL_REVIEW_SOURCE_VALIDATION_CODES = new Set([
  'SECURITY_REVIEW_REQUIRED',
])

export function isRetryableSourceValidationCode(code: string | undefined): boolean {
  return code !== undefined && RETRYABLE_SOURCE_VALIDATION_CODES.has(code)
}

export function isCapabilityPendingSourceValidationCode(code: string | undefined): boolean {
  return code !== undefined && CAPABILITY_PENDING_SOURCE_VALIDATION_CODES.has(code)
}

export function isExternalDependencySourceValidationCode(code: string | undefined): boolean {
  return code !== undefined && EXTERNAL_DEPENDENCY_SOURCE_VALIDATION_CODES.has(code)
}

export function resolveSourceValidationDisposition({
  status,
  attribution,
  errorCode,
}: {
  status: SourceValidationStatus
  attribution?: SourceValidationResult['attribution']
  errorCode?: string
}): SourceValidationDisposition {
  if (status === 'passed') return 'verified'
  if (errorCode !== undefined && MANUAL_REVIEW_SOURCE_VALIDATION_CODES.has(errorCode)) return 'manual_review'
  if (status === 'inconclusive' && isExternalDependencySourceValidationCode(errorCode)) {
    return 'external_dependency_pending'
  }
  if (status === 'inconclusive' && isCapabilityPendingSourceValidationCode(errorCode)) {
    return 'capability_pending'
  }
  if (status === 'inconclusive'
    && (attribution === 'infrastructure' || isRetryableSourceValidationCode(errorCode))) return 'retryable'
  if (status === 'inconclusive' && attribution === 'inconclusive') return 'retryable'
  if (status === 'failed' || attribution === 'plugin' || attribution === 'compatibility') return 'auto_failed'
  return 'manual_review'
}

export interface SourceValidationResult {
  status: SourceValidationStatus
  disposition: SourceValidationDisposition
  stage: 'structure' | 'sandbox'
  sourceSha: string | null
  checkedAt: string
  dshVersion: string
  platform: string
  validatorVersion: string
  executionType: string | null
  durationMs?: number
  errorCode?: string
  attribution?: 'plugin' | 'compatibility' | 'infrastructure' | 'policy' | 'inconclusive'
}

export interface SourceDiscoveryRepository {
  repositoryId: number
  fullName: string
  url: string
  pushedAt: string
  topics: string[]
  defaultBranch: string
  archived: boolean
  fork: boolean
  sizeKb: number
  projectType: ProjectType
}

export interface SourceDiscoverySnapshot {
  schemaVersion: 1
  generatedAt: string
  reportedByGitHub: number
  repositories: SourceDiscoveryRepository[]
}

export interface SourceClassificationArchiveRecord {
  repositoryId: number
  fullName: string
  sourcePushedAt: string
  sourceSha: string | null
  disposition: SourceClassificationDisposition
  exclusionReason?: string
  failureCode?: string
  classification?: SourceClassification
  validation?: SourceValidationResult
}

export interface SourceClassificationArchive {
  schemaVersion: 1
  generatedAt: string
  mode: 'full' | 'incremental'
  classifierVersion: string
  records: SourceClassificationArchiveRecord[]
}

export interface SourceClassificationSelection {
  schemaVersion: 1
  generatedAt: string
  mode: 'full' | 'incremental' | 'none'
  repositoryIds: number[]
  shards: number[]
}

export interface ValidationCatalogSnapshot {
  schemaVersion: 1
  generatedAt: string
  repositories: Array<{
    repositoryId: number
    projectType: ProjectType
    pushedAt: string
    sizeKb: number
  }>
}

const PROJECT_TYPE_IDS = new Set<ProjectType>(PROJECT_TYPES.map(({ id }) => id))
const EXCLUDED_SOURCE_TYPES = new Set<ProjectType>(['application', 'infrastructure', 'directory'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function numberValue(value: unknown, fallback = 0): number {
  return Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : fallback
}

function parseValidationResult(value: unknown): SourceValidationResult {
  if (!isRecord(value)
    || !['passed', 'failed', 'inconclusive'].includes(value.status as string)
    || !['verified', 'auto_failed', 'retryable', 'capability_pending', 'external_dependency_pending', 'manual_review'].includes(value.disposition as string)
    || !['structure', 'sandbox'].includes(value.stage as string)
    || (value.sourceSha !== null && (typeof value.sourceSha !== 'string' || !/^[a-f0-9]{40}$/i.test(value.sourceSha)))
    || !isDate(value.checkedAt)
    || typeof value.dshVersion !== 'string' || value.dshVersion.length === 0
    || typeof value.platform !== 'string' || value.platform.length === 0
    || typeof value.validatorVersion !== 'string' || value.validatorVersion.length === 0
    || (value.executionType !== null && typeof value.executionType !== 'string')) {
    throw new Error('Source validation result is invalid')
  }
  if (value.durationMs !== undefined
    && (!Number.isSafeInteger(value.durationMs) || Number(value.durationMs) < 0)) {
    throw new Error('Source validation duration is invalid')
  }
  if (value.attribution !== undefined
    && !['plugin', 'compatibility', 'infrastructure', 'policy', 'inconclusive'].includes(value.attribution as string)) {
    throw new Error('Source validation attribution is invalid')
  }
  const result: SourceValidationResult = {
    status: value.status as SourceValidationStatus,
    disposition: value.disposition as SourceValidationDisposition,
    stage: value.stage as SourceValidationResult['stage'],
    sourceSha: value.sourceSha === null ? null : String(value.sourceSha).toLowerCase(),
    checkedAt: value.checkedAt,
    dshVersion: value.dshVersion,
    platform: value.platform,
    validatorVersion: value.validatorVersion,
    executionType: value.executionType === null ? null : value.executionType,
    ...(value.durationMs === undefined ? {} : { durationMs: Number(value.durationMs) }),
    ...(typeof value.errorCode === 'string' ? { errorCode: value.errorCode } : {}),
    ...(value.attribution === undefined ? {} : { attribution: value.attribution as SourceValidationResult['attribution'] }),
  }
  // Archives written before disposition classification was introduced used
  // manual_review for every non-passed result. Reclassify those records while
  // preserving their original evidence and SHA binding.
  return {
    ...result,
    disposition: resolveSourceValidationDisposition(result),
  }
}

function booleanValue(value: unknown): boolean {
  return value === true
}

function repositoryProjectType(raw: Record<string, unknown>, topics: string[]): ProjectType {
  const explicit = raw.projectType
  if (typeof explicit === 'string' && PROJECT_TYPE_IDS.has(explicit as ProjectType)) return explicit as ProjectType
  return classifyRepository({
    fullName: stringValue(raw.fullName ?? raw.full_name),
    name: stringValue(raw.name),
    description: stringValue(raw.description),
    topics,
  }).projectType
}

export function parseSourceDiscovery(value: unknown): SourceDiscoverySnapshot {
  if (!isRecord(value)
    || value.schemaVersion !== 1
    || !isDate(value.generatedAt)
    || !Array.isArray(value.repositories)) {
    throw new Error('Source discovery snapshot is invalid')
  }
  const ids = new Set<number>()
  const repositories = value.repositories.map((raw): SourceDiscoveryRepository => {
    if (!isRecord(raw)) throw new Error('Source discovery repository is invalid')
    const repositoryId = Number(raw.repositoryId ?? raw.id)
    const fullName = stringValue(raw.fullName ?? raw.full_name)
    const url = stringValue(raw.url ?? raw.html_url)
    const pushedAt = stringValue(raw.pushedAt ?? raw.pushed_at)
    const topics = Array.isArray(raw.topics) && raw.topics.every((topic) => typeof topic === 'string')
      ? [...new Set(raw.topics as string[])]
      : []
    if (!Number.isSafeInteger(repositoryId) || repositoryId <= 0
      || !/^[\w.-]+\/[\w.-]+$/.test(fullName)
      || url.length === 0
      || !isDate(pushedAt)) throw new Error('Source discovery repository identity is invalid')
    if (ids.has(repositoryId)) throw new Error('Source discovery repository ID is duplicated')
    ids.add(repositoryId)
    return {
      repositoryId,
      fullName,
      url,
      pushedAt,
      topics,
      defaultBranch: stringValue(raw.defaultBranch ?? raw.default_branch, 'main'),
      archived: booleanValue(raw.archived),
      fork: booleanValue(raw.fork),
      sizeKb: numberValue(raw.sizeKb ?? raw.size),
      projectType: repositoryProjectType(raw, topics),
    }
  })
  return {
    schemaVersion: 1,
    generatedAt: value.generatedAt,
    reportedByGitHub: numberValue(value.reportedByGitHub, repositories.length),
    repositories: repositories
      .filter((repository) => !repository.archived && !repository.fork)
      .sort((left, right) => left.repositoryId - right.repositoryId),
  }
}

function parseArchiveRecord(value: unknown): SourceClassificationArchiveRecord {
  if (!isRecord(value)
    || !Number.isSafeInteger(value.repositoryId) || Number(value.repositoryId) <= 0
    || typeof value.fullName !== 'string'
    || !isDate(value.sourcePushedAt)
    || !['include', 'exclude', 'inconclusive'].includes(value.disposition as string)
    || (value.sourceSha !== null && (typeof value.sourceSha !== 'string' || !/^[a-f0-9]{40}$/i.test(value.sourceSha)))) {
    throw new Error('Source classification archive record is invalid')
  }
  const classification = value.classification === undefined || value.classification === null
    ? undefined
    : parseSourceClassification(value.classification)
  const sourceSha = value.sourceSha === null ? null : String(value.sourceSha).toLowerCase()
  if (classification !== undefined && (sourceSha === null || classification.sourceSha !== sourceSha)) {
    throw new Error('Source classification archive SHA binding is invalid')
  }
  const validation = value.validation === undefined || value.validation === null
    ? undefined
    : parseValidationResult(value.validation)
  if (validation?.sourceSha !== undefined && validation.sourceSha !== null && validation.sourceSha !== sourceSha) {
    throw new Error('Source validation SHA binding is invalid')
  }
  if (validation && (
    (validation.status === 'passed' && validation.disposition !== 'verified')
    || (validation.status === 'failed' && !['auto_failed', 'manual_review'].includes(validation.disposition))
    || (validation.status === 'inconclusive' && !['auto_failed', 'retryable', 'capability_pending', 'external_dependency_pending', 'manual_review'].includes(validation.disposition))
  )) {
    throw new Error('Source validation disposition is invalid')
  }
  return {
    repositoryId: Number(value.repositoryId),
    fullName: value.fullName,
    sourcePushedAt: value.sourcePushedAt,
    sourceSha,
    disposition: value.disposition as SourceClassificationDisposition,
    ...(typeof value.exclusionReason === 'string' ? { exclusionReason: value.exclusionReason } : {}),
    ...(typeof value.failureCode === 'string' ? { failureCode: value.failureCode } : {}),
    ...(classification ? { classification } : {}),
    ...(validation ? { validation } : {}),
  }
}

export function parseSourceClassificationArchive(value: unknown): SourceClassificationArchive {
  if (!isRecord(value)
    || value.schemaVersion !== SOURCE_CLASSIFICATION_ARCHIVE_SCHEMA_VERSION
    || !isDate(value.generatedAt)
    || !['full', 'incremental'].includes(value.mode as string)
    || typeof value.classifierVersion !== 'string'
    || !Array.isArray(value.records)) {
    throw new Error('Source classification archive is invalid')
  }
  const ids = new Set<number>()
  const records = value.records.map(parseArchiveRecord)
  if (records.some((record) => record.classification
    && record.classification.classifierVersion !== value.classifierVersion)) {
    throw new Error('Source classification archive classifier version is inconsistent')
  }
  for (const record of records) {
    if (ids.has(record.repositoryId)) throw new Error('Source classification archive repository ID is duplicated')
    ids.add(record.repositoryId)
  }
  return {
    schemaVersion: 1,
    generatedAt: value.generatedAt,
    mode: value.mode as SourceClassificationArchive['mode'],
    classifierVersion: value.classifierVersion,
    records: records.sort((left, right) => left.repositoryId - right.repositoryId),
  }
}

export function mergeSourceValidationHistory(
  currentValue: SourceClassificationArchive,
  historyValues: readonly SourceClassificationArchive[],
): SourceClassificationArchive {
  const current = parseSourceClassificationArchive(currentValue)
  const currentById = new Map(current.records.map((record) => [record.repositoryId, record]))
  const latestById = new Map<number, SourceValidationResult>()

  for (const archive of [...historyValues.map(parseSourceClassificationArchive), current]) {
    for (const record of archive.records) {
      const target = currentById.get(record.repositoryId)
      const validation = record.validation
      if (!target || !validation || target.sourceSha === null
        || record.sourcePushedAt !== target.sourcePushedAt
        || record.sourceSha !== target.sourceSha
        || validation.sourceSha !== target.sourceSha) continue
      const latest = latestById.get(record.repositoryId)
      if (!latest || Date.parse(validation.checkedAt) >= Date.parse(latest.checkedAt)) {
        latestById.set(record.repositoryId, validation)
      }
    }
  }

  return parseSourceClassificationArchive({
    ...current,
    records: current.records.map((record) => {
      const validation = latestById.get(record.repositoryId)
      return validation ? { ...record, validation } : record
    }),
  })
}

export function selectSourceClassificationTargets(
  discovery: SourceDiscoverySnapshot,
  previous: SourceClassificationArchive | null,
  forceFull: boolean,
): SourceDiscoveryRepository[] {
  const full = forceFull
    || previous === null
    || previous.classifierVersion !== SOURCE_CLASSIFIER_VERSION
  const previousById = new Map(previous?.records.map((record) => [record.repositoryId, record]) ?? [])
  return discovery.repositories.filter((repository) => {
    if (full) return true
    const record = previousById.get(repository.repositoryId)
    return record === undefined
      || record.sourcePushedAt !== repository.pushedAt
      || record.disposition === 'inconclusive'
  })
}

function currentRecord(
  repository: Pick<SourceDiscoveryRepository, 'repositoryId' | 'pushedAt'>,
  archive: SourceClassificationArchive | null,
): SourceClassificationArchiveRecord | undefined {
  if (archive === null || archive.classifierVersion !== SOURCE_CLASSIFIER_VERSION) return undefined
  const record = archive.records.find(({ repositoryId }) => repositoryId === repository.repositoryId)
  return record?.sourcePushedAt === repository.pushedAt ? record : undefined
}

export function buildSourceClassificationArchive({
  discovery,
  previous,
  results,
  mode,
  generatedAt,
}: {
  discovery: SourceDiscoverySnapshot
  previous: SourceClassificationArchive | null
  results: readonly SourceClassificationArchiveRecord[]
  mode: 'full' | 'incremental'
  generatedAt: string
}): SourceClassificationArchive {
  const resultById = new Map(results.map((record) => [record.repositoryId, record]))
  const previousById = new Map(previous?.records.map((record) => [record.repositoryId, record]) ?? [])
  const records = discovery.repositories.map((repository): SourceClassificationArchiveRecord => {
    const result = resultById.get(repository.repositoryId)
    if (result && result.sourcePushedAt === repository.pushedAt) return result
    const old = previousById.get(repository.repositoryId)
    if (mode === 'incremental' && old?.sourcePushedAt === repository.pushedAt
      && previous?.classifierVersion === SOURCE_CLASSIFIER_VERSION) return old
    return {
      repositoryId: repository.repositoryId,
      fullName: repository.fullName,
      sourcePushedAt: repository.pushedAt,
      sourceSha: null,
      disposition: 'inconclusive',
      failureCode: 'CLASSIFICATION_NOT_OBSERVED',
    }
  })
  return parseSourceClassificationArchive({
    schemaVersion: 1,
    generatedAt,
    mode,
    classifierVersion: SOURCE_CLASSIFIER_VERSION,
    records,
  })
}

export function buildValidationCatalog(
  discovery: SourceDiscoverySnapshot,
  archive: SourceClassificationArchive,
): ValidationCatalogSnapshot {
  const repositories = discovery.repositories.flatMap((repository) => {
    const record = currentRecord(repository, archive)
    // A validation target must have a current source classification. Keep
    // inconclusive records in the central archive for retry, but do not send
    // them to the sandbox using only coarse Topic metadata.
    if (record?.disposition !== 'include') return []
    const sourceType = record?.classification && record.classification.confidence !== 'low'
      ? record.classification.projectType
      : undefined
    return [{
      repositoryId: repository.repositoryId,
      projectType: (sourceType ?? repository.projectType) as ProjectType,
      pushedAt: repository.pushedAt,
      sizeKb: repository.sizeKb,
    }]
  })
  return {
    schemaVersion: 1,
    generatedAt: discovery.generatedAt,
    repositories: repositories.sort((left, right) => left.repositoryId - right.repositoryId),
  }
}

export function validationRecordsFromArchive(
  archive: SourceClassificationArchive | null,
): ReadonlyMap<number, ValidationRecord> {
  const records = new Map<number, ValidationRecord>()
  for (const record of archive?.records ?? []) {
    const validation = record.validation
    if (!validation || validation.sourceSha === null) continue
    records.set(record.repositoryId, {
      repositoryId: record.repositoryId,
      sourceSha: validation.sourceSha,
      sourcePushedAt: record.sourcePushedAt,
      updatedAt: validation.checkedAt,
      dshVersion: validation.dshVersion,
      platform: validation.platform,
      validatorVersion: validation.validatorVersion,
      disposition: validation.disposition,
      ...(record.classification ? { sourceClassification: record.classification } : {}),
      ...(validation.disposition === 'manual_review'
        ? {
          structure: {
            status: 'quarantined',
            checkedAt: validation.checkedAt,
            ...(validation.errorCode ? { reason: validation.errorCode } : {}),
          },
          sandbox: { status: 'skipped' },
        }
        : validation.stage === 'structure'
        ? {
          structure: {
            status: validation.status === 'inconclusive' ? 'inconclusive' : 'failed',
            checkedAt: validation.checkedAt,
            ...(validation.errorCode ? { reason: validation.errorCode } : {}),
          },
          sandbox: { status: 'skipped' },
        }
        : {
          structure: { status: 'passed', checkedAt: validation.checkedAt },
          sandbox: validation.status === 'passed'
            ? { status: 'passed', checkedAt: validation.checkedAt }
            : validation.status === 'inconclusive'
              ? { status: 'inconclusive', checkedAt: validation.checkedAt, ...(validation.errorCode ? { reason: validation.errorCode } : {}) }
              : { status: 'failed', checkedAt: validation.checkedAt, ...(validation.errorCode ? { reason: validation.errorCode } : {}) },
        }),
    })
  }
  return records
}

export function currentSourceClassification(
  repository: Pick<SourceDiscoveryRepository, 'repositoryId' | 'pushedAt'>,
  archive: SourceClassificationArchive | null,
): SourceClassification | undefined {
  const record = currentRecord(repository, archive)
  return record?.classification
}

export function isExcludedByCurrentArchive(
  repository: Pick<SourceDiscoveryRepository, 'repositoryId' | 'pushedAt'>,
  archive: SourceClassificationArchive | null,
): boolean {
  return currentRecord(repository, archive)?.disposition === 'exclude'
}

export function excludedSourceTypes(): ReadonlySet<ProjectType> {
  return EXCLUDED_SOURCE_TYPES
}
