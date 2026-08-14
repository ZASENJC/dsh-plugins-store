import {
  CATEGORIES,
  PROJECT_TYPES,
  classifyRepository,
  type Category,
  type Confidence,
  type ProjectType,
} from './classification'

export interface GitHubRepository {
  id: number
  name: string
  full_name: string
  owner: {
    login: string
    avatar_url: string
  }
  html_url: string
  description: string | null
  fork: boolean
  created_at: string
  updated_at: string
  pushed_at: string
  homepage: string | null
  size: number
  stargazers_count: number
  forks_count: number
  open_issues_count: number
  language: string | null
  archived: boolean
  license: { spdx_id: string | null } | null
  topics: string[]
  default_branch?: string
}

export interface CatalogEntry {
  id: string
  repositoryId: number
  slug: string
  name: string
  fullName: string
  description: string
  url: string
  homepage: string | null
  owner: {
    login: string
    avatarUrl: string
  }
  topics: string[]
  language: string | null
  license: string | null
  stars: number
  forks: number
  openIssues: number
  size: number
  createdAt: string
  updatedAt: string
  pushedAt: string
  archived: boolean
  fork: boolean
  projectType: ProjectType
  category: Category
  categories: Category[]
  matchedTopics: string[]
  classificationConfidence: Confidence
  defaultBranch: string
  awesomeListed: boolean
  verified: boolean
  status: {
    discovery: 'topic-listed'
    verification: 'verified' | 'not-verified'
  }
}

export interface Catalog {
  schemaVersion: 1
  generatedAt: string
  source: {
    label: 'GitHub Topic'
    topic: 'dsh-plugin'
    url: 'https://github.com/topics/dsh-plugin'
  }
  stats: {
    fetched: number
    reportedByGitHub: number
    verified: number
    categories: Partial<Record<Category, number>>
    projectTypes: Partial<Record<ProjectType, number>>
  }
  repositories: CatalogEntry[]
}

export type CatalogSort = 'stars' | 'updated' | 'name'

export function createCatalogEntry(
  repository: GitHubRepository,
  awesomeRepositoryNames: ReadonlySet<string> = new Set(),
  verifiedRepositoryNames: ReadonlySet<string> = new Set(),
): CatalogEntry {
  const classification = classifyRepository({
    fullName: repository.full_name,
    name: repository.name,
    description: repository.description ?? '',
    topics: repository.topics ?? [],
  })

  return {
    id: `github:${repository.id}`,
    repositoryId: repository.id,
    slug: String(repository.id),
    name: repository.name,
    fullName: repository.full_name,
    description: repository.description?.trim() || '该仓库暂未提供项目说明。',
    url: repository.html_url,
    homepage: repository.homepage || null,
    owner: {
      login: repository.owner.login,
      avatarUrl: repository.owner.avatar_url,
    },
    topics: [...new Set(repository.topics ?? [])].sort((left, right) => left.localeCompare(right)),
    language: repository.language,
    license: repository.license?.spdx_id || null,
    stars: repository.stargazers_count,
    forks: repository.forks_count,
    openIssues: repository.open_issues_count,
    size: repository.size,
    createdAt: repository.created_at,
    updatedAt: repository.updated_at,
    pushedAt: repository.pushed_at,
    archived: repository.archived,
    fork: repository.fork,
    projectType: classification.projectType,
    category: classification.category,
    categories: classification.categories,
    matchedTopics: classification.matchedTopics,
    classificationConfidence: classification.confidence,
    defaultBranch: repository.default_branch || 'main',
    awesomeListed: awesomeRepositoryNames.has(repository.name.toLowerCase()),
    verified: verifiedRepositoryNames.has(repository.full_name.toLowerCase()),
    status: {
      discovery: 'topic-listed',
      verification: verifiedRepositoryNames.has(repository.full_name.toLowerCase()) ? 'verified' : 'not-verified',
    },
  }
}

export function buildCatalog(
  repositories: GitHubRepository[],
  generatedAt = new Date().toISOString(),
  reportedByGitHub = repositories.length,
  awesomeRepositoryNames: ReadonlySet<string> = new Set(),
  verifiedRepositoryNames: ReadonlySet<string> = new Set(),
): Catalog {
  const uniqueRepositories = new Map<number, GitHubRepository>()
  for (const repository of repositories) {
    if (!uniqueRepositories.has(repository.id)) uniqueRepositories.set(repository.id, repository)
  }

  const normalizedAwesomeNames = new Set(
    [...awesomeRepositoryNames].map((name) => name.toLowerCase()),
  )
  const normalizedVerifiedNames = new Set(
    [...verifiedRepositoryNames].map((name) => name.toLowerCase()),
  )
  const entries = sortCatalogEntries(
    [...uniqueRepositories.values()].map((repository) => createCatalogEntry(
      repository,
      normalizedAwesomeNames,
      normalizedVerifiedNames,
    )),
    'stars',
  )
  const categoryCounts: Partial<Record<Category, number>> = {}
  const typeCounts: Partial<Record<ProjectType, number>> = {}

  for (const entry of entries) {
    categoryCounts[entry.category] = (categoryCounts[entry.category] ?? 0) + 1
    typeCounts[entry.projectType] = (typeCounts[entry.projectType] ?? 0) + 1
  }

  return {
    schemaVersion: 1,
    generatedAt,
    source: {
      label: 'GitHub Topic',
      topic: 'dsh-plugin',
      url: 'https://github.com/topics/dsh-plugin',
    },
    stats: {
      fetched: entries.length,
      reportedByGitHub,
      verified: entries.filter((entry) => entry.verified).length,
      categories: categoryCounts,
      projectTypes: typeCounts,
    },
    repositories: entries,
  }
}

export function sortCatalogEntries(entries: CatalogEntry[], sort: CatalogSort): CatalogEntry[] {
  return [...entries].sort((left, right) => {
    const awesomePriority = Number(right.awesomeListed) - Number(left.awesomeListed)
    if (awesomePriority !== 0) return awesomePriority
    if (sort === 'updated') {
      return Date.parse(right.pushedAt) - Date.parse(left.pushedAt)
        || left.fullName.localeCompare(right.fullName)
    }
    if (sort === 'name') return left.name.localeCompare(right.name) || left.fullName.localeCompare(right.fullName)
    return right.stars - left.stars || left.fullName.localeCompare(right.fullName)
  })
}

export function formatCompactNumber(value: number): string {
  if (value < 1_000) return String(value)
  if (value < 1_000_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}k`
  return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}m`
}

export function formatRelativeDate(value: string, now = new Date()): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '未知'
  const days = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86_400_000))
  if (days === 0) return '今天'
  if (days < 30) return `${days} 天前`
  if (days < 365) return `${Math.floor(days / 30)} 个月前`
  return `${Math.floor(days / 365)} 年前`
}

export function getEmptyCatalog(): Catalog {
  return buildCatalog([], new Date(0).toISOString(), 0)
}

export function getCatalogDefinitions() {
  return { categories: CATEGORIES, projectTypes: PROJECT_TYPES }
}
