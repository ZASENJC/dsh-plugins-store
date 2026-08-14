import { posix } from 'node:path'

import { load } from 'cheerio'

const AWESOME_LISTED_STATUSES = new Set(['兼容', '关注', '需适配', '待调研'])

export interface ReadmeCatalog {
  schemaVersion: 1
  generatedAt: string
  repositories: Record<string, string>
}

function getRepositoryPath(href: string): [string, string] | null {
  try {
    const url = new URL(href)
    const segments = url.pathname.split('/').filter(Boolean)
    if (url.hostname.toLowerCase() !== 'github.com' || segments.length !== 2) return null
    return [
      decodeURIComponent(segments[0]),
      decodeURIComponent(segments[1]).replace(/\.git$/i, ''),
    ]
  } catch {
    return null
  }
}

function getRepositoryName(href: string): string | null {
  return getRepositoryPath(href)?.[1].toLowerCase() ?? null
}

export function extractAwesomeRepositoryNames(html: string): Set<string> {
  const $ = load(html)
  const names = new Set<string>()

  $('tr').each((_, row) => {
    const cells = $(row).find('td')
    if (cells.length < 3 || !AWESOME_LISTED_STATUSES.has(cells.eq(2).text().trim())) return

    const href = cells.eq(0).find('a[href]').first().attr('href')
    if (!href) return
    const name = getRepositoryName(href)
    if (name) names.add(name)
  })

  return names
}

export function extractVerifiedRepositoryNames(html: string): Set<string> {
  const $ = load(html)
  const repositories = new Set<string>()

  $('table').each((_, table) => {
    const headers = $(table).find('thead th').map((_, cell) => $(cell).text().trim()).get()
    const repositoryColumn = headers.indexOf('插件')
    const statusColumn = headers.indexOf('状态')
    if (repositoryColumn === -1 || statusColumn === -1) return

    $(table).find('tbody tr').each((_, row) => {
      const cells = $(row).find('td')
      if (cells.eq(statusColumn).text().trim() !== '✅') return
      const href = cells.eq(repositoryColumn).find('a[href]').first().attr('href')
      if (!href) return
      const path = getRepositoryPath(href)
      if (path) repositories.add(path.join('/').toLowerCase())
    })
  })

  return repositories
}

function isExternalReference(value: string): boolean {
  return value.startsWith('#') || value.startsWith('//') || /^[a-z][a-z\d+.-]*:/i.test(value)
}

function splitReference(value: string): [string, string] {
  const suffixIndex = value.search(/[?#]/)
  return suffixIndex === -1
    ? [value, '']
    : [value.slice(0, suffixIndex), value.slice(suffixIndex)]
}

function resolveRepositoryPath(readmePath: string, reference: string): string | null {
  const [pathname, suffix] = splitReference(reference)
  if (!pathname) return null
  const directory = posix.dirname(readmePath)
  const normalized = posix.normalize(posix.join(directory, pathname)).replace(/^(\.\.\/)+/, '')
  return `${normalized.replace(/^\.\//, '')}${suffix}`
}

export function prepareReadmeHtml(
  html: string,
  repository: { fullName: string; defaultBranch: string },
): string {
  const $ = load(html)
  const readme = $('#readme').first()
  const article = readme.find('article.markdown-body').first()
  if (article.length === 0) return ''

  const readmePath = readme.attr('data-path') || 'README.md'

  article.find('a[href]').each((_, element) => {
    const href = $(element).attr('href')
    if (!href || isExternalReference(href)) return
    if (href.startsWith('/')) {
      $(element).attr('href', `https://github.com${href}`)
      return
    }
    const path = resolveRepositoryPath(readmePath, href)
    if (path) $(element).attr('href', `https://github.com/${repository.fullName}/blob/${repository.defaultBranch}/${path}`)
  })

  article.find('[src]').each((_, element) => {
    const src = $(element).attr('src')
    if (!src || isExternalReference(src)) return
    if (src.startsWith('/')) {
      $(element).attr('src', `https://github.com${src}`)
      return
    }
    const path = resolveRepositoryPath(readmePath, src)
    if (path) $(element).attr('src', `https://raw.githubusercontent.com/${repository.fullName}/${repository.defaultBranch}/${path}`)
  })

  return article.html() ?? ''
}
