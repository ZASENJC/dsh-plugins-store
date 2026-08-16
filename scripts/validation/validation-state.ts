import { createHash } from 'node:crypto'

import { parseValidationReport, type ValidationReport } from '../../src/lib/validation-report'
import { isRetryableSourceValidationCode } from '../../src/lib/source-classification-archive'
import type { ValidationRecord } from '../../src/lib/validation'

// Unknown projects still need a structure-only pass so source evidence can refine
// the coarse Topic classification before the next catalog refresh.
const ELIGIBLE_PROJECT_TYPES = new Set(['plugin', 'skill', 'collection', 'channel', 'unknown'])
const TERMINAL_STATUSES = new Set([
  'unrecognized',
  'structure_failed',
  'inconclusive',
  'failed',
  'verified',
])

export const MAX_AUTOMATIC_RETRIES = 5
export const RETRY_BACKOFF_BASE_MS = 15 * 60 * 1000
export const RETRY_BACKOFF_MAX_MS = 24 * 60 * 60 * 1000

export interface ValidationStateTarget {
  dshVersion: string
  platform: string
  validatorVersion: string
  baselineDigest: string
}

export interface ValidationStateEntry {
  repositoryId: number
  pushedAt: string
  lastDurationMs?: number
  executionType?: string
  retryCount?: number
  nextRetryAt?: string
  retryExhausted?: boolean
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
  shardPlan?: Array<{
    repositoryId: number
    shard: number
    estimatedCost: number
  }>
}

interface CatalogValidationEntry {
  repositoryId: number
  projectType: string
  pushedAt: string
  sizeKb: number
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

export function parseValidationCatalog(value: unknown): ValidationCatalog {
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
    return {
      repositoryId,
      projectType: raw.projectType,
      pushedAt: raw.pushedAt,
      sizeKb: Number.isSafeInteger(raw.sizeKb) && Number(raw.sizeKb) >= 0 ? Number(raw.sizeKb) : 0,
    }
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
    if (raw.lastDurationMs !== undefined
      && (!Number.isSafeInteger(raw.lastDurationMs) || Number(raw.lastDurationMs) < 0)) {
      throw new Error('Validation state duration is invalid')
    }
    if (raw.retryCount !== undefined
      && (!Number.isSafeInteger(raw.retryCount) || Number(raw.retryCount) < 1
        || Number(raw.retryCount) > MAX_AUTOMATIC_RETRIES)) {
      throw new Error('Validation state retry count is invalid')
    }
    if (raw.nextRetryAt !== undefined && !isDate(raw.nextRetryAt)) {
      throw new Error('Validation state next retry time is invalid')
    }
    if (raw.retryExhausted !== undefined && typeof raw.retryExhausted !== 'boolean') {
      throw new Error('Validation state retry exhaustion is invalid')
    }
    if (raw.retryCount === undefined
      && (raw.nextRetryAt !== undefined || raw.retryExhausted === true)) {
      throw new Error('Validation state retry metadata is incomplete')
    }
    if (raw.retryCount !== undefined
      && raw.retryExhausted === true
      && Number(raw.retryCount) < MAX_AUTOMATIC_RETRIES) {
      throw new Error('Validation state retry exhaustion is premature')
    }
    if (raw.retryCount !== undefined
      && Number(raw.retryCount) < MAX_AUTOMATIC_RETRIES
      && raw.nextRetryAt === undefined) {
      throw new Error('Validation state next retry time is missing')
    }
    return {
      repositoryId,
      pushedAt: raw.pushedAt,
      ...(raw.lastDurationMs === undefined ? {} : { lastDurationMs: Number(raw.lastDurationMs) }),
      ...(typeof raw.executionType === 'string' && raw.executionType.length > 0 ? { executionType: raw.executionType } : {}),
      ...(raw.retryCount === undefined ? {} : { retryCount: Number(raw.retryCount) }),
      ...(typeof raw.nextRetryAt === 'string' ? { nextRetryAt: raw.nextRetryAt } : {}),
      ...(raw.retryExhausted === true ? { retryExhausted: true } : {}),
    }
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
    ...(Array.isArray(value.shardPlan) ? {
      shardPlan: value.shardPlan.map((raw) => {
        if (!isRecord(raw)
          || !Number.isSafeInteger(raw.repositoryId) || Number(raw.repositoryId) <= 0
          || !Number.isSafeInteger(raw.shard) || Number(raw.shard) < 0
          || typeof raw.estimatedCost !== 'number' || !Number.isFinite(raw.estimatedCost) || raw.estimatedCost <= 0) {
          throw new Error('Validation shard plan is invalid')
        }
        return {
          repositoryId: Number(raw.repositoryId),
          shard: Number(raw.shard),
          estimatedCost: Number(raw.estimatedCost),
        }
      }),
    } : {}),
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

function reportFailureCode(report: ValidationReport): string | undefined {
  return report.failure?.code ?? report.events.at(-1)?.code
}

export function isRetryableValidationReport(report: ValidationReport): boolean {
  return ['inconclusive', 'structure_failed'].includes(report.currentStatus)
    && (report.failure?.attribution === 'infrastructure'
      || isRetryableSourceValidationCode(reportFailureCode(report)))
}

function isRetryableValidationRecord(record: ValidationRecord): boolean {
  const reason = record.sandbox.reason ?? record.structure.reason
  return record.disposition === 'retryable'
    || ((record.sandbox.status === 'inconclusive' || record.structure.status === 'inconclusive')
      && isRetryableSourceValidationCode(reason))
}

function retryDelayMs(retryCount: number): number {
  return Math.min(
    RETRY_BACKOFF_MAX_MS,
    RETRY_BACKOFF_BASE_MS * (2 ** Math.max(0, retryCount - 1)),
  )
}

function retryEntry(
  repositoryId: number,
  pushedAt: string,
  now: string,
  previous: ValidationStateEntry | undefined,
  report?: ValidationReport | null,
): ValidationStateEntry {
  const retryCount = Math.min(
    MAX_AUTOMATIC_RETRIES,
    previous?.pushedAt === pushedAt ? (previous.retryCount ?? 0) + 1 : 1,
  )
  const durationMs = report?.completedAt === null
    ? undefined
    : report === undefined || report === null
      ? undefined
      : Math.max(0, Date.parse(report.completedAt ?? now) - Date.parse(report.startedAt))
  const executionType = report?.executionType
  return {
    repositoryId,
    pushedAt,
    ...(durationMs !== undefined && durationMs > 0 ? { lastDurationMs: durationMs } : {}),
    ...(executionType ? { executionType } : {}),
    retryCount,
    ...(retryCount >= MAX_AUTOMATIC_RETRIES ? { retryExhausted: true } : {}),
    // Exhaustion is a cooldown marker. Keep a nextRetryAt so transient
    // infrastructure failures continue to receive a low-frequency retry.
    nextRetryAt: new Date(Date.parse(now) + retryDelayMs(retryCount)).toISOString(),
  }
}

function retryIsDue(entry: ValidationStateEntry, now: string): boolean {
  if (entry.retryCount === undefined) return false
  return entry.nextRetryAt === undefined || Date.parse(entry.nextRetryAt) <= Date.parse(now)
}

export function reconcileValidationState(
  rawCatalog: unknown,
  rawPrevious: ValidationState | null,
  records: ReadonlyMap<number, ValidationRecord>,
  target: ValidationStateTarget,
  now: string,
): ValidationState | null {
  const catalog = parseValidationCatalog(rawCatalog)
  const parsedTarget = parseTarget(target)
  const previous = rawPrevious === null ? null : parseValidationState(rawPrevious)
  if (previous === null || !sameTarget(previous.target, parsedTarget)) return previous
  if (!isDate(now)) throw new Error('Validation reconciliation time is invalid')

  const eligible = catalog.repositories.filter(({ projectType }) => ELIGIBLE_PROJECT_TYPES.has(projectType))
  const eligibleIds = new Set(eligible.map(({ repositoryId }) => repositoryId))
  const entries = new Map(previous.entries
    .filter(({ repositoryId }) => eligibleIds.has(repositoryId))
    .map((entry) => [entry.repositoryId, entry] as const))
  for (const repository of eligible) {
    const record = records.get(repository.repositoryId)
    if (!record
      || !completedRecord(record)
      || isRetryableValidationRecord(record)
      || record.sourcePushedAt !== repository.pushedAt
      || record.dshVersion !== parsedTarget.dshVersion
      || record.platform !== parsedTarget.platform
      || record.validatorVersion !== parsedTarget.validatorVersion) continue
    const previousEntry = entries.get(repository.repositoryId)
    entries.set(repository.repositoryId, {
      repositoryId: repository.repositoryId,
      pushedAt: repository.pushedAt,
      ...(previousEntry?.lastDurationMs === undefined ? {} : { lastDurationMs: previousEntry.lastDurationMs }),
      ...(previousEntry?.executionType === undefined ? {} : { executionType: previousEntry.executionType }),
    })
  }
  return parseValidationState({
    schemaVersion: 1,
    generatedAt: now,
    catalogGeneratedAt: catalog.generatedAt,
    target: parsedTarget,
    entries: [...entries.values()],
  })
}

export function selectValidationDelta(
  rawCatalog: unknown,
  rawPrevious: ValidationState | null,
  target: ValidationStateTarget,
  shardCount: number,
  now: string,
): ValidationSelection {
  const catalog = parseValidationCatalog(rawCatalog)
  if (!Number.isSafeInteger(shardCount) || shardCount < 1) throw new Error('Validation shard count is invalid')
  if (!isDate(now)) throw new Error('Validation selection time is invalid')
  const previous = rawPrevious === null ? null : parseValidationState(rawPrevious)
  const full = previous === null || !sameTarget(previous.target, parseTarget(target))
  const previousById = new Map(previous?.entries.map((entry) => [entry.repositoryId, entry]) ?? [])
  const repositoryIds = catalog.repositories
    .filter(({ projectType }) => ELIGIBLE_PROJECT_TYPES.has(projectType))
    .filter(({ repositoryId, pushedAt }) => {
      if (full) return true
      const previousEntry = previousById.get(repositoryId)
      if (previousEntry?.pushedAt !== pushedAt) return true
      return previousEntry !== undefined && retryIsDue(previousEntry, now)
    })
    .map(({ repositoryId }) => repositoryId)
    .sort((left, right) => left - right)
  const selected = new Set(repositoryIds)
  const previousEntries = new Map(previous?.entries.map((entry) => [entry.repositoryId, entry]) ?? [])
  const selectedRepositories = catalog.repositories
    .filter((repository) => selected.has(repository.repositoryId))
    .map((repository) => ({
      repository,
      estimatedCost: estimateValidationCost(repository, previousEntries.get(repository.repositoryId)),
    }))
  const activeShardCount = Math.min(shardCount, Math.max(1, selectedRepositories.length))
  const loads = Array.from({ length: activeShardCount }, () => 0)
  const assignments = new Map<number, { shard: number, estimatedCost: number }>()
  for (const candidate of [...selectedRepositories].sort((left, right) => (
    right.estimatedCost - left.estimatedCost
      || stableRepositoryTie(left.repository.repositoryId, left.repository.pushedAt)
        - stableRepositoryTie(right.repository.repositoryId, right.repository.pushedAt)
  ))) {
    let shard = 0
    for (let index = 1; index < loads.length; index += 1) {
      if (loads[index] < loads[shard]) shard = index
    }
    loads[shard] += candidate.estimatedCost
    assignments.set(candidate.repository.repositoryId, { shard, estimatedCost: candidate.estimatedCost })
  }
  const shardPlan = [...assignments.entries()]
    .sort(([left], [right]) => left - right)
    .map(([repositoryId, assignment]) => ({ repositoryId, ...assignment }))
  const shards = [...new Set(shardPlan.map(({ shard }) => shard))].sort((a, b) => a - b)
  return {
    schemaVersion: 1,
    generatedAt: now,
    mode: repositoryIds.length === 0 ? 'none' : full ? 'full' : 'incremental',
    catalogGeneratedAt: catalog.generatedAt,
    target: parseTarget(target),
    repositoryIds,
    shards,
    shardPlan,
  }
}

const EXECUTION_COST_WEIGHT: Readonly<Record<string, number>> = Object.freeze({
  plugin: 1.2,
  web: 1.7,
  channel: 1.8,
  collection: 0.7,
  skill: 0.6,
  unknown: 1,
  'host-tool': 1.2,
  command: 1.1,
  'channel-mcp': 1.8,
  native: 1.4,
  'non-plugin': 0.2,
})

function stableRepositoryTie(repositoryId: number, pushedAt: string): number {
  return createHash('sha1').update(`${repositoryId}:${pushedAt}`).digest().readUInt32BE(0)
}

export function estimateValidationCost(
  repository: Pick<CatalogValidationEntry, 'projectType' | 'sizeKb'>,
  history?: Pick<ValidationStateEntry, 'lastDurationMs' | 'executionType'>,
): number {
  const typeWeight = EXECUTION_COST_WEIGHT[history?.executionType ?? repository.projectType] ?? 1
  const sizeWeight = 1 + Math.log2(Math.max(0, repository.sizeKb) + 1) / 8
  const historicalWeight = history?.lastDurationMs && history.lastDurationMs > 0
    ? Math.min(8, Math.max(0.5, history.lastDurationMs / 10_000))
    : sizeWeight * typeWeight
  return Number(Math.max(0.1, historicalWeight * 0.75 + sizeWeight * typeWeight * 0.25).toFixed(6))
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
  const catalog = parseValidationCatalog(rawCatalog)
  const previous = rawPrevious === null ? null : parseValidationState(rawPrevious)
  const selection = parseValidationSelection(rawSelection)
  if (!isDate(now)) throw new Error('Validation state time is invalid')
  if (selection.catalogGeneratedAt !== catalog.generatedAt) throw new Error('Validation selection catalog is stale')
  const eligible = new Map(catalog.repositories
    .filter(({ projectType }) => ELIGIBLE_PROJECT_TYPES.has(projectType))
    .map((repository) => [repository.repositoryId, repository]))
  const entries = new Map<number, ValidationStateEntry>()
  if (selection.mode !== 'full') {
    for (const entry of previous?.entries ?? []) {
      if (eligible.has(entry.repositoryId)) entries.set(entry.repositoryId, entry)
    }
  }
  for (const repositoryId of selection.repositoryIds) {
    const repository = eligible.get(repositoryId)
    if (!repository) throw new Error(`Validation selection repository ${repositoryId} is not eligible`)
    const report = terminalReport(rawReports, repositoryId, selection.target)
    const previousEntry = previous?.entries.find(({ repositoryId: id }) => id === repositoryId)
    if (!report || report.repository.sourcePushedAt !== repository.pushedAt || isRetryableValidationReport(report)) {
      entries.set(repositoryId, retryEntry(
        repositoryId,
        repository.pushedAt,
        now,
        selection.mode === 'full' ? undefined : previousEntry,
        report,
      ))
      continue
    }
    if (report.repository.sourcePushedAt === repository.pushedAt) {
      const durationMs = report.completedAt === null
        ? undefined
        : Math.max(0, Date.parse(report.completedAt) - Date.parse(report.startedAt))
      entries.set(repositoryId, {
        repositoryId,
        pushedAt: repository.pushedAt,
        ...(durationMs && durationMs > 0 ? { lastDurationMs: durationMs } : {}),
        ...(durationMs && durationMs > 0 && report.executionType ? { executionType: report.executionType } : {}),
      })
    }
  }
  return parseValidationState({
    schemaVersion: 1,
    generatedAt: now,
    catalogGeneratedAt: catalog.generatedAt,
    target: selection.target,
    entries: [...entries.values()],
  })
}
