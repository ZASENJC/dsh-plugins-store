const PACKAGE_NAME = /^(?:@[A-Za-z0-9](?:[A-Za-z0-9._-]{0,99})\/)?[A-Za-z0-9](?:[A-Za-z0-9._-]{0,99})$/
const SOURCE_SHA = /^[a-f0-9]{7,64}$/i
const VERSION = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/

export const INSTALLED_PLUGIN_LIST_ARGS = Object.freeze([
  'plugin', '--profile', 'web', 'list', '--depth=0', '--json',
])

function stringValue(value) {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function normalizeDependency(name, dependency) {
  if (!PACKAGE_NAME.test(name) || dependency === null || typeof dependency !== 'object') return null
  return {
    name,
    ...(stringValue(dependency.from) ? { from: dependency.from } : {}),
    ...(stringValue(dependency.version) ? { version: dependency.version } : {}),
    ...(stringValue(dependency.resolved) ? { resolved: dependency.resolved } : {}),
  }
}

export function parseInstalledPluginList(value) {
  let parsed = value
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value)
    } catch {
      throw new Error('本地插件清单格式无效')
    }
  }
  if (!Array.isArray(parsed)) throw new Error('本地插件清单格式无效')

  const root = parsed.find((entry) => (
    entry !== null
    && typeof entry === 'object'
    && entry.dependencies !== null
    && typeof entry.dependencies === 'object'
    && !Array.isArray(entry.dependencies)
  ))
  if (root === undefined) return []

  return Object.entries(root.dependencies)
    .map(([name, dependency]) => normalizeDependency(name, dependency))
    .filter(Boolean)
}

export function buildInstalledPluginSnapshot(installed) {
  if (!Array.isArray(installed)) return []
  return installed
    .map((entry) => normalizeDependency(entry?.name, entry))
    .filter(Boolean)
}

function stripSpecifierQuotes(value) {
  const text = stringValue(value)?.trim()
  if (text === undefined) return null
  return text.replace(/^(['"])(.*)\1$/, '$2')
}

function githubSource(value) {
  const text = stripSpecifierQuotes(value)
  if (text === null) return null
  const match = /(?:^github:|^git\+https?:\/\/github\.com\/|^https?:\/\/github\.com\/|^git@github\.com:)([^/#:]+\/[^/#]+?)(?:\.git)?(?:#(.+))?$/i.exec(text)
  if (!match) return null
  return {
    fullName: match[1].toLowerCase(),
    ref: stringValue(match[2])?.toLowerCase(),
  }
}

function npmPackageName(value) {
  const text = stripSpecifierQuotes(value)?.replace(/^npm:/i, '')
  if (text === undefined) return null
  const match = /^(@[^/]+\/[^@]+|[^@]+)(?:@(.+))?$/.exec(text)
  return match === null ? null : { name: match[1], version: match[2] }
}

function candidateVersion(repository) {
  const candidate = repository.install?.candidate
  const declared = repository.version ?? repository.packageVersion ?? candidate?.version
  if (typeof declared === 'string') return declared
  return candidate?.source === 'npm' ? npmPackageName(candidate.target)?.version : undefined
}

function candidateGithubRef(repository) {
  const candidate = repository.install?.candidate
  const fromArgs = Array.isArray(candidate?.args) ? candidate.args[4] : undefined
  const source = githubSource(fromArgs) ?? githubSource(candidate?.target)
  const validationSha = repository.validation?.sourceSha
  if (typeof validationSha === 'string' && SOURCE_SHA.test(validationSha)) return validationSha.toLowerCase()
  return source?.ref
}

function sourceRefsDiffer(left, right) {
  if (!left || !right) return false
  return left !== right && !left.startsWith(right) && !right.startsWith(left)
}

export function compareCatalogInstallation(repository, installed) {
  const candidate = repository?.install?.candidate
  if (candidate === null || typeof candidate !== 'object' || !Array.isArray(installed)) return null

  if (candidate.source === 'github') {
    const target = githubSource(candidate.target)?.fullName ?? String(repository.fullName ?? '').toLowerCase()
    return installed.find((entry) => [entry.from, entry.resolved].some((value) => githubSource(value)?.fullName === target)) ?? null
  }
  if (candidate.source === 'npm') {
    const target = npmPackageName(candidate.target)?.name
    if (target === null) return null
    return installed.find((entry) => (
      entry.name === target
      || npmPackageName(entry.from)?.name === target
      || npmPackageName(entry.resolved)?.name === target
    )) ?? null
  }
  return null
}

function compareSemver(left, right) {
  const leftMatch = VERSION.exec(left ?? '')
  const rightMatch = VERSION.exec(right ?? '')
  if (!leftMatch || !rightMatch) return null
  for (let index = 1; index <= 3; index += 1) {
    const difference = Number(leftMatch[index]) - Number(rightMatch[index])
    if (difference !== 0) return difference
  }
  if (leftMatch[4] === rightMatch[4]) return 0
  if (!leftMatch[4]) return 1
  if (!rightMatch[4]) return -1
  return leftMatch[4].localeCompare(rightMatch[4])
}

export function isUpdateAvailable(repository, installed) {
  if (installed === null || typeof installed !== 'object') return false
  const candidate = repository?.install?.candidate
  if (candidate?.source === 'github') {
    const catalogRef = candidateGithubRef(repository)
    const installedRef = [installed.resolved, installed.from]
      .map(githubSource)
      .find(Boolean)?.ref
    return Boolean(catalogRef && installedRef && sourceRefsDiffer(catalogRef, installedRef))
  }
  if (candidate?.source === 'npm') {
    const catalogVersion = candidateVersion(repository)
    const comparison = compareSemver(catalogVersion, installed.version)
    return comparison !== null && comparison > 0
  }
  return false
}

export function getInstalledPluginRemoveTarget(installed, name) {
  if (!PACKAGE_NAME.test(name) || !Array.isArray(installed)) return null
  return installed.some((entry) => entry?.name === name) ? name : null
}
