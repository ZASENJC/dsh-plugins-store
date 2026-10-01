import { lstat, readFile, readdir } from 'node:fs/promises'
import { join, posix, resolve } from 'node:path'

import type { ScannerResults } from './scanner-adapters'
import type { ShadowCatalogRepository } from './shadow-runner'
import type { RepositoryStructureSnapshot } from './structure-check'
import { resolveDshBundlePatchPath } from '../../src/lib/source-classification'
import {
  isStructuralContentPath,
  MAX_STRUCTURAL_BLOB_BYTES,
  MAX_STRUCTURAL_BYTES,
} from './github-snapshot'

const API_URL = 'https://api.github.com'
const COMMIT_REQUEST_TIMEOUT_MS = 30_000
const TRANSIENT_RETRY_DELAYS_MS = [5_000, 15_000, 30_000, 60_000, 60_000] as const

interface GitHubCommitResponse {
  sha: string
}

function getHeaders(token?: string): HeadersInit {
  return {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'dsh-plugins-store-validator',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => {
    setTimeout(resolveSleep, ms)
  })
}

function describeThrown(error: unknown): string {
  if (error instanceof Error) {
    if (error.name && error.message && error.message !== error.name) {
      return `${error.name}: ${error.message}`
    }
    return error.message || error.name || 'network error'
  }
  return String(error)
}

function isTransientStatus(status: number): boolean {
  return status === 408 || status >= 500
}

export async function resolvePinnedSourceSha(
  repository: ShadowCatalogRepository,
  {
    fetchImpl = fetch,
    token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN,
    sleep = defaultSleep,
    warn = (message: string) => {
      console.warn(message)
    },
    timeoutSignal = (ms: number) => AbortSignal.timeout(ms),
  }: {
    fetchImpl?: typeof fetch
    token?: string
    sleep?: (ms: number) => Promise<void>
    warn?: (message: string) => void
    timeoutSignal?: (ms: number) => AbortSignal
  } = {},
): Promise<string> {
  const path = `/repositories/${repository.repositoryId}/commits/${encodeURIComponent(repository.defaultBranch)}`
  let transientRetries = 0

  async function pauseForTransient(detail: string): Promise<boolean> {
    const waitMs = TRANSIENT_RETRY_DELAYS_MS[transientRetries]
    if (waitMs === undefined) return false
    transientRetries += 1
    const seconds = Math.ceil(waitMs / 1000)
    warn(`GitHub commit request failed (${detail}) for ${path}; waiting ${seconds}s before retry ${transientRetries}/${TRANSIENT_RETRY_DELAYS_MS.length}`)
    await sleep(waitMs)
    return true
  }

  while (true) {
    let response: Response
    try {
      response = await fetchImpl(`${API_URL}${path}`, {
        headers: getHeaders(token),
        signal: timeoutSignal(COMMIT_REQUEST_TIMEOUT_MS),
      })
    } catch (error) {
      const detail = describeThrown(error)
      if (await pauseForTransient(detail)) continue
      throw new Error(`GitHub commit request failed: ${detail}; remaining=unknown`)
    }

    if (response.ok) {
      const commit = await response.json() as GitHubCommitResponse
      if (!/^[a-f0-9]{40}$/i.test(commit.sha)) {
        throw new Error(`GitHub repository ${repository.repositoryId} returned an invalid source SHA`)
      }
      return commit.sha.toLowerCase()
    }

    if (isTransientStatus(response.status) && await pauseForTransient(String(response.status))) continue
    const remaining = response.headers.get('x-ratelimit-remaining')
    throw new Error(`GitHub commit request failed: ${response.status}; remaining=${remaining ?? 'unknown'}`)
  }
}

async function inventoryFiles(sourceDirectory: string): Promise<Record<string, string>> {
  const files: Record<string, string> = {}
  let structuralBytes = 0

  async function readStructuralFile(relativePath: string): Promise<void> {
    const absolutePath = join(sourceDirectory, relativePath)
    const stats = await lstat(absolutePath)
    if (!stats.isFile()) return
    if (stats.size > MAX_STRUCTURAL_BLOB_BYTES) {
      throw new Error(`Structural file exceeds size limit: ${relativePath}`)
    }
    structuralBytes += stats.size
    if (structuralBytes > MAX_STRUCTURAL_BYTES) throw new Error('Structural file total exceeds size limit')
    files[relativePath] = await readFile(absolutePath, 'utf8')
  }

  async function visit(relativeDirectory: string): Promise<void> {
    const directory = join(sourceDirectory, relativeDirectory)
    const entries = (await readdir(directory, { withFileTypes: true }))
      .sort((left, right) => left.name.localeCompare(right.name))
    for (const entry of entries) {
      const relativePath = relativeDirectory
        ? posix.join(relativeDirectory, entry.name)
        : entry.name
      if (entry.isDirectory()) {
        await visit(relativePath)
        continue
      }
      if (!entry.isFile()) continue
      files[relativePath] = ''
      if (!isStructuralContentPath(relativePath)) continue
      await readStructuralFile(relativePath)
    }
  }

  await visit('')
  const patchPath = resolveDshBundlePatchPath(files['package.json'])
  if (patchPath !== null && files[patchPath] === '') await readStructuralFile(patchPath)
  return files
}

export async function loadExtractedSnapshot(
  repository: ShadowCatalogRepository,
  {
    sourceSha,
    sourceDirectory,
    scans,
  }: {
    sourceSha: string
    sourceDirectory: string
    scans: ScannerResults
  },
): Promise<RepositoryStructureSnapshot> {
  if (!/^[a-f0-9]{40}$/i.test(sourceSha)) throw new Error('Repository source SHA is invalid')
  return {
    repository: {
      id: repository.repositoryId,
      fullName: repository.fullName,
      url: repository.url,
      sourceSha: sourceSha.toLowerCase(),
      sourcePushedAt: repository.pushedAt,
      isPrivate: false,
      archived: repository.archived,
      deleted: false,
      sizeKb: repository.sizeKb,
    },
    projectType: repository.projectType,
    topics: repository.topics,
    files: await inventoryFiles(resolve(sourceDirectory)),
    scans,
  }
}
