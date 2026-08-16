import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { loadExtractedSnapshot, resolvePinnedSourceSha } from './archive-snapshot'

const temporaryRoots: string[] = []
const repository = {
  repositoryId: 42,
  fullName: 'owner/example-plugin',
  url: 'https://github.com/owner/example-plugin',
  pushedAt: '2026-08-14T08:00:00Z',
  projectType: 'plugin' as const,
  topics: ['dsh-plugin', 'tool'],
  defaultBranch: 'main',
  archived: false,
  sizeKb: 120,
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('archive-backed GitHub snapshot', () => {
  it('resolves the exact default-branch SHA with one numeric-ID REST request', async () => {
    const sourceSha = 'a'.repeat(40)
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ sha: sourceSha }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }))

    await expect(resolvePinnedSourceSha(repository, { fetchImpl })).resolves.toBe(sourceSha)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.github.com/repositories/42/commits/main',
      expect.objectContaining({ headers: expect.any(Object) }),
    )
  })

  it('builds file existence and structural content from the extracted fixed-SHA archive', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-archive-snapshot-'))
    temporaryRoots.push(root)
    await mkdir(join(root, 'lib'), { recursive: true })
    await mkdir(join(root, 'config'), { recursive: true })
    await writeFile(join(root, 'package.json'), JSON.stringify({
      main: './lib/index.js',
      dsh: { bundle: { patch: './config/custom.cordis.yml' } },
    }))
    await writeFile(join(root, '.npmrc'), '@private:registry=https://npm.pkg.github.com/\n')
    await writeFile(join(root, 'lib/index.js'), 'export default {}')
    await writeFile(join(root, 'config/custom.cordis.yml'), '- insert: []\n')

    const snapshot = await loadExtractedSnapshot(repository, {
      sourceSha: 'b'.repeat(40),
      sourceDirectory: root,
      scans: {
        trivy: { status: 'passed', vulnerabilities: [], secrets: [] },
        osv: { status: 'passed', vulnerabilities: [] },
        gitleaks: { status: 'passed', secrets: [] },
      },
    })

    expect(snapshot.repository).toMatchObject({
      id: 42,
      fullName: 'owner/example-plugin',
      sourceSha: 'b'.repeat(40),
      archived: false,
      sizeKb: 120,
    })
    expect(snapshot.files['package.json']).toContain('custom.cordis.yml')
    expect(snapshot.files['.npmrc']).toBe('@private:registry=https://npm.pkg.github.com/\n')
    expect(snapshot.files['lib/index.js']).toBe('')
    expect(snapshot.files['config/custom.cordis.yml']).toBe('- insert: []\n')
  })
})
