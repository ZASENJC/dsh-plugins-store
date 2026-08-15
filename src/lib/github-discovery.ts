import {
  normalizeTopic,
  classifyRepository,
} from './classification'
import type { GitHubRepository } from './catalog'

export type SearchRepository = GitHubRepository

export const DISCOVERY_QUERY = 'topic:dsh-plugin topic:deepseek-harness archived:false fork:false'
export const SEARCH_PAGE_SIZE = 100
export const MAX_RESULTS_PER_QUERY = 1_000

const DEFAULT_MAX_ATTEMPTS = 3

export interface SearchPartition {
  createdStart?: string
  createdEnd?: string
  starsStart?: number
  starsEnd?: number
}

export interface SearchPage {
  total_count: number
  incomplete_results: boolean
  items: SearchRepository[]
}

export interface SearchRequestOptions {
  sort: 'stars' | 'created'
  order: 'asc' | 'desc'
}

export type SearchPageFetcher = (
  page: number,
  partition: SearchPartition,
  request: SearchRequestOptions,
) => Promise<SearchPage>

export interface FetchAllSearchOptions {
  maxResultsPerQuery?: number
  pageSize?: number
  maxAttempts?: number
  initialDateStart?: string
  initialDateEnd?: string
}

export interface FetchAllSearchResult {
  repositories: SearchRepository[]
  reportedByGitHub: number
}

export function buildSearchQuery(
  page: number,
  partition: SearchPartition = {},
  request: SearchRequestOptions = { sort: 'stars', order: 'desc' },
): URLSearchParams {
  const qualifiers = [DISCOVERY_QUERY]
  if (partition.createdStart && partition.createdEnd) {
    qualifiers.push(`created:${partition.createdStart}..${partition.createdEnd}`)
  }
  if (partition.starsStart !== undefined && partition.starsEnd !== undefined) {
    qualifiers.push(`stars:${partition.starsStart}..${partition.starsEnd}`)
  }

  return new URLSearchParams({
    q: qualifiers.join(' '),
    sort: request.sort,
    order: request.order,
    per_page: String(SEARCH_PAGE_SIZE),
    page: String(page),
  })
}

export function filterEligibleRepositories(repositories: SearchRepository[]): SearchRepository[] {
  return repositories.filter((repository) => {
    const topics = new Set(repository.topics.map(normalizeTopic))
    if (!topics.has('dsh-plugin') || !topics.has('deepseek-harness')) return false
    if (repository.archived || repository.fork) return false

    const classification = classifyRepository({
      fullName: repository.full_name,
      name: repository.name,
      description: repository.description ?? '',
      topics: repository.topics,
    })
    return classification.projectType !== 'application'
  })
}

function dateToDay(date: string): number {
  const day = Date.parse(`${date}T00:00:00Z`)
  if (!Number.isFinite(day)) throw new Error(`GitHub Search 日期分片无效：${date}`)
  return day
}

function dayToDate(day: number): string {
  return new Date(day).toISOString().slice(0, 10)
}

function nextDay(date: string): string {
  return dayToDate(dateToDay(date) + 24 * 60 * 60 * 1000)
}

function splitDatePartition(partition: SearchPartition): [SearchPartition, SearchPartition] | null {
  if (!partition.createdStart || !partition.createdEnd) return null
  const start = dateToDay(partition.createdStart)
  const end = dateToDay(partition.createdEnd)
  if (start >= end) return null
  const midpoint = start + Math.floor((end - start) / (2 * 24 * 60 * 60 * 1000)) * 24 * 60 * 60 * 1000
  return [
    { ...partition, createdEnd: dayToDate(midpoint) },
    { ...partition, createdStart: nextDay(dayToDate(midpoint)) },
  ]
}

function splitStarsPartition(partition: SearchPartition): [SearchPartition, SearchPartition] | null {
  if (partition.starsStart === undefined || partition.starsEnd === undefined) return null
  if (partition.starsStart >= partition.starsEnd) return null
  const midpoint = Math.floor((partition.starsStart + partition.starsEnd) / 2)
  return [
    { ...partition, starsEnd: midpoint },
    { ...partition, starsStart: midpoint + 1 },
  ]
}

function assertComplete(response: SearchPage): void {
  if (response.incomplete_results) throw new Error('GitHub Search 返回 incomplete_results')
}

function getCreatedDay(repository: SearchRepository): string {
  const createdDay = repository.created_at.slice(0, 10)
  dateToDay(createdDay)
  return createdDay
}

async function getDateBounds(
  fetcher: SearchPageFetcher,
  partition: SearchPartition,
): Promise<{ start: string; end: string }> {
  const [oldest, newest] = await Promise.all([
    fetcher(1, partition, { sort: 'created', order: 'asc' }),
    fetcher(1, partition, { sort: 'created', order: 'desc' }),
  ])
  assertComplete(oldest)
  assertComplete(newest)
  if (oldest.items.length === 0 || newest.items.length === 0) {
    throw new Error('GitHub Search 无法确定创建日期分片边界')
  }
  return {
    start: getCreatedDay(oldest.items[0]),
    end: getCreatedDay(newest.items[0]),
  }
}

async function getStarsBounds(
  fetcher: SearchPageFetcher,
  partition: SearchPartition,
): Promise<{ start: number; end: number }> {
  const [fewest, most] = await Promise.all([
    fetcher(1, partition, { sort: 'stars', order: 'asc' }),
    fetcher(1, partition, { sort: 'stars', order: 'desc' }),
  ])
  assertComplete(fewest)
  assertComplete(most)
  if (fewest.items.length === 0 || most.items.length === 0) {
    throw new Error('GitHub Search 无法确定 star 分片边界')
  }
  return {
    start: fewest.items[0].stargazers_count,
    end: most.items[0].stargazers_count,
  }
}

async function collectPartition(
  fetcher: SearchPageFetcher,
  partition: SearchPartition,
  firstPage: SearchPage,
  firstRequest: SearchRequestOptions,
  maxResultsPerQuery: number,
  pageSize: number,
  initialDateRange?: { start: string; end: string },
): Promise<SearchRepository[]> {
  assertComplete(firstPage)
  if (firstPage.total_count > maxResultsPerQuery) {
    let children = splitDatePartition(partition)
    if (children === null && !partition.createdStart && !partition.createdEnd) {
      const bounds = initialDateRange ?? (await getDateBounds(fetcher, partition))
      children = splitDatePartition({
        ...partition,
        createdStart: bounds.start,
        createdEnd: bounds.end,
      })
    }
    if (children === null && partition.starsStart === undefined) {
      const bounds = await getStarsBounds(fetcher, partition)
      children = splitStarsPartition({
        ...partition,
        starsStart: bounds.start,
        starsEnd: bounds.end,
      })
    }
    if (children === null) {
      throw new Error(
        `GitHub Search 分片仍超过 ${maxResultsPerQuery} 条且无法继续拆分：${firstPage.total_count}`,
      )
    }

    const repositories: SearchRepository[] = []
    for (const child of children) {
      const childPage = await fetcher(1, child, { sort: 'stars', order: 'desc' })
      repositories.push(...await collectPartition(
        fetcher,
        child,
        childPage,
        { sort: 'stars', order: 'desc' },
        maxResultsPerQuery,
        pageSize,
        initialDateRange,
      ))
    }
    return repositories
  }

  const repositories = [...firstPage.items]
  const pageCount = Math.ceil(firstPage.total_count / pageSize)
  for (let page = 2; page <= pageCount; page += 1) {
    const response = await fetcher(page, partition, firstRequest)
    assertComplete(response)
    repositories.push(...response.items)
  }
  return repositories
}

export async function fetchAllSearchRepositories(
  fetcher: SearchPageFetcher,
  options: FetchAllSearchOptions = {},
): Promise<FetchAllSearchResult> {
  const maxResultsPerQuery = options.maxResultsPerQuery ?? MAX_RESULTS_PER_QUERY
  const pageSize = options.pageSize ?? SEARCH_PAGE_SIZE
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
  const initialDateRange = options.initialDateStart && options.initialDateEnd
    ? { start: options.initialDateStart, end: options.initialDateEnd }
    : undefined
  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const rootPartition: SearchPartition = {}
      const rootPage = await fetcher(1, rootPartition, { sort: 'created', order: 'asc' })
      const reportedByGitHub = rootPage.total_count
      const repositories = await collectPartition(
        fetcher,
        rootPartition,
        rootPage,
        { sort: 'created', order: 'asc' },
        maxResultsPerQuery,
        pageSize,
        initialDateRange,
      )
      const uniqueRepositories = new Map<number, SearchRepository>()
      for (const repository of repositories) uniqueRepositories.set(repository.id, repository)
      return {
        repositories: filterEligibleRepositories([...uniqueRepositories.values()]),
        reportedByGitHub,
      }
    } catch (error) {
      lastError = error
      if (!(error instanceof Error) || !error.message.includes('incomplete_results')) throw error
    }
  }

  throw new Error(`GitHub Search 连续 ${maxAttempts} 轮仍不完整：${String(lastError)}`)
}
