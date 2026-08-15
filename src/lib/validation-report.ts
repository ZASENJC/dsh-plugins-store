import {
  parseSourceClassification,
  type SourceClassification,
} from './source-classification'

export const EXECUTION_TYPES = Object.freeze([
  'host-tool',
  'web',
  'command',
  'channel-mcp',
  'native',
  'skill',
  'collection',
  'non-plugin',
] as const)

export const VALIDATION_KINDS = Object.freeze([
  'structure',
  'linux-headless',
  'dsh-web',
  'command-smoke',
  'channel-mock',
  'skill-static',
  'collection',
  'native',
  'non-plugin',
] as const)

export const VALIDATION_STATUSES = Object.freeze([
  'discovered',
  'recognized',
  'unrecognized',
  'structure_passed',
  'structure_failed',
  'queued',
  'running',
  'inconclusive',
  'install_passed',
  'install_failed',
  'runtime_passed',
  'runtime_failed',
  'smoke_passed',
  'smoke_failed',
  'verified',
  'failed',
  'expired',
] as const)

export type ExecutionType = typeof EXECUTION_TYPES[number]
export type ValidationKind = typeof VALIDATION_KINDS[number]
export type ValidationStatus = typeof VALIDATION_STATUSES[number]
export type ValidationStage =
  | 'discovery'
  | 'classification'
  | 'structure'
  | 'sandbox'
  | 'installation'
  | 'runtime'
  | 'smoke'
  | 'final'
export type FailureAttribution = 'plugin' | 'compatibility' | 'infrastructure' | 'policy' | 'inconclusive'
export type StructureCheckStatus = 'passed' | 'failed' | 'warning' | 'quarantined' | 'not-run'
export type StructureCheckSeverity = 'required' | 'advisory' | 'security'

export interface ValidationEvent {
  sequence: number
  stage: ValidationStage
  status: ValidationStatus
  at: string
  code?: string
  reason?: string
  attribution?: FailureAttribution
  fingerprint?: string
}

export interface StructureCheckEvidence {
  code: string
  status: StructureCheckStatus
  severity: StructureCheckSeverity
  message: string
  path?: string
  tool?: string
}

export interface ValidationFailure {
  attribution: FailureAttribution
  code: string
  fingerprint: string
  reason: string
  reproducibility: {
    attempts: number
    matchingFingerprints: number
  }
}

export interface ValidationArtifact {
  kind: 'report' | 'sanitized-log' | 'playwright-trace' | 'scanner-result'
  url: string
  sha256?: string
}

export interface ValidationReport {
  schemaVersion: 1
  reportId: string
  mode: 'shadow' | 'enforce'
  validationKind: ValidationKind
  executionType: ExecutionType | null
  sourceClassification?: SourceClassification
  repository: {
    id: number
    fullName: string
    url: string
    sourceSha: string
    sourcePushedAt: string
  }
  target: {
    dshVersion: string
    platform: string
    nodeVersion: string
    validatorVersion: string
  }
  startedAt: string
  completedAt: string | null
  currentStatus: ValidationStatus
  events: ValidationEvent[]
  structureChecks: StructureCheckEvidence[]
  failure: ValidationFailure | null
  artifacts: ValidationArtifact[]
}

export interface ValidationBinding {
  repositoryId: number
  sourceSha: string
  dshVersion: string
  platform: string
  validatorVersion: string
}

export interface ValidationFreshness {
  current: boolean
  shouldQueue: boolean
  reasons: Array<
    | 'NOT_VERIFIED'
    | 'REPOSITORY_CHANGED'
    | 'SOURCE_SHA_CHANGED'
    | 'DSH_VERSION_CHANGED'
    | 'PLATFORM_CHANGED'
    | 'VALIDATOR_VERSION_CHANGED'
  >
}

const EXECUTION_TYPE_SET = new Set<string>(EXECUTION_TYPES)
const VALIDATION_KIND_SET = new Set<string>(VALIDATION_KINDS)
const VALIDATION_STATUS_SET = new Set<string>(VALIDATION_STATUSES)
const FAILURE_ATTRIBUTIONS = new Set<FailureAttribution>([
  'plugin',
  'compatibility',
  'infrastructure',
  'policy',
  'inconclusive',
])
const FAILURE_STATUSES = new Set<ValidationStatus>([
  'structure_failed',
  'install_failed',
  'runtime_failed',
  'smoke_failed',
  'failed',
])
const STATUS_STAGES: Record<ValidationStatus, ValidationStage> = {
  discovered: 'discovery',
  recognized: 'classification',
  unrecognized: 'classification',
  structure_passed: 'structure',
  structure_failed: 'structure',
  queued: 'sandbox',
  running: 'sandbox',
  inconclusive: 'sandbox',
  install_passed: 'installation',
  install_failed: 'installation',
  runtime_passed: 'runtime',
  runtime_failed: 'runtime',
  smoke_passed: 'smoke',
  smoke_failed: 'smoke',
  verified: 'final',
  failed: 'final',
  expired: 'final',
}
const TRANSITIONS: Record<ValidationStatus, ReadonlySet<ValidationStatus>> = {
  discovered: new Set(['recognized', 'unrecognized']),
  recognized: new Set(['structure_passed', 'structure_failed']),
  unrecognized: new Set(),
  structure_passed: new Set(['queued']),
  structure_failed: new Set(['failed']),
  queued: new Set(['running', 'inconclusive']),
  running: new Set(['install_passed', 'install_failed', 'inconclusive']),
  inconclusive: new Set(),
  install_passed: new Set(['runtime_passed', 'runtime_failed']),
  install_failed: new Set(['failed']),
  runtime_passed: new Set(['smoke_passed', 'smoke_failed', 'inconclusive']),
  runtime_failed: new Set(['failed']),
  smoke_passed: new Set(['verified']),
  smoke_failed: new Set(['failed']),
  verified: new Set(['expired']),
  failed: new Set(),
  expired: new Set(),
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function parseEvent(value: unknown, index: number): ValidationEvent {
  if (!isRecord(value) || !Number.isSafeInteger(value.sequence) || Number(value.sequence) !== index + 1) {
    throw new Error(`验证事件 ${index + 1} sequence 无效`)
  }
  if (!VALIDATION_STATUS_SET.has(value.status as string)) {
    throw new Error(`验证事件 ${index + 1} status 无效`)
  }
  const status = value.status as ValidationStatus
  if (value.stage !== STATUS_STAGES[status]) {
    throw new Error(`验证事件 ${index + 1} stage 与 status 不匹配`)
  }
  if (!isDate(value.at)) throw new Error(`验证事件 ${index + 1} at 无效`)
  for (const field of ['code', 'reason', 'fingerprint']) {
    if (value[field] !== undefined && !isNonEmptyString(value[field])) {
      throw new Error(`验证事件 ${index + 1} ${field} 无效`)
    }
  }
  if (value.attribution !== undefined && !FAILURE_ATTRIBUTIONS.has(value.attribution as FailureAttribution)) {
    throw new Error(`验证事件 ${index + 1} attribution 无效`)
  }
  return value as unknown as ValidationEvent
}

function parseStructureCheck(value: unknown, index: number): StructureCheckEvidence {
  if (!isRecord(value)
    || !isNonEmptyString(value.code)
    || !['passed', 'failed', 'warning', 'quarantined', 'not-run'].includes(value.status as string)
    || !['required', 'advisory', 'security'].includes(value.severity as string)
    || !isNonEmptyString(value.message)) {
    throw new Error(`结构检查 ${index + 1} 格式无效`)
  }
  return value as unknown as StructureCheckEvidence
}

function parseFailure(value: unknown): ValidationFailure | null {
  if (value === null) return null
  if (!isRecord(value)
    || !FAILURE_ATTRIBUTIONS.has(value.attribution as FailureAttribution)
    || !isNonEmptyString(value.code)
    || !isNonEmptyString(value.fingerprint)
    || !isNonEmptyString(value.reason)
    || !isRecord(value.reproducibility)
    || !Number.isSafeInteger(value.reproducibility.attempts)
    || !Number.isSafeInteger(value.reproducibility.matchingFingerprints)
    || Number(value.reproducibility.attempts) < 1
    || Number(value.reproducibility.matchingFingerprints) < 1
    || Number(value.reproducibility.matchingFingerprints) > Number(value.reproducibility.attempts)) {
    throw new Error('验证失败归因格式无效')
  }
  return value as unknown as ValidationFailure
}

function validateTransitions(events: ValidationEvent[]): void {
  if (events.length === 0 || events[0].status !== 'discovered') {
    throw new Error('验证报告必须从 discovered 开始')
  }
  for (let index = 1; index < events.length; index += 1) {
    const previous = events[index - 1]
    const current = events[index]
    if (!TRANSITIONS[previous.status].has(current.status)) {
      throw new Error(`非法状态迁移：${previous.status} -> ${current.status}`)
    }
    if (Date.parse(current.at) < Date.parse(previous.at)) {
      throw new Error(`验证事件 ${current.sequence} 时间早于前一事件`)
    }
  }
}

export function parseValidationReport(value: unknown): ValidationReport {
  if (!isRecord(value) || value.schemaVersion !== 1) throw new Error('验证报告 schemaVersion 无效')
  if (!isNonEmptyString(value.reportId) || !['shadow', 'enforce'].includes(value.mode as string)) {
    throw new Error('验证报告标识或模式无效')
  }
  if (!VALIDATION_KIND_SET.has(value.validationKind as string)
    || (value.executionType !== null && !EXECUTION_TYPE_SET.has(value.executionType as string))) {
    throw new Error('验证类型无效')
  }
  if (!isRecord(value.repository)
    || !Number.isSafeInteger(value.repository.id)
    || Number(value.repository.id) <= 0
    || !/^[\w.-]+\/[\w.-]+$/.test(String(value.repository.fullName))
    || !isNonEmptyString(value.repository.url)
    || !/^[a-f0-9]{40}$/i.test(String(value.repository.sourceSha))
    || !isDate(value.repository.sourcePushedAt)) {
    throw new Error('验证报告仓库绑定无效')
  }
  const sourceClassification = value.sourceClassification === undefined || value.sourceClassification === null
    ? undefined
    : parseSourceClassification(value.sourceClassification)
  if (sourceClassification !== undefined
    && sourceClassification.sourceSha !== String(value.repository.sourceSha).toLowerCase()) {
    throw new Error('源码分类 sourceSha 与验证报告不一致')
  }
  if (!isRecord(value.target)
    || !isNonEmptyString(value.target.dshVersion)
    || !isNonEmptyString(value.target.platform)
    || !isNonEmptyString(value.target.nodeVersion)
    || !isNonEmptyString(value.target.validatorVersion)) {
    throw new Error('验证报告目标绑定无效')
  }
  if (!isDate(value.startedAt) || (value.completedAt !== null && !isDate(value.completedAt))) {
    throw new Error('验证报告时间无效')
  }
  if (!VALIDATION_STATUS_SET.has(value.currentStatus as string) || !Array.isArray(value.events)) {
    throw new Error('验证报告当前状态无效')
  }

  const events = value.events.map(parseEvent)
  validateTransitions(events)
  if (events.at(-1)?.status !== value.currentStatus) {
    throw new Error('currentStatus 必须与最后一个验证事件一致')
  }
  if (!Array.isArray(value.structureChecks)) throw new Error('structureChecks 必须是数组')
  const structureChecks = value.structureChecks.map(parseStructureCheck)
  const failure = parseFailure(value.failure)
  const hasFailureEvent = events.some(({ status }) => FAILURE_STATUSES.has(status))
  if (hasFailureEvent !== (failure !== null)) {
    throw new Error(hasFailureEvent ? '失败状态缺少失败指纹和归因' : '非失败报告不能携带失败归因')
  }
  if (!Array.isArray(value.artifacts)) throw new Error('artifacts 必须是数组')
  for (const [index, artifact] of value.artifacts.entries()) {
    if (!isRecord(artifact)
      || !['report', 'sanitized-log', 'playwright-trace', 'scanner-result'].includes(artifact.kind as string)
      || !isNonEmptyString(artifact.url)
      || (artifact.sha256 !== undefined && !/^[a-f0-9]{64}$/i.test(String(artifact.sha256)))) {
      throw new Error(`验证产物 ${index + 1} 格式无效`)
    }
  }

  return {
    ...(value as unknown as ValidationReport),
    ...(sourceClassification ? { sourceClassification } : {}),
    events,
    structureChecks,
    failure,
  }
}

export function appendValidationEvent(
  report: ValidationReport,
  event: Omit<ValidationEvent, 'sequence'>,
): ValidationReport {
  const previous = report.events.at(-1)
  if (!previous || !TRANSITIONS[previous.status].has(event.status)) {
    throw new Error(`非法状态迁移：${previous?.status ?? 'none'} -> ${event.status}`)
  }
  if (event.stage !== STATUS_STAGES[event.status]) {
    throw new Error(`状态 ${event.status} 的阶段必须是 ${STATUS_STAGES[event.status]}`)
  }
  let failure = report.failure
  if (FAILURE_STATUSES.has(event.status)) {
    if (!event.code || !event.fingerprint || !event.attribution) {
      throw new Error('失败状态必须包含失败指纹、代码和归因')
    }
    failure = {
      attribution: event.attribution,
      code: event.code,
      fingerprint: event.fingerprint,
      reason: event.reason ?? event.code,
      reproducibility: { attempts: 1, matchingFingerprints: 1 },
    }
  }
  const next = {
    ...report,
    currentStatus: event.status,
    completedAt: ['verified', 'failed', 'expired', 'inconclusive'].includes(event.status) ? event.at : null,
    events: [...report.events, { ...event, sequence: report.events.length + 1 }],
    failure,
  }
  return parseValidationReport(next)
}

export function assessValidationFreshness(
  report: ValidationReport,
  binding: ValidationBinding,
): ValidationFreshness {
  const reasons: ValidationFreshness['reasons'] = []
  if (report.currentStatus !== 'verified') reasons.push('NOT_VERIFIED')
  if (report.repository.id !== binding.repositoryId) reasons.push('REPOSITORY_CHANGED')
  if (report.repository.sourceSha !== binding.sourceSha) reasons.push('SOURCE_SHA_CHANGED')
  if (report.target.dshVersion !== binding.dshVersion) reasons.push('DSH_VERSION_CHANGED')
  if (report.target.platform !== binding.platform) reasons.push('PLATFORM_CHANGED')
  if (report.target.validatorVersion !== binding.validatorVersion) reasons.push('VALIDATOR_VERSION_CHANGED')
  return {
    current: reasons.length === 0,
    shouldQueue: reasons.some((reason) => reason !== 'NOT_VERIFIED') || report.currentStatus === 'expired',
    reasons,
  }
}

export function expireValidationReport(
  report: ValidationReport,
  code: string,
  at: string,
): ValidationReport {
  if (report.currentStatus !== 'verified') throw new Error('只有 verified 报告可以过期')
  return appendValidationEvent(report, {
    stage: 'final',
    status: 'expired',
    at,
    code,
    reason: code,
  })
}
