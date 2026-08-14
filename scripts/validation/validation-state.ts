import { parseValidationReport, type ValidationReport } from '../../src/lib/validation-report'
import type { ValidationRecord } from '../../src/lib/validation'

const ELIGIBLE_PROJECT_TYPES = new Set(['plugin', 'skill', 'collection', 'channel'])
const TERMINAL_STATUSES = new Set([
  'unrecognized',
  'structure_failed',
  'inconclusive',
  'failed',
  'verified',
])

export interface ValidationStateTarget {
  dshVersion: string
  platform: string
  validatorVersion: string
  baselineDigest: string
}

export interface ValidationStateEntry {
  repositoryId: number
  pushedAt: string
}

export interface ValidationState {
  schemaVersion: 1
  generatedAt: string
  catalogGeneratedAt: string
  target: ValidationStateTarget
  entries: ValidationStateEntry[]
}

export interface ValidationSelection {
  schemaVersion: 1
  generatedAt: string
  mode: 'full' | 'incremental' | 'none'
  catalogGeneratedAt: string
  target: ValidationStateTarget
  repositoryIds: number[]
  shards: number[]
}

interface CatalogValidationEntry {
  repositoryId: number
  projectType: string
  pushedAt: string
}

interface ValidationCatalog {
  generatedAt: string
  repositories: CatalogValidationEntry[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

function parseTarget(value: unknown): ValidationStateTarget {
  if (!isRecord(value)
    || typeof value.dshVersion !== 'string' || value.dshVersion.length === 0
    || typeof value.platform !== 'string' || value.platform.length === 0
    || typeof value.validatorVersion !== 'string' || value.validatorVersion.length === 0
    || typeof value.baselineDigest !== 'string' || !/^[a-f0-9]{64}$/i.test(value.baselineDigest)) {
    throw new Error('Validation state target is invalid')
  }
  return {
    dshVersion: value.dshVersion,
    platform: value.platform,
    validatorVersion: value.validatorVersion,
    baselineDigest: value.baselineDigest,
  }
}

function parseCatalog(value: unknown): ValidationCatalog {
  if (!isRecord(value)
    || value.schemaVersion !== 1
    || !isDate(value.generatedAt)
    || !Array.isArray(value.repositories)) {
    throw new Error('Validation catalog is invalid')
  }
  const ids = new Set<number>()
  const repositories = value.repositories.map((raw): CatalogValidationEntry => {
    if (!isRecord(raw)
      || !Number.isSafeInteger(raw.repositoryId) || Number(raw.repositoryId) <= 0
      || typeof raw.projectType !== 'string'
      || !isDate(raw.pushedAt)) throw new Error('Validation catalog entry is invalid')
    const repositoryId = Number(raw.repositoryId)
    if (ids.has(repositoryId)) throw new Error('Validation catalog repository ID is duplicated')
    ids.add(repositoryId)
    return { repositoryId, projectType: raw.projectType, pushedAt: raw.pushedAt }
  })
  return { generatedAt: value.generatedAt, repositories: repositories.sort((a, b) => a.repositoryId - b.repositoryId) }
}

function parseEntries(value: unknown): ValidationStateEntry[] {
  if (!Array.isArray(value)) throw new Error('Validation state entries are invalid')
  const ids = new Set<number>()
  return value.map((raw): ValidationStateEntry => {
    if (!isRecord(raw)
      || !Number.isSafeInteger(raw.repositoryId) || Number(raw.repositoryId) <= 0
      || !isDate(raw.pushedAt)) throw new Error('Validation state entry is invalid')
    const repositoryId = Number(raw.repositoryId)
    if (ids.has(repositoryId)) throw new Error('Validation state repository ID is duplicated')
    ids.add(repositoryId)
    return { repositoryId, pushedAt: raw.pushedAt }
  }).sort((a, b) => a.repositoryId - b.repositoryId)
}

export function parseValidationState(value: unknown): ValidationState {
  if (!isRecord(value)
    || value.schemaVersion !== 1
    || !isDate(value.generatedAt)
    || !isDate(value.catalogGeneratedAt)) throw new Error('Validation state is invalid')
  return {
    schemaVersion: 1,
    generatedAt: value.generatedAt,
    catalogGeneratedAt: value.catalogGeneratedAt,
    target: parseTarget(value.target),
    entries: parseEntries(value.entries),
  }
}

export function parseValidationSelection(value: unknown): ValidationSelection {
  if (!isRecord(value)
    || value.schemaVersion !== 1
    || !isDate(value.generatedAt)
    || !isDate(value.catalogGeneratedAt)
    || !['full', 'incremental', 'none'].includes(value.mode as string)
    || !Array.isArray(value.repositoryIds)
    || !value.repositoryIds.every((id) => Number.isSafeInteger(id) && Number(id) > 0)
    || new Set(value.repositoryIds).size !== value.repositoryIds.length
    || !Array.isArray(value.shards)
    || !value.shards.every((id) => Number.isSafeInteger(id) && Number(id) >= 0)
    || new Set(value.shards).size !== value.shards.length) {
    throw new Error('Validation selection is invalid')
  }
  return {
    schemaVersion: 1,
    generatedAt: value.generatedAt,
    mode: value.mode as ValidationSelection['mode'],
    catalogGeneratedAt: value.catalogGeneratedAt,
    target: parseTarget(value.target),
    repositoryIds: (value.repositoryIds as number[]).map(Number),
    shards: (value.shards as number[]).map(Number),
  }
}

function sameTarget(left: ValidationStateTarget, right: ValidationStateTarget): boolean {
  return left.dshVersion === right.dshVersion
    && left.platform === right.platform
    && left.validatorVersion === right.validatorVersion
    && left.baselineDigest === right.baselineDigest
}

function completedRecord(record: ValidationRecord): boolean {
  return record.sourceSha !== null && (
    record.structure.status === 'failed'
    || record.structure.status === 'inconclusive'
    || record.structure.status === 'quarantined'
    || (record.structure.status === 'passed'
      && ['passed', 'failed', 'inconclusive', 'skipped'].includes(record.sandbox.status))
  )
}

export function reconcileValidationState(
  rawCatalog: unknown,
  rawPrevious: ValidationState | null,
  records: ReadonlyMap<number, ValidationRecord>,
  target: ValidationStateTarget,
  now: string,
): ValidationState | null {
  const catalog = parseCatalog(rawCatalog)
  const parsedTarget = parseTarget(target)
  const previous = rawPrevious === null ? null : parseValidationState(rawPrevious)
  if (previous === null || !sameTarget(previous.target, parsedTarget)) return previous
  if (!isDate(now)) throw new Error('Validation reconciliation time is invalid')

  const eligible = catalog.repositories.filter(({ projectType }) => ELIGIBLE_PROJECT_TYPES.has(projectType))
  const eligibleIds = new Set(eligible.map(({ repositoryId }) => repositoryId))
  const entries = new Map(previous.entries
    .filter(({ repositoryId }) => eligibleIds.has(repositoryId))
    .map(({ repositoryId, pushedAt }) => [repositoryId, pushedAt]))
  for (const repository of eligible) {
    const record = records.get(repository.repositoryId)
    if (!record
      || !completedRecord(record)
      || record.sourcePushedAt !== repository.pushedAt
      || record.dshVersion !== parsedTarget.dshVersion
      || record.platform !== parsedTarget.platform
      || record.validatorVersion !== parsedTarget.validatorVersion) continue
    entries.set(repository.repositoryId, repository.pushedAt)
  }
  return parseValidationState({
    schemaVersion: 1,
    generatedAt: now,
    catalogGeneratedAt: catalog.generatedAt,
    target: parsedTarget,
    entries: [...entries].map(([repositoryId, pushedAt]) => ({ repositoryId, pushedAt })),
  })
}

export function selectValidationDelta(
  rawCatalog: unknown,
  rawPrevious: ValidationState | null,
  target: ValidationStateTarget,
  shardCount: number,
  now: string,
): ValidationSelection {
  const catalog = parseCatalog(rawCatalog)
  if (!Number.isSafeInteger(shardCount) || shardCount < 1) throw new Error('Validation shard count is invalid')
  if (!isDate(now)) throw new Error('Validation selection time is invalid')
  const previous = rawPrevious === null ? null : parseValidationState(rawPrevious)
  const full = previous === null || !sameTarget(previous.target, parseTarget(target))
  const previousById = new Map(previous?.entries.map((entry) => [entry.repositoryId, entry.pushedAt]) ?? [])
  const repositoryIds = catalog.repositories
    .filter(({ projectType }) => ELIGIBLE_PROJECT_TYPES.has(projectType))
    .filter(({ repositoryId, pushedAt }) => full || previousById.get(repositoryId) !== pushedAt)
    .map(({ repositoryId }) => repositoryId)
  const selected = new Set(repositoryIds)
  const shards = [...new Set(catalog.repositories.flatMap((repository, index) => (
    selected.has(repository.repositoryId) ? [index % shardCount] : []
  )))].sort((a, b) => a - b)
  return {
    schemaVersion: 1,
    generatedAt: now,
    mode: repositoryIds.length === 0 ? 'none' : full ? 'full' : 'incremental',
    catalogGeneratedAt: catalog.generatedAt,
    target: parseTarget(target),
    repositoryIds,
    shards,
  }
}

function reportTime(report: ValidationReport): number {
  return Date.parse(report.completedAt ?? report.startedAt)
}

function terminalReport(reports: ValidationReport[], repositoryId: number, target: ValidationStateTarget): ValidationReport | null {
  const candidates = reports.map(parseValidationReport).filter((report) => (
    report.repository.id === repositoryId
    && report.target.dshVersion === target.dshVersion
    && report.target.platform === target.platform
    && report.target.validatorVersion === target.validatorVersion
    && TERMINAL_STATUSES.has(report.currentStatus)
  )).sort((left, right) => reportTime(right) - reportTime(left) || right.events.length - left.events.length)
  return candidates[0] ?? null
}

export function buildValidationState(
  rawCatalog: unknown,
  rawPrevious: ValidationState | null,
  rawSelection: ValidationSelection,
  rawReports: ValidationReport[],
  now: string,
): ValidationState {
  const catalog = parseCatalog(rawCatalog)
  const previous = rawPrevious === null ? null : parseValidationState(rawPrevious)
  const selection = parseValidationSelection(rawSelection)
  if (!isDate(now)) throw new Error('Validation state time is invalid')
  if (selection.catalogGeneratedAt !== catalog.generatedAt) throw new Error('Validation selection catalog is stale')
  const eligible = new Map(catalog.repositories
    .filter(({ projectType }) => ELIGIBLE_PROJECT_TYPES.has(projectType))
    .map((repository) => [repository.repositoryId, repository]))
  const entries = new Map<number, string>()
  if (selection.mode !== 'full') {
    for (const entry of previous?.entries ?? []) {
      if (eligible.has(entry.repositoryId)) entries.set(entry.repositoryId, entry.pushedAt)
    }
  }
  for (const repositoryId of selection.repositoryIds) {
    const repository = eligible.get(repositoryId)
    if (!repository) throw new Error(`Validation selection repository ${repositoryId} is not eligible`)
    const report = terminalReport(rawReports, repositoryId, selection.target)
    if (report && report.repository.sourcePushedAt === repository.pushedAt) {
      entries.set(repositoryId, repository.pushedAt)
    }
  }
  return parseValidationState({
    schemaVersion: 1,
    generatedAt: now,
    catalogGeneratedAt: catalog.generatedAt,
    target: selection.target,
    entries: [...entries].map(([repositoryId, pushedAt]) => ({ repositoryId, pushedAt })),
  })
}
