import { parse as parseYaml } from 'yaml'
import { posix } from 'node:path'

import {
  CATEGORIES,
  PROJECT_TYPES,
  classifyRepository,
  type Category,
  type Confidence,
  type ProjectType,
} from './classification'

export const SOURCE_CLASSIFIER_VERSION = '0.2.0'

export type DshRelevance = 'recognized' | 'unrecognized'

export interface SourceClassification {
  sourceSha: string
  classifierVersion: string
  dshRelevance: DshRelevance
  relevanceSignals: string[]
  projectType: ProjectType
  category: Category
  categories: Category[]
  matchedSignals: string[]
  typeConfidence: Confidence
  categoryConfidence: Confidence
  // Backward-compatible alias for consumers that predate split confidence.
  confidence: Confidence
}

export interface SourceClassificationInput {
  sourceSha: string
  files: Readonly<Record<string, string | undefined>>
}

const PROJECT_TYPE_IDS = new Set<ProjectType>(PROJECT_TYPES.map(({ id }) => id))
const CATEGORY_IDS = new Set<Category>(CATEGORIES.map(({ id }) => id))
const CONFIDENCE_IDS = new Set<Confidence>(['high', 'medium', 'low'])

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function nestedRecord(value: unknown, ...keys: string[]): Record<string, unknown> | null {
  let current = asRecord(value)
  for (const key of keys) {
    if (current === null) return null
    current = asRecord(current[key])
  }
  return current
}

function nestedString(value: unknown, ...keys: string[]): string | null {
  let current: unknown = value
  for (const key of keys) {
    const record = asRecord(current)
    if (record === null) return null
    current = record[key]
  }
  return typeof current === 'string' && current.length > 0 ? current : null
}

function parseJson(content: string | undefined): Record<string, unknown> | null {
  if (typeof content !== 'string') return null
  try {
    return asRecord(JSON.parse(content))
  } catch {
    return null
  }
}

function parseYamlDocument(content: string | undefined): unknown {
  if (typeof content !== 'string') return null
  try {
    return parseYaml(content)
  } catch {
    return null
  }
}

function words(value: string): string[] {
  const tokens = value.toLowerCase().match(/[a-z0-9]+(?:-[a-z0-9]+)*/g) ?? []
  return [...new Set(tokens)]
}

export function resolveDshBundlePatchPath(packageJson: string | undefined): string | null {
  const manifest = parseJson(packageJson)
  const declared = nestedString(manifest, 'dsh', 'bundle', 'patch')
  if (declared === null || declared.includes('\0') || declared.includes('\\') || posix.isAbsolute(declared)) return null
  const withoutCurrentDirectory = declared.replace(/^\.\/+/, '')
  if (withoutCurrentDirectory.length === 0 || withoutCurrentDirectory.split('/').includes('..')) return null
  const normalized = posix.normalize(withoutCurrentDirectory)
  return normalized === '.' || normalized === '..' || normalized.startsWith('../') ? null : normalized
}

function recognizeDshContract(files: Readonly<Record<string, string | undefined>>): {
  dshRelevance: DshRelevance
  relevanceSignals: string[]
} {
  const patchPath = resolveDshBundlePatchPath(files['package.json'])
  if (patchPath === null || typeof files[patchPath] !== 'string') {
    return { dshRelevance: 'unrecognized', relevanceSignals: [] }
  }
  const patch = parseYamlDocument(files[patchPath])
  if (!Array.isArray(patch)) return { dshRelevance: 'unrecognized', relevanceSignals: [] }
  return {
    dshRelevance: 'recognized',
    relevanceSignals: ['package.json:dsh.bundle.patch', `${patchPath}:parsed`],
  }
}

function addManifestSignals(topics: Set<string>, manifest: Record<string, unknown>): void {
  for (const value of [manifest.name, manifest.description]) {
    if (typeof value === 'string') words(value).forEach((token) => topics.add(token))
  }
  for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies', 'scripts', 'bin']) {
    const value = manifest[field]
    if (typeof value === 'string') words(value).forEach((token) => topics.add(token))
    const record = asRecord(value)
    if (record) Object.keys(record).forEach((key) => words(key).forEach((token) => topics.add(token)))
  }
}

function hasExecutablePath(paths: string[]): boolean {
  return paths.some((path) => /\.(?:cjs|go|java|js|jsx|kt|mjs|php|py|rb|rs|swift|ts|tsx|vue|svelte)$/i.test(path))
}

function hasOnlyDocumentationPaths(paths: string[]): boolean {
  return paths.length > 0 && paths.every((path) => (
    /(^|\/)(?:README(?:\..*)?|LICENSE(?:\..*)?|COPYING(?:\..*)?|docs?)(?:\/|$)/i.test(path)
  ))
}

function classifyProjectType({
  paths,
  manifests,
  rootManifest,
  topics,
  signals,
  dshRelevance,
}: {
  paths: string[]
  manifests: Record<string, unknown>[]
  rootManifest: Record<string, unknown> | null
  topics: Set<string>
  signals: string[]
  dshRelevance: DshRelevance
}): { projectType: ProjectType, confidence: Confidence } {
  const patchPath = nestedString(rootManifest, 'dsh', 'bundle', 'patch')
  const hasDshBundle = paths.some((path) => /(^|\/)dsh\.bundle\.ya?ml$/i.test(path))
  const hasCordisPatch = paths.some((path) => /(^|\/)cordis\.patch\.ya?ml$/i.test(path))
  const hasRepositoryPlugin = paths.some((path) => /(^|\/)\.dsh-plugin(?:\/|$)/i.test(path))
  const hasDshManifest = nestedRecord(rootManifest, 'dsh') !== null || patchPath !== null

  if (hasDshBundle) signals.push('dsh.bundle.yml')
  if (hasCordisPatch) signals.push('cordis.patch.yml')
  if (hasRepositoryPlugin) signals.push('.dsh-plugin')
  if (hasDshManifest) signals.push(patchPath ? 'package.json:dsh.bundle.patch' : 'package.json:dsh')

  const skillPaths = paths.filter((path) => /(^|\/)SKILL\.md$/i.test(path))
  if (skillPaths.length > 0) signals.push('SKILL.md')

  const packagePaths = paths.filter((path) => /(^|\/)package\.json$/i.test(path))
  const hasWorkspace = rootManifest !== null && (
    Array.isArray(rootManifest.workspaces) || asRecord(rootManifest.workspaces) !== null
  )
  if (hasWorkspace) signals.push('package.json:workspaces')
  if (packagePaths.length > 1) signals.push('multiple-package.json')

  const channelSignal = [...topics].some((topic) => /(^|-)(?:telegram|discord|slack|feishu|lark|wechat|wecom|qq|bot|bridge|messaging|webhook)(?:-|$)/.test(topic))
  const infrastructureSignal = paths.some((path) => /(^|\/)(Dockerfile|docker-compose(?:\..*)?|helm|k8s|kubernetes|terraform|ansible|\.github\/workflows)(?:\/|$)/i.test(path))
    || [...topics].some((topic) => /(^|-)(?:deploy|devops|infrastructure|observability|monitoring|registry|runtime|scheduler)(?:-|$)/.test(topic))
  const applicationSignal = paths.some((path) => /(^|\/)(?:apps?|desktop|electron|tauri|mobile|ios|android)(?:\/|$)/i.test(path))
    || [...topics].some((topic) => /(^|-)(?:desktop|mobile|electron|tauri|react-native|web-app|application|workbench)(?:-|$)/.test(topic))
    || (rootManifest?.private === true && !hasWorkspace)

  if (dshRelevance === 'recognized') {
    return { projectType: hasWorkspace && manifests.length > 1 ? 'collection' : 'plugin', confidence: 'high' }
  }
  if (hasWorkspace || packagePaths.length > 1) return { projectType: 'collection', confidence: 'high' }
  if (skillPaths.length > 0) return { projectType: 'skill', confidence: 'high' }
  if (channelSignal) {
    signals.push('channel-manifest')
    return { projectType: 'channel', confidence: 'medium' }
  }
  if (applicationSignal) {
    signals.push('package.json:application')
    return { projectType: 'application', confidence: 'medium' }
  }
  if (infrastructureSignal) {
    signals.push('infrastructure-layout')
    return { projectType: 'infrastructure', confidence: 'medium' }
  }
  if (packagePaths.length === 0 && !hasExecutablePath(paths) && hasOnlyDocumentationPaths(paths)) {
    signals.push('directory-layout')
    return { projectType: 'directory', confidence: 'medium' }
  }
  return { projectType: 'unknown', confidence: 'low' }
}

export function classifySource({ sourceSha, files }: SourceClassificationInput): SourceClassification {
  if (!/^[a-f0-9]{40}$/i.test(sourceSha)) throw new Error('Source classification SHA is invalid')

  const paths = Object.keys(files).sort()
  const packagePaths = paths.filter((path) => /(^|\/)package\.json$/i.test(path))
  const manifests = packagePaths.map((path) => parseJson(files[path])).filter((manifest): manifest is Record<string, unknown> => manifest !== null)
  const rootManifest = parseJson(files['package.json'])
  const topicSignals = new Set<string>()
  const relevance = recognizeDshContract(files)
  const matchedSignals: string[] = [...relevance.relevanceSignals]

  for (const path of paths) {
    words(path).forEach((token) => topicSignals.add(token))
  }
  manifests.forEach((manifest) => addManifestSignals(topicSignals, manifest))
  for (const [path, content] of Object.entries(files)) {
    if (typeof content !== 'string') continue
    if (/(^|\/)(?:package\.json|SKILL\.md|cordis\.patch\.ya?ml|dsh\.bundle\.ya?ml)$/i.test(path)) {
      words(content.slice(0, 200_000)).forEach((token) => topicSignals.add(token))
    }
  }
  for (const path of paths.filter((candidate) => /(?:cordis\.patch\.ya?ml|dsh\.bundle\.ya?ml)$/i.test(candidate))) {
    if (parseYamlDocument(files[path]) !== null) matchedSignals.push(`${path}:parsed`)
  }

  const project = classifyProjectType({
    paths,
    manifests,
    rootManifest,
    topics: topicSignals,
    signals: matchedSignals,
    dshRelevance: relevance.dshRelevance,
  })
  const categoryResult = classifyRepository({
    fullName: 'source/audit',
    name: 'source-audit',
    description: '',
    topics: [...topicSignals],
  })
  const categorySignals = categoryResult.categories.filter((category) => category !== 'other')
  const categoryConfidence: Confidence = categoryResult.category === 'other'
    ? 'low'
    : categoryResult.confidence

  return {
    sourceSha: sourceSha.toLowerCase(),
    classifierVersion: SOURCE_CLASSIFIER_VERSION,
    dshRelevance: relevance.dshRelevance,
    relevanceSignals: relevance.relevanceSignals,
    projectType: project.projectType,
    category: categoryResult.category,
    categories: categoryResult.categories,
    matchedSignals: [...new Set([...matchedSignals, ...categorySignals])],
    typeConfidence: project.confidence,
    categoryConfidence,
    confidence: project.confidence,
  }
}

export function parseSourceClassification(value: unknown): SourceClassification {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Source classification is invalid')
  }
  const raw = value as Record<string, unknown>
  const legacyConfidence = raw.confidence as Confidence
  const dshRelevance = raw.dshRelevance === undefined
    ? 'unrecognized'
    : raw.dshRelevance as DshRelevance
  const relevanceSignals = raw.relevanceSignals === undefined ? [] : raw.relevanceSignals
  const typeConfidence = raw.typeConfidence === undefined ? legacyConfidence : raw.typeConfidence as Confidence
  const categoryConfidence = raw.categoryConfidence === undefined ? legacyConfidence : raw.categoryConfidence as Confidence
  if (typeof raw.sourceSha !== 'string' || !/^[a-f0-9]{40}$/i.test(raw.sourceSha)
    || typeof raw.classifierVersion !== 'string' || raw.classifierVersion.length === 0
    || !PROJECT_TYPE_IDS.has(raw.projectType as ProjectType)
    || !CATEGORY_IDS.has(raw.category as Category)
    || !Array.isArray(raw.categories) || raw.categories.length === 0
    || !raw.categories.every((category) => CATEGORY_IDS.has(category as Category))
    || !Array.isArray(raw.matchedSignals) || !raw.matchedSignals.every((signal) => typeof signal === 'string')
    || !CONFIDENCE_IDS.has(legacyConfidence)
    || !['recognized', 'unrecognized'].includes(dshRelevance)
    || !Array.isArray(relevanceSignals) || !relevanceSignals.every((signal) => typeof signal === 'string')
    || (dshRelevance === 'recognized' && relevanceSignals.length === 0)
    || !CONFIDENCE_IDS.has(typeConfidence)
    || !CONFIDENCE_IDS.has(categoryConfidence)) {
    throw new Error('Source classification is invalid')
  }
  return {
    sourceSha: raw.sourceSha.toLowerCase(),
    classifierVersion: raw.classifierVersion,
    dshRelevance,
    relevanceSignals: [...new Set(relevanceSignals as string[])],
    projectType: raw.projectType as ProjectType,
    category: raw.category as Category,
    categories: [...new Set(raw.categories as Category[])],
    matchedSignals: [...new Set(raw.matchedSignals as string[])],
    typeConfidence,
    categoryConfidence,
    confidence: typeConfidence,
  }
}
