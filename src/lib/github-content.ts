import { load } from 'cheerio'

const AWESOME_LISTED_STATUSES = new Set(['兼容', '关注', '需适配', '待调研'])

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
