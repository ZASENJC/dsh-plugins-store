import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  buildCatalog,
  VERIFIED_REPOSITORY_OVERRIDES,
  type GitHubRepository,
} from '../src/lib/catalog'
import {
  extractAwesomeRepositoryNames,
  extractVerifiedRepositoryNames,
} from '../src/lib/github-content'

const SEARCH_URL = 'https://api.github.com/search/repositories'
const API_URL = 'https://api.github.com'
const AWESOME_REPOSITORY = 'AdamPlatin123/awesome-dsh-plugins'
const VERIFY_REPOSITORY = 'qing3a/dsh-plugin-verify'
const PAGE_SIZE = 100
const MAX_SEARCH_RESULTS = 1_000
const MAX_SEARCH_PASSES = 3
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputPath = resolve(root, 'src/data/catalog.json')

interface SearchResponse {
  total_count: number
  incomplete_results: boolean
  items: GitHubRepository[]
}

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

async function fetchPage(page: number): Promise<SearchResponse> {
  const query = new URLSearchParams({
    q: 'topic:dsh-plugin',
    sort: 'stars',
    order: 'desc',
    per_page: String(PAGE_SIZE),
    page: String(page),
  })
  const response = await fetch(`${SEARCH_URL}?${query}`, { headers: getHeaders() })
  if (!response.ok) {
    const remaining = response.headers.get('x-ratelimit-remaining')
    throw new Error(`GitHub API 请求失败：${response.status} ${response.statusText}，剩余额度 ${remaining ?? '未知'}`)
  }
  return response.json() as Promise<SearchResponse>
}

async function fetchRepositories() {
  const repositories = new Map<number, GitHubRepository>()
  let reportedByGitHub = 0
  let availableCount = 0

  for (let attempt = 1; attempt <= MAX_SEARCH_PASSES; attempt += 1) {
    const firstPage = await fetchPage(1)
    reportedByGitHub = Math.max(reportedByGitHub, firstPage.total_count)
    availableCount = Math.min(reportedByGitHub, MAX_SEARCH_RESULTS)
    const pageCount = Math.ceil(availableCount / PAGE_SIZE)
    let incompleteResults = firstPage.incomplete_results

    for (const repository of firstPage.items) repositories.set(repository.id, repository)
    for (let page = 2; page <= pageCount; page += 1) {
      const response = await fetchPage(page)
      incompleteResults ||= response.incomplete_results
      for (const repository of response.items) repositories.set(repository.id, repository)
    }

    if (!incompleteResults && repositories.size >= availableCount) {
      return { repositories: [...repositories.values()], reportedByGitHub }
    }

    console.warn(`GitHub Search 第 ${attempt} 轮仅取得 ${repositories.size}/${availableCount} 个唯一仓库，正在合并重试`)
  }

  throw new Error(`GitHub Search 连续 ${MAX_SEARCH_PASSES} 轮仍不完整：${repositories.size}/${availableCount}，保留现有目录`)
}

async function sync() {
  const { repositories, reportedByGitHub } = await fetchRepositories()
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
  const generatedAt = new Date().toISOString()
  const catalog = buildCatalog(
    repositories,
    generatedAt,
    reportedByGitHub,
    awesomeRepositoryNames,
    verifiedRepositoryNames,
  )
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8')

  const warning = reportedByGitHub > MAX_SEARCH_RESULTS
    ? `；警告：GitHub Search 上限为 ${MAX_SEARCH_RESULTS}，需要启用分段查询`
    : ''
  console.log(`Awesome 有效收录 ${awesomeRepositoryNames.size} 个仓库名；商店匹配 ${catalog.repositories.filter((repository) => repository.awesomeListed).length} 个`)
  console.log(`Verified 有效收录 ${verifiedRepositoryNames.size} 个仓库；站内覆盖 ${VERIFIED_REPOSITORY_OVERRIDES.size} 个；商店匹配 ${catalog.stats.verified} 个`)
  console.log(`已同步 ${catalog.stats.fetched}/${reportedByGitHub} 个仓库到 ${outputPath}${warning}`)
}

await sync()
