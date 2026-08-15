import type { ProjectType } from './classification'
import { parseSourceClassification, type SourceClassification } from './source-classification'

export const CURRENT_VALIDATION_TARGET = Object.freeze({
  dshVersion: '0.1.0-rc.6',
  platform: 'linux-x64',
  validatorVersion: '0.1.2',
} as const)

export const VALIDATION_STAGE_DEFINITIONS = Object.freeze([
  { id: 'discovery', label: '市场发现' },
  { id: 'identification', label: '归类识别' },
  { id: 'structure', label: '结构检查' },
  { id: 'sandbox', label: '实机验证' },
] as const)

export const VALIDATION_STATUS_DEFINITIONS = Object.freeze([
  { id: 'unrecognized', label: '待识别' },
  { id: 'check-pending', label: '待结构检查' },
  { id: 'check-running', label: '结构检查中' },
  { id: 'check-failed', label: '结构检查失败' },
  { id: 'sandbox-pending', label: '待实机验证' },
  { id: 'sandbox-running', label: '实机验证中' },
  { id: 'sandbox-failed', label: '实机验证失败' },
  { id: 'verified', label: '已验证' },
  { id: 'expired', label: '需重新验证' },
  { id: 'recorded', label: '已有验证记录' },
  { id: 'inconclusive', label: '需要复核' },
  { id: 'security-review', label: '安全复核中' },
  { id: 'not-applicable', label: '非插件验证范围' },
] as const)

export type ValidationOverall = typeof VALIDATION_STATUS_DEFINITIONS[number]['id']
export type ValidationStageId = typeof VALIDATION_STAGE_DEFINITIONS[number]['id']
export type ValidationStageStatus = 'pending' | 'running' | 'passed' | 'failed' | 'inconclusive' | 'quarantined' | 'skipped'
export type ValidationTone = 'neutral' | 'info' | 'running' | 'success' | 'warning' | 'danger'

export interface ValidationStageEvidence {
  status: ValidationStageStatus
  checkedAt?: string
  reportUrl?: string
  issueUrl?: string
  reason?: string
}

export interface ValidationRecord {
  repositoryId: number
  sourceSha: string | null
  sourcePushedAt: string
  updatedAt: string
  dshVersion?: string
  platform?: string
  validatorVersion?: string
  sourceClassification?: SourceClassification
  structure: ValidationStageEvidence
  sandbox: ValidationStageEvidence
}

export interface ValidationFeed {
  schemaVersion: 1
  generatedAt: string
  records: ValidationRecord[]
}

export interface ValidationStatus {
  overall: ValidationOverall
  label: string
  tone: ValidationTone
  level: 1 | 2 | 3 | 4
  eligible: boolean
  verified: boolean
  updatedAt: string | null
  sourceSha: string | null
  dshVersion: string | null
  platform: string | null
  validatorVersion: string | null
  reportUrl: string | null
  issueUrl: string | null
  reason: string | null
  stages: Record<ValidationStageId, ValidationStageEvidence>
}

const ELIGIBLE_PROJECT_TYPES = new Set<ProjectType>(['plugin', 'skill', 'collection', 'channel'])
const STAGE_STATUSES = new Set<ValidationStageStatus>([
  'pending',
  'running',
  'passed',
  'failed',
  'inconclusive',
  'quarantined',
  'skipped',
])
const STATUS_DEFINITION_BY_ID = new Map(
  VALIDATION_STATUS_DEFINITIONS.map((definition) => [definition.id, definition]),
)
const STATUS_TONES: Record<ValidationOverall, ValidationTone> = {
  unrecognized: 'neutral',
  'check-pending': 'neutral',
  'check-running': 'running',
  'check-failed': 'danger',
  'sandbox-pending': 'warning',
  'sandbox-running': 'running',
  'sandbox-failed': 'danger',
  verified: 'success',
  expired: 'warning',
  recorded: 'info',
  inconclusive: 'warning',
  'security-review': 'warning',
  'not-applicable': 'neutral',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isValidDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

function parseStage(value: unknown, field: string): ValidationStageEvidence {
  if (!isRecord(value) || !STAGE_STATUSES.has(value.status as ValidationStageStatus)) {
    throw new Error(`${field} 状态无效`)
  }
  for (const key of ['checkedAt', 'reportUrl', 'issueUrl', 'reason']) {
    if (value[key] !== undefined && typeof value[key] !== 'string') {
      throw new Error(`${field}.${key} 必须是字符串`)
    }
  }
  if (value.checkedAt !== undefined && !isValidDate(value.checkedAt)) {
    throw new Error(`${field}.checkedAt 不是有效时间`)
  }
  return {
    status: value.status as ValidationStageStatus,
    ...(value.checkedAt ? { checkedAt: value.checkedAt as string } : {}),
    ...(value.reportUrl ? { reportUrl: value.reportUrl as string } : {}),
    ...(value.issueUrl ? { issueUrl: value.issueUrl as string } : {}),
    ...(value.reason ? { reason: value.reason as string } : {}),
  }
}

export function parseValidationFeed(value: unknown): Map<number, ValidationRecord> {
  if (!isRecord(value) || value.schemaVersion !== 1 || !isValidDate(value.generatedAt) || !Array.isArray(value.records)) {
    throw new Error('验证状态文件格式无效')
  }

  const records = new Map<number, ValidationRecord>()
  for (const raw of value.records) {
    if (!isRecord(raw) || !Number.isSafeInteger(raw.repositoryId) || Number(raw.repositoryId) <= 0) {
      throw new Error('验证记录 repositoryId 无效')
    }
    const repositoryId = Number(raw.repositoryId)
    if (records.has(repositoryId)) throw new Error(`验证记录 repositoryId ${repositoryId} 重复`)
    if (raw.sourceSha !== null && (typeof raw.sourceSha !== 'string' || !/^[a-f0-9]{40}$/i.test(raw.sourceSha))) {
      throw new Error(`验证记录 ${repositoryId} sourceSha 无效`)
    }
    const sourceClassification = raw.sourceClassification === undefined || raw.sourceClassification === null
      ? undefined
      : parseSourceClassification(raw.sourceClassification)
    if (sourceClassification !== undefined
      && (raw.sourceSha === null || sourceClassification.sourceSha !== String(raw.sourceSha).toLowerCase())) {
      throw new Error(`验证记录 ${repositoryId} 源码分类 sourceSha 不一致`)
    }
    if (!isValidDate(raw.sourcePushedAt) || !isValidDate(raw.updatedAt)) {
      throw new Error(`验证记录 ${repositoryId} 时间无效`)
    }

    const structure = parseStage(raw.structure, `验证记录 ${repositoryId}.structure`)
    const sandbox = parseStage(raw.sandbox, `验证记录 ${repositoryId}.sandbox`)
    if (!['pending', 'skipped'].includes(sandbox.status) && structure.status !== 'passed') {
      throw new Error(`验证记录 ${repositoryId} 未通过结构检查，不能写入实机验证结果`)
    }
    if (sandbox.status === 'passed' && (raw.sourceSha === null
      || typeof raw.dshVersion !== 'string' || raw.dshVersion.length === 0
      || typeof raw.platform !== 'string' || raw.platform.length === 0
      || typeof raw.validatorVersion !== 'string' || raw.validatorVersion.length === 0)) {
      throw new Error(`验证记录 ${repositoryId} 缺少完整验证绑定`)
    }

    records.set(repositoryId, {
      repositoryId,
      sourceSha: raw.sourceSha as string | null,
      sourcePushedAt: raw.sourcePushedAt,
      updatedAt: raw.updatedAt,
      ...(typeof raw.dshVersion === 'string' ? { dshVersion: raw.dshVersion } : {}),
      ...(typeof raw.platform === 'string' ? { platform: raw.platform } : {}),
      ...(typeof raw.validatorVersion === 'string' ? { validatorVersion: raw.validatorVersion } : {}),
      ...(sourceClassification ? { sourceClassification } : {}),
      structure,
      sandbox,
    })
  }
  return records
}

function resolveOverall(record: ValidationRecord): ValidationOverall {
  if (record.structure.status === 'pending') return 'check-pending'
  if (record.structure.status === 'running') return 'check-running'
  if (record.structure.status === 'failed') return 'check-failed'
  if (record.structure.status === 'inconclusive') return 'inconclusive'
  if (record.structure.status === 'quarantined') return 'security-review'
  if (record.sandbox.status === 'pending' || record.sandbox.status === 'skipped') return 'sandbox-pending'
  if (record.sandbox.status === 'running') return 'sandbox-running'
  if (record.sandbox.status === 'failed') return 'sandbox-failed'
  if (record.sandbox.status === 'inconclusive') return 'inconclusive'
  return record.sourceSha === null ? 'recorded' : 'verified'
}

function getEvidence(record: ValidationRecord | undefined, key: 'reportUrl' | 'issueUrl' | 'reason'): string | null {
  return record?.sandbox[key] ?? record?.structure[key] ?? null
}

function buildExpiryReason(record: ValidationRecord, repositoryPushedAt: string): string {
  const reasons: string[] = []
  if (record.sourcePushedAt !== repositoryPushedAt) reasons.push('仓库源码已更新')
  const targetChanged = record.dshVersion !== CURRENT_VALIDATION_TARGET.dshVersion
    || record.platform !== CURRENT_VALIDATION_TARGET.platform
    || record.validatorVersion !== CURRENT_VALIDATION_TARGET.validatorVersion
  if (targetChanged) reasons.push('验证目标已变化')
  return reasons.join('；') || '验证绑定已失效'
}

export function buildValidationStatus({
  projectType,
  repositoryPushedAt,
  record,
  legacyVerificationUrl = null,
}: {
  repositoryId: number
  projectType: ProjectType
  repositoryPushedAt: string
  record?: ValidationRecord
  legacyVerificationUrl?: string | null
}): ValidationStatus {
  const identified = projectType !== 'unknown'
  const eligible = ELIGIBLE_PROJECT_TYPES.has(projectType)
  const defaultStages: ValidationStatus['stages'] = {
    discovery: { status: 'passed' },
    identification: { status: identified ? 'passed' : 'pending' },
    structure: { status: eligible ? 'pending' : 'skipped' },
    sandbox: { status: eligible ? 'pending' : 'skipped' },
  }

  let overall: ValidationOverall
  let level: ValidationStatus['level'] = 1
  let stages = defaultStages
  let reason: string | null = null
  if (!identified) {
    overall = 'unrecognized'
  } else if (!eligible) {
    overall = 'not-applicable'
    level = 2
  } else if (record) {
    stages = { ...defaultStages, structure: record.structure, sandbox: record.sandbox }
    overall = resolveOverall(record)
    reason = getEvidence(record, 'reason')
    level = record.structure.status === 'passed' ? 3 : 2
    if (record.sandbox.status === 'passed') level = 4
    if (overall === 'verified' && record.sourcePushedAt !== repositoryPushedAt) overall = 'expired'
    if (overall === 'verified' && (
      record.dshVersion !== CURRENT_VALIDATION_TARGET.dshVersion
      || record.platform !== CURRENT_VALIDATION_TARGET.platform
      || record.validatorVersion !== CURRENT_VALIDATION_TARGET.validatorVersion
    )) overall = 'expired'
    if (overall === 'expired') reason = buildExpiryReason(record, repositoryPushedAt)
  } else if (legacyVerificationUrl) {
    overall = 'recorded'
    level = 4
    stages = {
      ...defaultStages,
      structure: { status: 'passed', reportUrl: legacyVerificationUrl },
      sandbox: { status: 'passed', reportUrl: legacyVerificationUrl },
    }
  } else {
    overall = 'check-pending'
    level = 2
  }

  return {
    overall,
    label: STATUS_DEFINITION_BY_ID.get(overall)?.label ?? overall,
    tone: STATUS_TONES[overall],
    level,
    eligible,
    verified: overall === 'verified',
    updatedAt: record?.updatedAt ?? null,
    sourceSha: record?.sourceSha ?? null,
    dshVersion: record?.dshVersion ?? null,
    platform: record?.platform ?? null,
    validatorVersion: record?.validatorVersion ?? null,
    reportUrl: getEvidence(record, 'reportUrl') ?? legacyVerificationUrl,
    issueUrl: getEvidence(record, 'issueUrl'),
    reason,
    stages,
  }
}
