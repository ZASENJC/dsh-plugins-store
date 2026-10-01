import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  buildCatalog,
  limitPublishedCatalog,
  VERIFIED_REPOSITORY_OVERRIDES,
  type Catalog,
  type GitHubRepository,
} from '../src/lib/catalog'
import { MAX_PUBLISHED_REPOSITORIES } from '../src/lib/publication-budget'
import { extractVerifiedRepositoryNames } from '../src/lib/github-content'
import {
  canExtractInstallReference,
  extractInstallReference,
  type InstallReference,
} from '../src/lib/install-reference'
import {
  currentSourceClassification,
  filterCatalogRepositoriesByArchive,
  isCurrentSourceClassificationArchive,
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
    'User-Agent': 'dsh-plugins-store-sync',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

export interface GitHubFetchDependencies {
  fetchImpl?: (input: string, init?: RequestInit) => Promise<Response>
  sleep?: (ms: number) => Promise<void>
  warn?: (message: string) => void
  now?: () => number
  timeoutSignal?: (ms: number) => AbortSignal
}

function resolveGitHubFetch(dependencies: GitHubFetchDependencies = {}) {
  return {
    fetchImpl: dependencies.fetchImpl ?? fetch,
    sleep: dependencies.sleep ?? ((ms: number) => new Promise<void>((resolveSleep) => {
      setTimeout(resolveSleep, ms)
    })),
    warn: dependencies.warn ?? ((message: string) => {
      console.warn(message)
    }),
    now: dependencies.now ?? Date.now,
    timeoutSignal: dependencies.timeoutSignal ?? ((ms: number) => AbortSignal.timeout(ms)),
  }
}

const SEARCH_REQUEST_TIMEOUT_MS = 30_000
const TRANSIENT_RETRY_DELAYS_MS = [5_000, 15_000, 30_000, 60_000, 60_000] as const

function describeThrown(error: unknown): string {
  if (error instanceof Error) {
    if (error.name && error.message && error.message !== error.name) {
      return `${error.name}: ${error.message}`
    }
    return error.message || error.name || '网络错误'
  }
  return String(error)
}

function transientRetryWarning(detail: string, waitMs: number, attempt: number): string {
  const seconds = Math.ceil(waitMs / 1000)
  return `GitHub Search 请求失败（${detail}），等待 ${seconds} 秒后重试（第 ${attempt}/${TRANSIENT_RETRY_DELAYS_MS.length} 次）`
}

function githubHttpError(response: Response): Error {
  const remaining = response.headers.get('x-ratelimit-remaining')
  return new Error(`GitHub API 请求失败：${response.status} ${response.statusText}，剩余额度 ${remaining ?? '未知'}`)
}

function isRateLimited(response: Response): boolean {
  const remaining = response.headers.get('x-ratelimit-remaining')
  return response.status === 429 || (response.status === 403 && remaining === '0')
}

function isTransientStatus(status: number): boolean {
  return status === 408 || status >= 500
}

function rateLimitWaitMs(response: Response, now: number): number {
  const retryAfter = Number(response.headers.get('retry-after'))
  const resetAt = Number(response.headers.get('x-ratelimit-reset'))
  if (Number.isFinite(retryAfter) && retryAfter > 0) return retryAfter * 1000
  if (Number.isFinite(resetAt) && resetAt > 0) {
    return Math.max(1_000, resetAt * 1000 - now + 1_000)
  }
  return 60_000
}

export async function fetchRenderedReadme(
  fullName: string,
  dependencies: GitHubFetchDependencies = {},
): Promise<Response> {
  const { fetchImpl, timeoutSignal } = resolveGitHubFetch(dependencies)
  const repositoryPath = fullName.split('/').map(encodeURIComponent).join('/')
  return fetchImpl(`${API_URL}/repos/${repositoryPath}/readme`, {
    headers: getHeaders('application/vnd.github.html+json'),
    signal: timeoutSignal(README_TIMEOUT_MS),
  })
}

function canHaveInstallReference(
  repository: GitHubRepository,
  classificationArchive: SourceClassificationArchive | null,
): boolean {
  const sourceClassification = currentSourceClassification({
    repositoryId: repository.id,
    pushedAt: repository.pushed_at,
  }, classificationArchive)
  if (sourceClassification === undefined) return false
  return canExtractInstallReference({
    fullName: repository.full_name,
    name: repository.name,
    description: repository.description ?? '',
    topics: repository.topics ?? [],
  }, sourceClassification)
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

async function fetchInstallReferences(
  repositories: GitHubRepository[],
  classificationArchive: SourceClassificationArchive | null,
): Promise<ReadonlyMap<number, InstallReference>> {
  const candidates = repositories.filter((repository) => (
    canHaveInstallReference(repository, classificationArchive)
  ))
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

export async function fetchPage(
  page: number,
  partition: SearchPartition,
  request: SearchRequestOptions,
  dependencies: GitHubFetchDependencies = {},
): Promise<SearchPage> {
  const { fetchImpl, sleep, warn, now, timeoutSignal } = resolveGitHubFetch(dependencies)
  const query = buildSearchQuery(page, partition, request)
  const url = `${SEARCH_URL}?${query}`
  let transientRetries = 0

  async function pauseForTransient(detail: string): Promise<boolean> {
    const waitMs = TRANSIENT_RETRY_DELAYS_MS[transientRetries]
    if (waitMs === undefined) return false
    transientRetries += 1
    warn(transientRetryWarning(detail, waitMs, transientRetries))
    await sleep(waitMs)
    return true
  }

  while (true) {
    let response: Response
    try {
      response = await fetchImpl(url, {
        headers: getHeaders(),
        signal: timeoutSignal(SEARCH_REQUEST_TIMEOUT_MS),
      })
    } catch (error) {
      const detail = describeThrown(error)
      if (await pauseForTransient(detail)) continue
      throw new Error(`GitHub API 请求失败：${detail}，剩余额度 未知`)
    }

    if (response.ok) return response.json() as Promise<SearchPage>

    if (isRateLimited(response)) {
      const waitMs = rateLimitWaitMs(response, now())
      warn(`GitHub Search 达到速率限制，等待 ${Math.ceil(waitMs / 1000)} 秒后继续`)
      await sleep(waitMs)
      continue
    }

    if (isTransientStatus(response.status)) {
      const detail = `${response.status} ${response.statusText}`
      if (await pauseForTransient(detail)) continue
      throw githubHttpError(response)
    }

    throw githubHttpError(response)
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
      console.warn('源码分类档案暂不可用，目录同步将严格关闭未分类项目的公开准入')
      return null
    }
    console.warn('源码分类档案无效，目录同步将严格关闭未分类项目的公开准入')
    return null
  }
}

async function readHistoricalVerifiedRepositoryNames(): Promise<Set<string>> {
  try {
    const response = await fetchRenderedReadme(VERIFY_REPOSITORY)
    if (!response.ok) {
      console.warn(`Verified 历史目录暂不可用：${response.status}；继续使用当前源码分类和验证档案`)
      return new Set()
    }
    return extractVerifiedRepositoryNames(await response.text())
  } catch (error) {
    console.warn(`Verified 历史目录读取失败；继续使用当前源码分类和验证档案：${String(error)}`)
    return new Set()
  }
}

async function readPreviousCatalog(): Promise<Catalog | null> {
  try {
    return JSON.parse(await readFile(outputPath, 'utf8')) as Catalog
  } catch (error) {
    console.warn(`上一份目录不可用，Star 趋势将从当前刷新重新积累：${String(error)}`)
    return null
  }
}

async function sync() {
  const previousCatalog = await readPreviousCatalog()
  const { repositories, allRepositories, reportedByGitHub } = await fetchRepositories()
  const classificationArchive = await readClassificationArchive()
  const currentClassificationArchive = isCurrentSourceClassificationArchive(classificationArchive)
    ? classificationArchive
    : null
  const validationRecords = validationRecordsFromArchive(currentClassificationArchive)
  const verifiedRepositoryNames = await readHistoricalVerifiedRepositoryNames()
  const catalogRepositories = filterCatalogRepositoriesByArchive(allRepositories, currentClassificationArchive)
  const installReferences = currentClassificationArchive === null
    ? new Map<number, InstallReference>()
    : await fetchInstallReferences(catalogRepositories, currentClassificationArchive)
  const generatedAt = new Date().toISOString()
  const refreshedCatalog = buildCatalog(
    catalogRepositories,
    generatedAt,
    reportedByGitHub,
    verifiedRepositoryNames,
    validationRecords,
    installReferences,
    currentClassificationArchive,
    previousCatalog,
  )
  const catalog = limitPublishedCatalog(
    currentClassificationArchive === null && previousCatalog !== null
      ? previousCatalog
      : refreshedCatalog,
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
  const archiveState = currentClassificationArchive
    ? '已应用'
    : previousCatalog
      ? '缺失或版本过期，未接纳新项目并保留最后有效目录'
      : '缺失或版本过期，已按 fail-closed 规则停止公开准入'
  console.log(`源码分类档案${archiveState}；Topic 候选 ${repositories.length} 个；活动发现快照 ${allRepositories.length} 个；目录收录 ${catalog.stats.fetched}/${reportedByGitHub} 个仓库（发布上限 ${MAX_PUBLISHED_REPOSITORIES}）到 ${outputPath}`)
}

const entrypoint = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (import.meta.url === entrypoint) {
  await sync()
}
