import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import { runShadowBatch } from './shadow-runner'
import type { RepositoryStructureSnapshot } from './structure-check'

const target = {
  now: '2026-08-14T09:00:00Z',
  dshVersion: '0.1.0-rc.6',
  nodeVersion: '22.19.0',
  validatorVersion: '1.0.0',
  platform: 'linux-x64',
}

describe('P1 shadow runner', () => {
  it('writes immutable reports without mutating public validation state or calling an Issue service', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-shadow-'))
    const outputDir = join(root, 'reports')
    const validationPath = join(root, 'validation.json')
    const originalValidation = '{"schemaVersion":1,"generatedAt":"1970-01-01T00:00:00.000Z","records":[]}\n'
    await writeFile(validationPath, originalValidation, 'utf8')
    const issueWriter = vi.fn()
    const snapshotLoader = vi.fn(async (repository): Promise<RepositoryStructureSnapshot> => ({
      repository: {
        id: repository.repositoryId,
        fullName: repository.fullName,
        url: repository.url,
        sourceSha: repository.repositoryId === 1 ? 'a'.repeat(40) : 'b'.repeat(40),
        sourcePushedAt: repository.pushedAt,
        isPrivate: false,
        archived: false,
        deleted: false,
        sizeKb: 100,
      },
      projectType: repository.projectType,
      topics: repository.topics,
      files: repository.projectType === 'unknown' ? {} : {
        'package.json': JSON.stringify({
          name: '@fixture/plugin',
          version: '1.0.0',
          main: './lib/index.js',
          dsh: { bundle: { patch: './cordis.patch.yml' } },
          license: 'MIT',
        }),
        'lib/index.js': 'export default function fixture() {}',
        'cordis.patch.yml': '- insert:\n    - id: fixture\n      name: "@fixture/plugin"\n',
        'package-lock.json': '{}',
        'LICENSE': 'MIT',
      },
      scans: {
        trivy: { status: 'passed', vulnerabilities: [], secrets: [] },
        osv: { status: 'passed', vulnerabilities: [] },
      },
    }))

    const summary = await runShadowBatch({
      repositories: [
        {
          repositoryId: 1,
          fullName: 'fixture/plugin',
          url: 'https://github.com/fixture/plugin',
          pushedAt: '2026-08-14T08:00:00Z',
          projectType: 'plugin',
          topics: ['dsh-plugin'],
          defaultBranch: 'main',
        },
        {
          repositoryId: 2,
          fullName: 'fixture/unknown',
          url: 'https://github.com/fixture/unknown',
          pushedAt: '2026-08-14T08:00:00Z',
          projectType: 'unknown',
          topics: ['dsh-plugin'],
          defaultBranch: 'main',
        },
      ],
      outputDir,
      target,
      snapshotLoader,
    })

    expect(summary).toMatchObject({
      mode: 'shadow',
      discovered: 2,
      reportsWritten: 2,
      decisions: { passed: 1, inconclusive: 1 },
    })
    expect(issueWriter).not.toHaveBeenCalled()
    expect(await readFile(validationPath, 'utf8')).toBe(originalValidation)
    expect((await readdir(join(outputDir, '1')))[0]).toBe(`${'a'.repeat(40)}.json`)
    const unknownReport = JSON.parse(await readFile(join(outputDir, '2', `${'b'.repeat(40)}.json`), 'utf8'))
    expect(unknownReport).toMatchObject({ mode: 'shadow', currentStatus: 'unrecognized' })
    expect(snapshotLoader).toHaveBeenCalledTimes(2)
  })

  it('continues the shard after a snapshot infrastructure failure and sanitizes the summary', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-shadow-failure-'))
    const repositories = [
      {
        repositoryId: 1,
        fullName: 'fixture/unavailable',
        url: 'https://github.com/fixture/unavailable',
        pushedAt: '2026-08-14T08:00:00Z',
        projectType: 'plugin' as const,
        topics: ['dsh-plugin'],
        defaultBranch: 'main',
      },
      {
        repositoryId: 2,
        fullName: 'fixture/unknown',
        url: 'https://github.com/fixture/unknown',
        pushedAt: '2026-08-14T08:00:00Z',
        projectType: 'unknown' as const,
        topics: ['dsh-plugin'],
        defaultBranch: 'main',
      },
    ]
    const snapshotLoader = vi.fn(async (repository: typeof repositories[number]): Promise<RepositoryStructureSnapshot> => {
      if (repository.repositoryId === 1) {
        throw new Error('request failed token=secret /Users/private/source')
      }
      return {
        repository: {
          id: repository.repositoryId,
          fullName: repository.fullName,
          url: repository.url,
          sourceSha: 'b'.repeat(40),
          sourcePushedAt: repository.pushedAt,
          isPrivate: false,
          archived: false,
          deleted: false,
          sizeKb: 100,
        },
        projectType: repository.projectType,
        topics: repository.topics,
        files: {},
        scans: {
          trivy: { status: 'passed', vulnerabilities: [], secrets: [] },
          osv: { status: 'passed', vulnerabilities: [] },
        },
      }
    })

    const summary = await runShadowBatch({ repositories, outputDir: root, target, snapshotLoader })

    expect(summary).toMatchObject({
      discovered: 2,
      reportsWritten: 1,
      loadFailures: [{
        repositoryId: 1,
        code: 'SNAPSHOT_LOAD_FAILED',
        reason: '仓库快照或扫描基础设施不可用',
      }],
    })
    expect(JSON.stringify(summary)).not.toMatch(/secret|\/Users\/private/)
    expect(snapshotLoader).toHaveBeenCalledTimes(2)
  })
})
