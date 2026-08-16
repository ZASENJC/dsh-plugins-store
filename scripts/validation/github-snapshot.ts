import type { ShadowCatalogRepository } from './shadow-runner'
import type { ScannerResults } from './scanner-adapters'
import type { RepositoryStructureSnapshot } from './structure-check'
import { resolveDshBundlePatchPath } from '../../src/lib/source-classification'

const API_URL = 'https://api.github.com'
export const MAX_STRUCTURAL_BLOB_BYTES = 1_000_000
export const MAX_STRUCTURAL_BYTES = 5_000_000

interface GitHubRepositoryResponse {
  id: number
  full_name: string
  html_url: string
  default_branch: string
  pushed_at: string
  private: boolean
  archived: boolean
  size: number
}

interface GitHubCommitResponse {
  sha: string
}

interface GitHubTreeEntry {
  path: string
  type: 'blob' | 'tree' | 'commit'
  sha: string
  size?: number
}

interface GitHubTreeResponse {
  truncated: boolean
  tree: GitHubTreeEntry[]
}

interface GitHubBlobResponse {
  encoding: string
  content: string
}

function getHeaders(token?: string): HeadersInit {
  return {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'dsh-plugins-store-validator',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function fetchJson<T>(
  fetchImpl: typeof fetch,
  path: string,
  token?: string,
): Promise<T> {
  const response = await fetchImpl(`${API_URL}${path}`, { headers: getHeaders(token) })
  if (!response.ok) throw new Error(`GitHub API request failed: ${response.status} ${path}`)
  return response.json() as Promise<T>
}

export function isStructuralContentPath(path: string): boolean {
  return /(^|\/)(package\.json|pnpm-lock\.yaml|package-lock\.json|yarn\.lock|bun\.lockb?|SKILL\.md|LICENSE(?:\..*)?|COPYING(?:\..*)?|cordis\.patch\.ya?ml|dsh\.bundle\.ya?ml|\.gitmodules|\.gitattributes|\.npmrc)$/i.test(path)
}

function decodeBlob(blob: GitHubBlobResponse, path: string): string {
  if (blob.encoding !== 'base64') throw new Error(`Unsupported GitHub blob encoding for ${path}`)
  return Buffer.from(blob.content.replace(/\s/g, ''), 'base64').toString('utf8')
}

export async function loadGitHubSnapshot(
  catalogRepository: ShadowCatalogRepository,
  {
    fetchImpl = fetch,
    token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN,
    sourceSha,
    scans,
  }: {
    fetchImpl?: typeof fetch
    token?: string
    sourceSha?: string
    scans: ScannerResults
  },
): Promise<RepositoryStructureSnapshot> {
  const repositoryId = catalogRepository.repositoryId
  const metadata = await fetchJson<GitHubRepositoryResponse>(fetchImpl, `/repositories/${repositoryId}`, token)
  if (metadata.id !== repositoryId) {
    throw new Error(`GitHub numeric ID mismatch: expected ${repositoryId}, received ${metadata.id}`)
  }
  const requestedRef = sourceSha ?? metadata.default_branch
  if (!requestedRef) throw new Error(`GitHub repository ${repositoryId} has no default branch`)
  if (sourceSha !== undefined && !/^[a-f0-9]{40}$/i.test(sourceSha)) {
    throw new Error(`GitHub repository ${repositoryId} baseline source SHA is invalid`)
  }
  const commit = await fetchJson<GitHubCommitResponse>(
    fetchImpl,
    `/repositories/${repositoryId}/commits/${encodeURIComponent(requestedRef)}`,
    token,
  )
  if (!/^[a-f0-9]{40}$/i.test(commit.sha)) throw new Error(`GitHub repository ${repositoryId} returned an invalid source SHA`)
  if (sourceSha !== undefined && commit.sha.toLowerCase() !== sourceSha.toLowerCase()) {
    throw new Error(`GitHub repository ${repositoryId} baseline source SHA did not resolve exactly`)
  }
  const tree = await fetchJson<GitHubTreeResponse>(
    fetchImpl,
    `/repositories/${repositoryId}/git/trees/${commit.sha}?recursive=1`,
    token,
  )
  if (tree.truncated) throw new Error(`GitHub tree for repository ${repositoryId} is truncated`)

  const files: Record<string, string> = {}
  const structuralBlobs: GitHubTreeEntry[] = []
  let structuralBytes = 0
  for (const entry of tree.tree) {
    if (entry.type !== 'blob' || entry.path.startsWith('/') || entry.path.includes('\0')) continue
    files[entry.path] = ''
    if (!isStructuralContentPath(entry.path)) continue
    const size = entry.size ?? 0
    if (size > MAX_STRUCTURAL_BLOB_BYTES) {
      throw new Error(`Structural blob exceeds size limit: ${entry.path}`)
    }
    structuralBytes += size
    if (structuralBytes > MAX_STRUCTURAL_BYTES) throw new Error('Structural blob total exceeds size limit')
    structuralBlobs.push(entry)
  }

  await Promise.all(structuralBlobs.map(async (entry) => {
    const blob = await fetchJson<GitHubBlobResponse>(
      fetchImpl,
      `/repositories/${repositoryId}/git/blobs/${entry.sha}`,
      token,
    )
    files[entry.path] = decodeBlob(blob, entry.path)
  }))

  const patchPath = resolveDshBundlePatchPath(files['package.json'])
  const patchEntry = patchPath === null
    ? undefined
    : tree.tree.find((entry) => entry.type === 'blob' && entry.path === patchPath)
  if (patchEntry && files[patchEntry.path] === '') {
    const size = patchEntry.size ?? 0
    if (size > MAX_STRUCTURAL_BLOB_BYTES) {
      throw new Error(`Structural blob exceeds size limit: ${patchEntry.path}`)
    }
    structuralBytes += size
    if (structuralBytes > MAX_STRUCTURAL_BYTES) throw new Error('Structural blob total exceeds size limit')
    const blob = await fetchJson<GitHubBlobResponse>(
      fetchImpl,
      `/repositories/${repositoryId}/git/blobs/${patchEntry.sha}`,
      token,
    )
    files[patchEntry.path] = decodeBlob(blob, patchEntry.path)
  }

  return {
    repository: {
      id: metadata.id,
      fullName: metadata.full_name,
      url: metadata.html_url,
      sourceSha: commit.sha,
      sourcePushedAt: metadata.pushed_at,
      isPrivate: metadata.private,
      archived: metadata.archived,
      deleted: false,
      sizeKb: metadata.size,
    },
    projectType: catalogRepository.projectType,
    topics: catalogRepository.topics,
    files,
    scans,
  }
}
