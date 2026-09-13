import { mkdtemp, readdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'

import {
  DEPLOY_MAX_ARCHIVE_BYTES,
  DEPLOY_MAX_ARCHIVE_ENTRIES,
  DEPLOY_MAX_EXTRACTED_BYTES,
  assertFitsDeployBudget,
  type PublishTreeMeasurement,
} from '../src/lib/publication-budget'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export async function measurePublishTree(treeRoot: string): Promise<PublishTreeMeasurement> {
  let files = 0
  let uncompressedBytes = 0
  const stack = [treeRoot]

  while (stack.length > 0) {
    const current = stack.pop()
    if (!current) continue
    const entries = await readdir(current, { withFileTypes: true })
    for (const entry of entries) {
      const path = join(current, entry.name)
      if (entry.isDirectory()) {
        stack.push(path)
        continue
      }
      if (!entry.isFile()) continue
      files += 1
      uncompressedBytes += (await stat(path)).size
    }
  }

  return { files, uncompressedBytes }
}

export async function verifyDistBudget(dist = resolve(root, 'dist')): Promise<PublishTreeMeasurement> {
  const measurement = await measurePublishTree(dist)
  const archiveDir = await mkdtemp(join(tmpdir(), 'dsh-dist-budget-'))
  const archivePath = join(archiveDir, 'site.tar.gz')

  try {
    const packed = spawnSync('tar', ['-C', dist, '-czf', archivePath, '.'], { encoding: 'utf8' })
    if (packed.status !== 0) {
      throw new Error(packed.stderr.trim() || `tar failed with exit ${packed.status ?? 'unknown'}`)
    }
    const compressedBytes = (await stat(archivePath)).size
    const complete = { ...measurement, compressedBytes }
    assertFitsDeployBudget(complete)
    console.log(
      `Publication budget ok: ${measurement.files} files, `
      + `${(measurement.uncompressedBytes / (1024 * 1024)).toFixed(1)} MiB uncompressed, `
      + `${(compressedBytes / (1024 * 1024)).toFixed(1)} MiB compressed `
      + `(server ceiling ${DEPLOY_MAX_ARCHIVE_ENTRIES} files / `
      + `${DEPLOY_MAX_EXTRACTED_BYTES / (1024 * 1024)} MiB extracted / `
      + `${DEPLOY_MAX_ARCHIVE_BYTES / (1024 * 1024)} MiB tar.gz)`,
    )
    return complete
  } finally {
    await rm(archiveDir, { recursive: true, force: true })
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  await verifyDistBudget(resolve(root, process.argv[2] ?? 'dist'))
}
