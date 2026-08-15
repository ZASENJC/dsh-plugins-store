import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  buildCatalog,
  VERIFIED_REPOSITORY_OVERRIDES,
  type GitHubRepository,
} from '../src/lib/catalog'
import { classifyRepository } from '../src/lib/classification'
import {
  extractAwesomeRepositoryNames,
  extractVerifiedRepositoryNames,
} from '../src/lib/github-content'
import { extractInstallReference, type InstallReference } from '../src/lib/install-reference'
import { parseValidationFeed } from '../src/lib/validation'
import {
  buildSearchQuery,
  fetchAllSearchRepositories,
  type SearchPage,
  type SearchPartition,
  type SearchRequestOptions,
} from '../src/lib/github-discovery'

const SEARCH_URL = 'https://api.github.com/search/repositories'
const API_URL = 'https://api.github.com'
const AWESOME_REPOSITORY = 'AdamPlatin123/awesome-dsh-plugins'
const VERIFY_REPOSITORY = 'qing3a/dsh-plugin-verify'
const README_CONCURRENCY = 8
const README_TIMEOUT_MS = 12_000
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputPath = resolve(root, 'src/data/catalog.json')
const validationPath = resolve(root, 'src/data/validation.json')

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
  const response = await fetch(`${SEARCH_URL}?${query}`, { headers: getHeaders() })
  if (!response.ok) {
    const remaining = response.headers.get('x-ratelimit-remaining')
    throw new Error(`GitHub API 请求失败：${response.status} ${response.statusText}，剩余额度 ${remaining ?? '未知'}`)
  }
  return response.json() as Promise<SearchPage>
}

async function fetchRepositories() {
  return fetchAllSearchRepositories((page, partition, request) => fetchPage(page, partition, request))
}

async function sync() {
  const { repositories, reportedByGitHub } = await fetchRepositories()
  const validationRecords = parseValidationFeed(JSON.parse(await readFile(validationPath, 'utf8')))
  const [awesomeResponse, verifyResponse] = await Promise.all([
    fetchRenderedReadme(AWESOME_REPOSITORY),
    fetchRenderedReadme(VERIFY_REPOSITORY),
  ])
  if (!awesomeResponse.ok || !verifyResponse.ok) {
    throw new Error(
      `目录清单请求失败：Awesome ${awesomeResponse.status}，Verify ${verifyResponse.status}`,
    )
  }
  const awesomeRepositoryNames = extractAwesomeRepositoryNames(await awesomeResponse.text())
  const verifiedRepositoryNames = extractVerifiedRepositoryNames(await verifyResponse.text())
  const installReferences = await fetchInstallReferences(repositories)
  const generatedAt = new Date().toISOString()
  const catalog = buildCatalog(
    repositories,
    generatedAt,
    reportedByGitHub,
    awesomeRepositoryNames,
    verifiedRepositoryNames,
    validationRecords,
    installReferences,
  )
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8')

  console.log(`Awesome 有效收录 ${awesomeRepositoryNames.size} 个仓库名；商店匹配 ${catalog.repositories.filter((repository) => repository.awesomeListed).length} 个`)
  console.log(`Verified 有效收录 ${verifiedRepositoryNames.size} 个仓库；站内覆盖 ${VERIFIED_REPOSITORY_OVERRIDES.size} 个；商店匹配 ${catalog.stats.verified} 个`)
  console.log(`验证状态文件匹配 ${validationRecords.size} 个仓库；当前完整验证 ${catalog.stats.validationStatuses.verified ?? 0} 个`)
  console.log(`README 安装特征匹配 ${installReferences.size} 个仓库；失败或无明确命令不影响目录同步`)
  console.log(`已同步 ${catalog.stats.fetched}/${reportedByGitHub} 个仓库到 ${outputPath}`)
}

await sync()
