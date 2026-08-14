import { describe, expect, it } from 'vitest'

import type { ValidationReport } from '../../src/lib/validation-report'
import type { BaselineTarget } from './baseline'
import { evaluateBaselineOutcome, selectBaselineTargets } from './baseline-cli'

const targets: BaselineTarget[] = [1, 2, 3].map((repositoryId) => ({
  repositoryId,
  fullName: `fixture/plugin-${repositoryId}`,
  sourceSha: String(repositoryId).repeat(40),
  executionType: 'host-tool',
  smokeMode: 'tool-registration',
  expectedFinalStatuses: repositoryId === 3 ? ['inconclusive'] : ['verified'],
}))

describe('P2 baseline orchestration', () => {
  it('selects an explicit repository or a deterministic limit', () => {
    expect(selectBaselineTargets(targets, { repositoryId: 2, limit: 0 }).map(({ repositoryId }) => repositoryId)).toEqual([2])
    expect(selectBaselineTargets(targets, { repositoryId: null, limit: 2 }).map(({ repositoryId }) => repositoryId)).toEqual([1, 2])
    expect(() => selectBaselineTargets(targets, { repositoryId: 99, limit: 0 })).toThrow('baseline')
  })

  it('records expected and unexpected final outcomes for later false-positive observation', () => {
    const report = { currentStatus: 'verified' } as ValidationReport

    expect(evaluateBaselineOutcome(targets[0], report)).toEqual({ expected: true, observed: 'verified' })
    expect(evaluateBaselineOutcome(targets[2], report)).toEqual({ expected: false, observed: 'verified' })
  })
})
