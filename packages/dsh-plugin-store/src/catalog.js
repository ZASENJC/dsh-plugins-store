export const DEFAULT_CATALOG_URLS = Object.freeze([
  'https://dsh.aitreez.com/catalog.json',
  'https://raw.githubusercontent.com/ZASENJC/dsh-plugins-store/main/src/data/catalog.json',
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

const INSTALLABLE_TYPES = new Set(['plugin', 'skill', 'collection', 'channel'])

export function buildInstallCommand(repository) {
  if (!INSTALLABLE_TYPES.has(repository.projectType)) return null
  return `dsh plugin --profile web add github:${repository.fullName}`
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
  const leftPriority = Number(left.verified) * 2 + Number(left.awesomeListed)
  const rightPriority = Number(right.verified) * 2 + Number(right.awesomeListed)
  return rightPriority - leftPriority
    || right.stars - left.stars
    || left.fullName.localeCompare(right.fullName)
}

export function filterCatalogRepositories(repositories, filters) {
  const tokens = filters.query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  const filtered = repositories.filter((repository) => {
    if (filters.category !== 'all' && repository.category !== filters.category) return false
    if (filters.verifiedOnly && !repository.verified) return false
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
    this.urls = [...urls]
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
    let lastError = new Error('没有可用的目录数据源')
    for (const url of this.urls) {
      try {
        const response = await this.fetcher(url, {
          headers: { Accept: 'application/json' },
        })
        if (!response.ok) throw new Error(`目录请求失败 (${response.status})`)
        return validateCatalog(await response.json())
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
      }
    }
    throw lastError
  }

  publish(next) {
    this.snapshot = Object.freeze(next)
    for (const listener of this.listeners) listener()
  }
}
