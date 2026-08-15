import { describe, expect, it } from 'vitest'

import { assertValidationInputConsistency } from './validation-input'

const discovery = {
  schemaVersion: 1,
  generatedAt: '2026-08-16T00:00:00.000Z',
  reportedByGitHub: 1,
  repositories: [{
    repositoryId: 1,
    fullName: 'owner/plugin',
    url: 'https://github.com/owner/plugin',
    pushedAt: '2026-08-15T00:00:00.000Z',
    topics: ['dsh-plugin'],
    defaultBranch: 'main',
    archived: false,
    fork: false,
    sizeKb: 10,
    projectType: 'plugin',
  }],
}

const catalog = {
  schemaVersion: 1,
  generatedAt: discovery.generatedAt,
  repositories: [{ repositoryId: 1, projectType: 'plugin', pushedAt: '2026-08-15T00:00:00.000Z', sizeKb: 10 }],
}

const selection = {
  schemaVersion: 1,
  generatedAt: '2026-08-16T00:01:00.000Z',
  mode: 'full',
  catalogGeneratedAt: discovery.generatedAt,
  target: {
    dshVersion: '0.1.0-rc.6',
    platform: 'linux-x64',
    validatorVersion: '0.1.2',
    baselineDigest: 'a'.repeat(64),
  },
  repositoryIds: [1],
  shards: [0],
  shardPlan: [{ repositoryId: 1, shard: 0, estimatedCost: 1 }],
}

describe('validation input consistency', () => {
  it('accepts an atomic discovery/catalog/selection bundle', () => {
    expect(assertValidationInputConsistency(discovery, catalog, selection)).toMatchObject({
      generatedAt: discovery.generatedAt,
      selectedRepositories: 1,
    })
  })

  it('rejects snapshots generated from different discovery versions', () => {
    expect(() => assertValidationInputConsistency(
      discovery,
      { ...catalog, generatedAt: '2026-08-16T01:00:00.000Z' },
    )).toThrow('snapshots are mismatched')
  })

  it('rejects a selected repository absent from the discovery snapshot', () => {
    expect(() => assertValidationInputConsistency(
      discovery,
      catalog,
      { ...selection, repositoryIds: [2], shardPlan: [{ repositoryId: 2, shard: 0, estimatedCost: 1 }] },
    )).toThrow('absent from validation catalog')
  })
})
