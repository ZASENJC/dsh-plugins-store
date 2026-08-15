import {
  CATEGORIES,
  PROJECT_TYPES,
  classifyRepository,
  type Category,
  type Confidence,
  type ProjectType,
} from './classification'
import {
  SOURCE_CLASSIFIER_VERSION,
  type SourceClassification,
} from './source-classification'
import {
  VALIDATION_STATUS_DEFINITIONS,
  buildValidationStatus,
  type ValidationOverall,
  type ValidationRecord,
  type ValidationStatus,
} from './validation'
import {
  resolveCatalogInstallReference,
  type InstallReference,
} from './install-reference'

export const VERIFICATION_DIRECTORY_URL = 'https://github.com/qing3a/dsh-plugin-verify#verified-%E7%9B%AE%E5%BD%95'
export const VERIFIED_REPOSITORY_OVERRIDES: ReadonlyMap<string, string> = new Map([
  ['ccch1mneyyy/dsh-tui', 'https://github.com/ccch1mneyyy/dsh-TUI'],
])

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
  classificationSource: 'topics' | 'source'
  classificationSignals: string[]
  defaultBranch: string
  awesomeListed: boolean
  verified: boolean
  verificationUrl: string | null
  validation: ValidationStatus
  install?: InstallReference
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
    validationStatuses: Partial<Record<ValidationOverall, number>>
  }
  repositories: CatalogEntry[]
}

export type CatalogSort = 'recommended' | 'stars' | 'updated' | 'name'

function usableSourceClassification(
  record: ValidationRecord | undefined,
  repositoryPushedAt: string,
): SourceClassification | null {
  const source = record?.sourceClassification
  if (!source
    || record.sourceSha === null
    || record.sourcePushedAt !== repositoryPushedAt
    || source.sourceSha !== record.sourceSha
    || source.classifierVersion !== SOURCE_CLASSIFIER_VERSION) return null
  return source
}

export function createCatalogEntry(
  repository: GitHubRepository,
  awesomeRepositoryNames: ReadonlySet<string> = new Set(),
  verifiedRepositoryNames: ReadonlySet<string> = new Set(),
  validationRecord?: ValidationRecord,
  installReference?: InstallReference,
): CatalogEntry {
  const topicClassification = classifyRepository({
    fullName: repository.full_name,
    name: repository.name,
    description: repository.description ?? '',
    topics: repository.topics ?? [],
  })
  const sourceClassification = usableSourceClassification(validationRecord, repository.pushed_at)
  const useSourceType = sourceClassification !== null
    && sourceClassification.projectType !== 'unknown'
    && sourceClassification.confidence !== 'low'
  const useSourceCategory = sourceClassification !== null
    && sourceClassification.category !== 'other'
    && sourceClassification.confidence !== 'low'
  const classification = {
    projectType: useSourceType ? sourceClassification!.projectType : topicClassification.projectType,
    category: useSourceCategory ? sourceClassification!.category : topicClassification.category,
    categories: useSourceCategory ? sourceClassification!.categories : topicClassification.categories,
    matchedTopics: topicClassification.matchedTopics,
    confidence: useSourceType || useSourceCategory
      ? sourceClassification!.confidence
      : topicClassification.confidence,
  }
  const normalizedFullName = repository.full_name.toLowerCase()
  const verificationUrl = verifiedRepositoryNames.has(normalizedFullName)
    ? VERIFICATION_DIRECTORY_URL
    : VERIFIED_REPOSITORY_OVERRIDES.get(normalizedFullName) ?? null
  const validation = buildValidationStatus({
    repositoryId: repository.id,
    projectType: classification.projectType,
    repositoryPushedAt: repository.pushed_at,
    record: validationRecord,
    legacyVerificationUrl: verificationUrl,
  })
  const verified = validation.verified

  const install = installReference
    ? resolveCatalogInstallReference(installReference, {
        fullName: repository.full_name,
        validation,
      })
    : undefined

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
    classificationSource: useSourceType || useSourceCategory ? 'source' : 'topics',
    classificationSignals: sourceClassification?.matchedSignals ?? [],
    defaultBranch: repository.default_branch || 'main',
    awesomeListed: awesomeRepositoryNames.has(repository.name.toLowerCase()),
    verified,
    verificationUrl,
    validation,
    ...(install ? { install } : {}),
    status: {
      discovery: 'topic-listed',
      verification: verified ? 'verified' : 'not-verified',
    },
  }
}

export function buildCatalog(
  repositories: GitHubRepository[],
  generatedAt = new Date().toISOString(),
  reportedByGitHub = repositories.length,
  awesomeRepositoryNames: ReadonlySet<string> = new Set(),
  verifiedRepositoryNames: ReadonlySet<string> = new Set(),
  validationRecords: ReadonlyMap<number, ValidationRecord> = new Map(),
  installReferences: ReadonlyMap<number, InstallReference> = new Map(),
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
      validationRecords.get(repository.id),
      installReferences.get(repository.id),
    )),
    'recommended',
    generatedAt,
  )
  const categoryCounts: Partial<Record<Category, number>> = {}
  const typeCounts: Partial<Record<ProjectType, number>> = {}
  const validationCounts: Partial<Record<ValidationOverall, number>> = {}

  for (const entry of entries) {
    categoryCounts[entry.category] = (categoryCounts[entry.category] ?? 0) + 1
    typeCounts[entry.projectType] = (typeCounts[entry.projectType] ?? 0) + 1
    validationCounts[entry.validation.overall] = (validationCounts[entry.validation.overall] ?? 0) + 1
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
      validationStatuses: validationCounts,
    },
    repositories: entries,
  }
}

export function hydrateCatalogValidation(
  catalog: Catalog,
  validationRecords: ReadonlyMap<number, ValidationRecord> = new Map(),
): Catalog {
  const repositories = catalog.repositories.map((entry) => {
    const validation = buildValidationStatus({
      repositoryId: entry.repositoryId,
      projectType: entry.projectType,
      repositoryPushedAt: entry.pushedAt,
      record: validationRecords.get(entry.repositoryId),
      legacyVerificationUrl: entry.verificationUrl,
    })
    const verified = validation.verified
    return {
      ...entry,
      verified,
      validation,
      status: {
        ...entry.status,
        verification: verified ? 'verified' as const : 'not-verified' as const,
      },
    }
  })
  const validationStatuses: Partial<Record<ValidationOverall, number>> = {}
  for (const entry of repositories) {
    validationStatuses[entry.validation.overall] = (validationStatuses[entry.validation.overall] ?? 0) + 1
  }
  return {
    ...catalog,
    stats: {
      ...catalog.stats,
      verified: repositories.filter((entry) => entry.verified).length,
      validationStatuses,
    },
    repositories,
  }
}

function createSeededRandom(seed: string): () => number {
  let state = 2_166_136_261
  for (let index = 0; index < seed.length; index += 1) {
    state = Math.imul(state ^ seed.charCodeAt(index), 16_777_619)
  }
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
    return state / 4_294_967_296
  }
}

export function mixRecommendedEntries<T>(
  priority: readonly T[],
  discovery: readonly T[],
  random: () => number = Math.random,
): T[] {
  const mixed: T[] = []
  let priorityIndex = 0
  let discoveryIndex = 0

  while (priorityIndex < priority.length || discoveryIndex < discovery.length) {
    const priorityCount = Math.min(2, priority.length - priorityIndex)
    const hasDiscovery = discoveryIndex < discovery.length
    if (!hasDiscovery) {
      mixed.push(...priority.slice(priorityIndex, priorityIndex + priorityCount))
      priorityIndex += priorityCount
      continue
    }

    const discoveryPosition = Math.floor(random() * (priorityCount + 1))
    for (let slot = 0; slot <= priorityCount; slot += 1) {
      if (slot === discoveryPosition) {
        mixed.push(discovery[discoveryIndex])
        discoveryIndex += 1
      } else {
        mixed.push(priority[priorityIndex])
        priorityIndex += 1
      }
    }
  }

  return mixed
}

export function sortCatalogEntries(entries: CatalogEntry[], sort: CatalogSort, seed = ''): CatalogEntry[] {
  const compareStatus = (left: CatalogEntry, right: CatalogEntry) => {
    const verifiedPriority = Number(right.verified) - Number(left.verified)
    return verifiedPriority
  }
  const compareStars = (left: CatalogEntry, right: CatalogEntry) => (
    right.stars - left.stars
    || compareStatus(left, right)
    || left.fullName.localeCompare(right.fullName)
  )

  if (sort === 'recommended') {
    const priority = entries
      .filter((entry) => entry.verified)
      .sort(compareStars)
    const discovery = entries
      .filter((entry) => !entry.verified)
      .sort(compareStars)
    return mixRecommendedEntries(priority, discovery, createSeededRandom(seed))
  }

  return [...entries].sort((left, right) => {
    const statusPriority = compareStatus(left, right)
    if (sort === 'updated') {
      return Date.parse(right.pushedAt) - Date.parse(left.pushedAt)
        || statusPriority
        || left.fullName.localeCompare(right.fullName)
    }
    if (sort === 'name') {
      return left.name.localeCompare(right.name)
        || statusPriority
        || left.fullName.localeCompare(right.fullName)
    }
    return right.stars - left.stars
      || statusPriority
      || left.fullName.localeCompare(right.fullName)
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
  return {
    categories: CATEGORIES,
    projectTypes: PROJECT_TYPES,
    validationStatuses: VALIDATION_STATUS_DEFINITIONS,
  }
}
