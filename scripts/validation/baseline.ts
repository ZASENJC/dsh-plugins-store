import type { ExecutionType, ValidationStatus } from '../../src/lib/validation-report'

export interface BaselineTarget {
  repositoryId: number
  fullName: string
  sourceSha: string
  executionType: Extract<ExecutionType, 'host-tool'>
  smokeMode: 'loader' | 'tool-registration'
  expectedFinalStatuses: Array<Extract<ValidationStatus, 'verified' | 'failed' | 'inconclusive' | 'structure_failed'>>
}

export interface ValidationBaseline {
  schemaVersion: 1
  generatedAt: string
  dshVersion: string
  platform: 'linux-x64'
  validatorVersion: string
  targets: BaselineTarget[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function parseBaseline(value: unknown): ValidationBaseline {
  if (!isRecord(value)
    || value.schemaVersion !== 1
    || typeof value.generatedAt !== 'string'
    || Number.isNaN(Date.parse(value.generatedAt))
    || typeof value.dshVersion !== 'string'
    || value.platform !== 'linux-x64'
    || typeof value.validatorVersion !== 'string'
    || !Array.isArray(value.targets)) {
    throw new Error('Baseline header is invalid')
  }
  const ids = new Set<number>()
  const names = new Set<string>()
  const targets = value.targets.map((raw, index): BaselineTarget => {
    if (!isRecord(raw)
      || !Number.isSafeInteger(raw.repositoryId)
      || Number(raw.repositoryId) <= 0
      || typeof raw.fullName !== 'string'
      || !/^[\w.-]+\/[\w.-]+$/.test(raw.fullName)
      || typeof raw.sourceSha !== 'string'
      || !/^[a-f0-9]{40}$/.test(raw.sourceSha)
      || raw.executionType !== 'host-tool'
      || !['loader', 'tool-registration'].includes(raw.smokeMode as string)
      || !Array.isArray(raw.expectedFinalStatuses)
      || raw.expectedFinalStatuses.length === 0
      || !raw.expectedFinalStatuses.every((status) => (
        status === 'verified' || status === 'failed' || status === 'inconclusive' || status === 'structure_failed'
      ))) {
      throw new Error(`Baseline target ${index + 1} sourceSha or contract is invalid`)
    }
    const repositoryId = Number(raw.repositoryId)
    const normalizedName = raw.fullName.toLowerCase()
    if (ids.has(repositoryId) || names.has(normalizedName)) throw new Error('Baseline contains duplicate repository identity')
    ids.add(repositoryId)
    names.add(normalizedName)
    return {
      repositoryId,
      fullName: raw.fullName,
      sourceSha: raw.sourceSha,
      executionType: 'host-tool',
      smokeMode: raw.smokeMode as BaselineTarget['smokeMode'],
      expectedFinalStatuses: [...new Set(raw.expectedFinalStatuses)] as BaselineTarget['expectedFinalStatuses'],
    }
  })
  return {
    schemaVersion: 1,
    generatedAt: value.generatedAt,
    dshVersion: value.dshVersion,
    platform: 'linux-x64',
    validatorVersion: value.validatorVersion,
    targets,
  }
}
