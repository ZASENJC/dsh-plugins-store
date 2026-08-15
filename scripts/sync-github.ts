import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  buildCatalog,
  VERIFIED_REPOSITORY_OVERRIDES,
  type GitHubRepository,
} from '../src/lib/catalog'
import { classifyRepository } from '../src/lib/classification'
import { extractVerifiedRepositoryNames } from '../src/lib/github-content'
import { extractInstallReference, type InstallReference } from '../src/lib/install-reference'
import {
  parseSourceClassificationArchive,
  validationRecordsFromArchive,
  type SourceClassificationArchive,
} from '../src/lib/source-classification-archive'
import {
  buildSearchQuery,
  fetchAllSearchRepositories,
  type SearchPage,
  type SearchPartition,
  type SearchRequestOptions,
} from '../src/lib/github-discovery'

const SEARCH_URL = 'https://api.github.com/search/repositories'
const API_URL = 'https://api.github.com'
const VERIFY_REPOSITORY = 'qing3a/dsh-plugin-verify'
const README_CONCURRENCY = 8
const README_TIMEOUT_MS = 12_000
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputPath = resolve(root, 'src/data/catalog.json')
const classificationArchivePath = resolve(
  process.env.CLASSIFICATION_ARCHIVE_PATH ?? join(root, 'src/data/source-classification.json'),
)

function getHeaders(accept = 'application/vnd.github+json'): HeadersInit {
  const headers: Record<string, string> = {
    Accept: accept,
    'User-Agent': 'dsh-plugin-store-sync',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

async function fetchRenderedReadme(fullName: string): Promise<Response> {
  const repositoryPath = fullName.split('/').map(encodeURIComponent).join('/')
  return fetch(`${API_URL}/repos/${repositoryPath}/readme`, {
    headers: getHeaders('application/vnd.github.html+json'),
  })
}

function canHaveInstallReference(repository: GitHubRepository): boolean {
  const classification = classifyRepository({
    fullName: repository.full_name,
    name: repository.name,
    description: repository.description ?? '',
    topics: repository.topics ?? [],
  })
  return new Set(['plugin', 'skill', 'collection', 'channel']).has(classification.projectType)
}

async function fetchRawReadme(repository: GitHubRepository): Promise<string | null> {
  const repositoryPath = repository.full_name.split('/').map(encodeURIComponent).join('/')
  const branch = encodeURIComponent(repository.default_branch || 'main')
  for (const filename of ['README.md', 'README', 'readme.md']) {
    try {
      const response = await fetch(
        `https://raw.githubusercontent.com/${repositoryPath}/${branch}/${filename}`,
        { signal: AbortSignal.timeout(README_TIMEOUT_MS) },
      )
      if (response.ok) return response.text()
    } catch {
      // README evidence is best-effort and must never block catalog publication.
    }
  }
  return null
}

async function fetchInstallReferences(repositories: GitHubRepository[]): Promise<ReadonlyMap<number, InstallReference>> {
  const candidates = repositories.filter(canHaveInstallReference)
  const references = new Map<number, InstallReference>()
  let cursor = 0

  async function worker() {
    while (cursor < candidates.length) {
      const repository = candidates[cursor]
      cursor += 1
      const readme = await fetchRawReadme(repository)
      if (readme === null) continue
      const reference = extractInstallReference(readme)
      if (reference.status !== 'unrecognized') references.set(repository.id, reference)
    }
  }

  await Promise.all(Array.from({ length: Math.min(README_CONCURRENCY, candidates.length) }, () => worker()))
  return references
}

async function fetchPage(
  page: number,
  partition: SearchPartition,
  request: SearchRequestOptions,
): Promise<SearchPage> {
  const query = buildSearchQuery(page, partition, request)
  while (true) {
    const response = await fetch(`${SEARCH_URL}?${query}`, { headers: getHeaders() })
    if (response.ok) return response.json() as Promise<SearchPage>

    const remaining = response.headers.get('x-ratelimit-remaining')
    const retryAfter = Number(response.headers.get('retry-after'))
    const resetAt = Number(response.headers.get('x-ratelimit-reset'))
    const rateLimited = response.status === 429 || (response.status === 403 && remaining === '0')
    if (!rateLimited) {
      throw new Error(`GitHub API 请求失败：${response.status} ${response.statusText}，剩余额度 ${remaining ?? '未知'}`)
    }

    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : Number.isFinite(resetAt) && resetAt > 0
        ? Math.max(1000, resetAt * 1000 - Date.now() + 1000)
        : 60_000
    console.warn(`GitHub Search 达到速率限制，等待 ${Math.ceil(waitMs / 1000)} 秒后继续`)
    await new Promise((resolve) => setTimeout(resolve, waitMs))
  }
}

async function fetchRepositories() {
  return fetchAllSearchRepositories((page, partition, request) => fetchPage(page, partition, request))
}

async function readClassificationArchive(): Promise<SourceClassificationArchive | null> {
  try {
    return parseSourceClassificationArchive(JSON.parse(await readFile(classificationArchivePath, 'utf8')))
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      console.warn('源码分类档案暂不可用，目录同步回退到 topic 全量目录')
      return null
    }
    console.warn('源码分类档案无效，目录同步回退到 topic 全量目录')
    return null
  }
}

async function sync() {
  const { repositories, allRepositories, reportedByGitHub } = await fetchRepositories()
  const classificationArchive = await readClassificationArchive()
  const archiveValidationRecords = validationRecordsFromArchive(classificationArchive)
  const validationRecords = new Map(archiveValidationRecords)
  for (const [repositoryId, record] of archiveValidationRecords) {
    const repository = allRepositories.find(({ id }) => id === repositoryId)
    if (!repository || record.sourcePushedAt !== repository.pushed_at) validationRecords.delete(repositoryId)
  }
  const verifyResponse = await fetchRenderedReadme(VERIFY_REPOSITORY)
  if (!verifyResponse.ok) {
    throw new Error(`验证目录请求失败：Verify ${verifyResponse.status}`)
  }
  const verifiedRepositoryNames = extractVerifiedRepositoryNames(await verifyResponse.text())
  const catalogRepositories = classificationArchive === null
    ? repositories
    : allRepositories.filter((repository) => classificationArchive.records.some((record) => (
      record.repositoryId === repository.id && record.sourcePushedAt === repository.pushed_at
    )))
  const installReferences = await fetchInstallReferences(catalogRepositories)
  const generatedAt = new Date().toISOString()
  const catalog = buildCatalog(
    catalogRepositories,
    generatedAt,
    reportedByGitHub,
    verifiedRepositoryNames,
    validationRecords,
    installReferences,
    classificationArchive,
  )
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8')

  const discoveryPath = process.env.DISCOVERY_OUTPUT_PATH
  if (discoveryPath) {
    await mkdir(dirname(resolve(discoveryPath)), { recursive: true })
    await writeFile(resolve(discoveryPath), `${JSON.stringify({
      schemaVersion: 1,
      generatedAt,
      reportedByGitHub,
      repositories: allRepositories,
    }, null, 2)}\n`, 'utf8')
  }

  console.log(`Verified 有效收录 ${verifiedRepositoryNames.size} 个仓库；站内覆盖 ${VERIFIED_REPOSITORY_OVERRIDES.size} 个；商店匹配 ${catalog.stats.verified} 个`)
  console.log(`验证状态文件匹配 ${validationRecords.size} 个仓库；当前完整验证 ${catalog.stats.validationStatuses.verified ?? 0} 个`)
  console.log(`README 安装特征匹配 ${installReferences.size} 个仓库；失败或无明确命令不影响目录同步`)
  console.log(`源码分类档案${classificationArchive ? '已应用' : '尚未可用，已回退 topic 全量目录'}；活动发现快照 ${allRepositories.length} 个；目录收录 ${catalog.stats.fetched}/${reportedByGitHub} 个仓库到 ${outputPath}`)
}

await sync()
