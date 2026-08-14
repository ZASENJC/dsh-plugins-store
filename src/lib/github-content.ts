import { posix } from 'node:path'

import { load } from 'cheerio'

const AWESOME_LISTED_STATUSES = new Set(['兼容', '关注', '需适配', '待调研'])

export interface ReadmeCatalog {
  schemaVersion: 1
  generatedAt: string
  repositories: Record<string, string>
}

function getRepositoryName(href: string): string | null {
  try {
    const url = new URL(href)
    const segments = url.pathname.split('/').filter(Boolean)
    if (url.hostname.toLowerCase() !== 'github.com' || segments.length !== 2) return null
    return decodeURIComponent(segments[1]).replace(/\.git$/i, '').toLowerCase()
  } catch {
    return null
  }
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
