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

export async function resolvePinnedSourceSha(
  repository: ShadowCatalogRepository,
  {
    fetchImpl = fetch,
    token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN,
  }: {
    fetchImpl?: typeof fetch
    token?: string
  } = {},
): Promise<string> {
  const response = await fetchImpl(
    `${API_URL}/repositories/${repository.repositoryId}/commits/${encodeURIComponent(repository.defaultBranch)}`,
    { headers: getHeaders(token) },
  )
  if (!response.ok) {
    const remaining = response.headers.get('x-ratelimit-remaining')
    throw new Error(`GitHub commit request failed: ${response.status}; remaining=${remaining ?? 'unknown'}`)
  }
  const commit = await response.json() as GitHubCommitResponse
  if (!/^[a-f0-9]{40}$/i.test(commit.sha)) {
    throw new Error(`GitHub repository ${repository.repositoryId} returned an invalid source SHA`)
  }
  return commit.sha.toLowerCase()
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
