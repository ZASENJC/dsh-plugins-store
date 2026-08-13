import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildCatalog, type GitHubRepository } from '../src/lib/catalog'

const SEARCH_URL = 'https://api.github.com/search/repositories'
const PAGE_SIZE = 100
const MAX_SEARCH_RESULTS = 1_000
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputPath = resolve(root, 'src/data/catalog.json')

interface SearchResponse {
  total_count: number
  incomplete_results: boolean
  items: GitHubRepository[]
}

function getHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'dsh-plugin-store-sync',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
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

async function sync() {
  const firstPage = await fetchPage(1)
  const availableCount = Math.min(firstPage.total_count, MAX_SEARCH_RESULTS)
  const pageCount = Math.ceil(availableCount / PAGE_SIZE)
  const pages: GitHubRepository[][] = [firstPage.items]

  for (let page = 2; page <= pageCount; page += 1) {
    const response = await fetchPage(page)
    pages.push(response.items)
  }

  const catalog = buildCatalog(pages.flat(), new Date().toISOString(), firstPage.total_count)
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8')

  const warning = firstPage.total_count > MAX_SEARCH_RESULTS
    ? `；警告：GitHub Search 上限为 ${MAX_SEARCH_RESULTS}，需要启用分段查询`
    : ''
  console.log(`已同步 ${catalog.stats.fetched}/${firstPage.total_count} 个仓库到 ${outputPath}${warning}`)
}

await sync()
