export const DEFAULT_CATALOG_URLS = Object.freeze([
  'https://dsh.aitreez.com/catalog.json',
])

export const CATEGORY_LABELS = Object.freeze({
  all: '全部分类',
  ui: '界面体验',
  development: '开发工具',
  data: '数据知识',
  other: '其他',
  'agent-session': 'Agent 与会话',
  lifestyle: '生活娱乐',
  security: '安全',
  operations: '运维',
  research: '研究',
  'model-mcp': '模型与 MCP',
  communication: '消息通讯',
})

export const PROJECT_TYPE_LABELS = Object.freeze({
  plugin: '插件',
  application: '应用',
  skill: '技能',
  unknown: '待识别',
  directory: '目录',
  collection: '插件合集',
  infrastructure: '基础设施',
  channel: '渠道适配',
})

export const VALIDATION_STATUS_IDS = Object.freeze([
  'unrecognized',
  'check-pending',
  'check-running',
  'check-failed',
  'sandbox-pending',
  'sandbox-running',
  'sandbox-failed',
  'verified',
  'security-review',
  'expired',
  'recorded',
  'inconclusive',
  'not-applicable',
])

const INSTALLABLE_TYPES = new Set(['plugin', 'skill', 'collection', 'channel'])
const REPOSITORY_FULL_NAME = /^[A-Za-z0-9](?:[A-Za-z0-9_.-]{0,99})\/[A-Za-z0-9](?:[A-Za-z0-9_.-]{0,99})$/
const GITHUB_SPECIFIER = /^github:([^#]+)(?:#([A-Za-z0-9][A-Za-z0-9_.:-]{0,127}))?$/i
const SOURCE_SHA = /^[a-f0-9]{40}$/i
const NPM_PACKAGE = /^(?:@[A-Za-z0-9](?:[A-Za-z0-9._-]{0,99})\/)?[A-Za-z0-9](?:[A-Za-z0-9._-]{0,99})(?:@[A-Za-z0-9^~<>=*+._-][A-Za-z0-9^~<>=*+._-]{0,127})?$/

function getInstallCandidate(repository) {
  if (!INSTALLABLE_TYPES.has(repository.projectType)) return null
  if (repository.install?.status !== 'recognized') return null
  return repository.install.candidate ?? null
}

export function buildInstallCommand(repository) {
  const plan = buildInstallPlan(repository)
  if (plan !== null) return plan.command
  const candidate = getInstallCandidate(repository)
  return typeof candidate?.command === 'string' ? candidate.command : null
}

function readDshInstallArgs(candidate) {
  if (!Array.isArray(candidate?.args)
    || candidate.args.length !== 5
    || candidate.args[0] !== 'plugin'
    || candidate.args[1] !== '--profile'
    || candidate.args[2] !== 'web'
    || candidate.args[3] !== 'add'
    || typeof candidate.args[4] !== 'string') return null
  return [...candidate.args]
}

function buildCandidatePlan(repository) {
  const candidate = getInstallCandidate(repository)
  if (candidate === null || candidate.executable !== true) return null
  if (!Array.isArray(candidate.args)) return null
  if (typeof candidate.target !== 'string' || typeof repository.fullName !== 'string') return null
  const sourceSha = String(repository.validation?.sourceSha ?? '')
  if (repository.validation?.overall === 'verified' && !SOURCE_SHA.test(sourceSha)) return null

  const args = readDshInstallArgs(candidate)
  if (args === null) return null

  if (candidate.source === 'github') {
    const match = GITHUB_SPECIFIER.exec(args[4])
    if (!match || !REPOSITORY_FULL_NAME.test(match[1])
      || match[1].toLowerCase() !== String(repository.fullName).toLowerCase()
      || candidate.target.toLowerCase() !== repository.fullName.toLowerCase()) return null
    if (repository.validation?.overall === 'verified'
      && match[2]?.toLowerCase() !== sourceSha.toLowerCase()) return null
  } else if (candidate.source === 'npm') {
    const specifier = args[4].startsWith('npm:') ? args[4].slice(4) : args[4]
    if (!NPM_PACKAGE.test(specifier) || specifier !== candidate.target) return null
  } else {
    return null
  }

  return {
    source: candidate.source,
    target: candidate.target,
    command: candidate.source === 'github'
      ? `dsh plugin --profile web add ${args[4]}`
      : candidate.command,
    args,
    executable: true,
  }
}

export function buildInstallPlan(repository) {
  return buildCandidatePlan(repository)
}

function normalizedSearchText(repository) {
  return [
    repository.name,
    repository.fullName,
    repository.description,
    ...(repository.topics ?? []),
  ].join(' ').toLocaleLowerCase()
}

function compareRecommended(left, right) {
  const leftPriority = Number(left.verified) * 2
  const rightPriority = Number(right.verified) * 2
  return rightPriority - leftPriority
    || right.stars - left.stars
    || left.fullName.localeCompare(right.fullName)
}

export function filterCatalogRepositories(repositories, filters) {
  const tokens = filters.query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  const filtered = repositories.filter((repository) => {
    if (filters.category !== 'all' && repository.category !== filters.category) return false
    if (filters.validation && filters.validation !== 'all'
      && repository.validation?.overall !== filters.validation) return false
    const currentVerified = repository.validation
      ? repository.validation.overall === 'verified'
      : repository.verified
    if (filters.verifiedOnly && !currentVerified) return false
    if (tokens.length === 0) return true
    const searchText = normalizedSearchText(repository)
    return tokens.every((token) => searchText.includes(token))
  })

  return [...filtered].sort((left, right) => {
    if (filters.sort === 'stars') {
      return right.stars - left.stars || left.fullName.localeCompare(right.fullName)
    }
    if (filters.sort === 'updated') {
      return Date.parse(right.pushedAt) - Date.parse(left.pushedAt)
        || left.fullName.localeCompare(right.fullName)
    }
    if (filters.sort === 'name') {
      return left.name.localeCompare(right.name) || left.fullName.localeCompare(right.fullName)
    }
    return compareRecommended(left, right)
  })
}

export function formatCompactNumber(value) {
  return new Intl.NumberFormat('zh-CN', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

function validateCatalog(value) {
  if (value === null
    || typeof value !== 'object'
    || value.schemaVersion !== 1
    || !Array.isArray(value.repositories)) {
    throw new Error('目录响应格式无效')
  }
  return value
}

export class CatalogStore {
  constructor({ fetcher = globalThis.fetch?.bind(globalThis), urls = DEFAULT_CATALOG_URLS } = {}) {
    if (typeof fetcher !== 'function') throw new Error('当前环境不支持目录请求')
    this.fetcher = fetcher
    this.url = urls[0] ?? DEFAULT_CATALOG_URLS[0]
    this.listeners = new Set()
    this.pending = null
    this.snapshot = Object.freeze({
      status: 'idle',
      catalog: null,
      error: null,
    })
  }

  getSnapshot = () => this.snapshot

  subscribe = (listener) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  load({ force = false } = {}) {
    if (!force && this.snapshot.status === 'ready') return Promise.resolve()
    if (this.pending !== null) return this.pending

    this.publish({
      status: 'loading',
      catalog: this.snapshot.catalog,
      error: null,
    })

    this.pending = this.fetchCatalog()
      .then((catalog) => {
        this.publish({ status: 'ready', catalog, error: null })
      })
      .catch((error) => {
        this.publish({
          status: 'error',
          catalog: this.snapshot.catalog,
          error: error instanceof Error ? error.message : String(error),
        })
      })
      .finally(() => {
        this.pending = null
      })

    return this.pending
  }

  async fetchCatalog() {
    const response = await this.fetcher(this.url, {
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) throw new Error(`目录请求失败 (${response.status})`)
    return validateCatalog(await response.json())
  }

  publish(next) {
    this.snapshot = Object.freeze(next)
    for (const listener of this.listeners) listener()
  }
}
