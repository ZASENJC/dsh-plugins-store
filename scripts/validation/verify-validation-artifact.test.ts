import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { verifyValidationArtifact } from './verify-validation-artifact'

const directories: string[] = []

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

async function writeArtifact(feed: unknown): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-validation-artifact-'))
  directories.push(directory)
  await writeFile(join(directory, 'validation.json'), JSON.stringify(feed))
  await writeFile(join(directory, 'state.json'), JSON.stringify({
    schemaVersion: 1,
    generatedAt: '2026-01-01T00:00:00.000Z',
    catalogGeneratedAt: '2026-01-01T00:00:00.000Z',
    target: {
      dshVersion: '0.1.0-rc.6',
      platform: 'linux-x64',
      validatorVersion: '0.1.2',
      baselineDigest: 'a'.repeat(64),
    },
    entries: [],
  }))
  return directory
}

describe('validation artifact verification', () => {
  it('accepts a complete feed and state artifact', async () => {
    const directory = await writeArtifact({
      schemaVersion: 1,
      generatedAt: '2026-01-01T00:00:00.000Z',
      records: [],
    })

    await expect(verifyValidationArtifact(directory)).resolves.toBeUndefined()
  })

  it('accepts historical records bound to an older validation target', async () => {
    const directory = await writeArtifact({
      schemaVersion: 1,
      generatedAt: '2026-01-01T00:00:00.000Z',
      records: [{
        repositoryId: 42,
        sourceSha: 'a'.repeat(40),
        sourcePushedAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        dshVersion: 'other',
        platform: 'linux-x64',
        validatorVersion: '0.1.2',
        structure: { status: 'passed' },
        sandbox: { status: 'passed' },
      }],
    })

    await expect(verifyValidationArtifact(directory)).resolves.toBeUndefined()
  })
})
