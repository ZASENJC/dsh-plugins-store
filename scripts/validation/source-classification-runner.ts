import {
  classifySource,
  type SourceClassification,
} from '../../src/lib/source-classification'
import {
  buildSourceClassificationArchive,
  buildValidationCatalog,
  excludedSourceTypes,
  parseSourceClassificationArchive,
  parseSourceDiscovery,
  selectSourceClassificationTargets,
  type SourceClassificationArchive,
  type SourceClassificationArchiveRecord,
  type SourceClassificationSelection,
  type SourceDiscoveryRepository,
} from '../../src/lib/source-classification-archive'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'

import { downloadPinnedArchive, extractPinnedArchive } from './archive-downloader'
import { loadExtractedSnapshot, resolvePinnedSourceSha } from './archive-snapshot'

interface CliOptions {
  mode: 'plan' | 'run' | 'aggregate'
  discoveryPath: string
  previousPath: string | null
  selectionPath: string | null
  outputPath: string
  validationCatalogPath: string | null
  reportsPath: string | null
  shardIndex: number
  shardCount: number
  forceFull: boolean
}

function valueAfter(args: string[], name: string): string | undefined {
  const index = args.indexOf(name)
  return index === -1 ? undefined : args[index + 1]
}

function parseInteger(value: string | undefined, name: string): number {
  const parsed = Number(value ?? '0')
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`${name} must be a non-negative integer`)
  return parsed
}

function parseOptions(args: string[]): CliOptions {
  const mode = valueAfter(args, '--mode') ?? 'plan'
  if (!['plan', 'run', 'aggregate'].includes(mode)) throw new Error('Invalid source classification mode')
  return {
    mode: mode as CliOptions['mode'],
    discoveryPath: resolve(valueAfter(args, '--discovery') ?? 'validation-input/discovery.json'),
    previousPath: valueAfter(args, '--previous') ? resolve(valueAfter(args, '--previous')!) : null,
    selectionPath: valueAfter(args, '--selection') ? resolve(valueAfter(args, '--selection')!) : null,
    outputPath: resolve(valueAfter(args, '--output') ?? 'validation/classification.json'),
    validationCatalogPath: valueAfter(args, '--validation-catalog')
      ? resolve(valueAfter(args, '--validation-catalog')!)
      : null,
    reportsPath: valueAfter(args, '--reports') ? resolve(valueAfter(args, '--reports')!) : null,
    shardIndex: parseInteger(valueAfter(args, '--shard-index'), '--shard-index'),
    shardCount: Math.max(1, parseInteger(valueAfter(args, '--shard-count'), '--shard-count')),
    forceFull: valueAfter(args, '--force-full') === 'true',
  }
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8'))
}

async function readPrevious(path: string | null): Promise<SourceClassificationArchive | null> {
  if (path === null) return null
  try {
    return parseSourceClassificationArchive(await readJson(path))
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null
    throw error
  }
}

function buildSelection(
  discovery: ReturnType<typeof parseSourceDiscovery>,
  previous: SourceClassificationArchive | null,
  forceFull: boolean,
  shardCount: number,
  generatedAt: string,
): SourceClassificationSelection {
  const targets = selectSourceClassificationTargets(discovery, previous, forceFull)
  const selected = new Set(targets.map(({ repositoryId }) => repositoryId))
  const shards = [...new Set(discovery.repositories.flatMap((repository, index) => (
    selected.has(repository.repositoryId) ? [index % shardCount] : []
  )))].sort((left, right) => left - right)
  return {
    schemaVersion: 1,
    generatedAt,
    mode: targets.length === 0 ? 'none' : previous === null || forceFull ? 'full' : 'incremental',
    repositoryIds: targets.map(({ repositoryId }) => repositoryId),
    shards,
  }
}

function toShadowRepository(repository: SourceDiscoveryRepository) {
  return {
    repositoryId: repository.repositoryId,
    fullName: repository.fullName,
    url: repository.url,
    pushedAt: repository.pushedAt,
    projectType: repository.projectType,
    topics: repository.topics,
    defaultBranch: repository.defaultBranch,
    archived: repository.archived,
    sizeKb: repository.sizeKb,
  }
}

function classificationRecord(
  repository: SourceDiscoveryRepository,
  sourceSha: string | null,
  classification: SourceClassification | undefined,
  failureCode?: string,
): SourceClassificationArchiveRecord {
  const excluded = classification !== undefined && shouldExcludeSourceClassification(classification)
  return {
    repositoryId: repository.repositoryId,
    fullName: repository.fullName,
    sourcePushedAt: repository.pushedAt,
    sourceSha,
    disposition: classification === undefined ? 'inconclusive' : excluded ? 'exclude' : 'include',
    ...(excluded ? { exclusionReason: `source project type is ${classification!.projectType}` } : {}),
    ...(failureCode ? { failureCode } : {}),
    ...(classification ? { classification } : {}),
  }
}

async function classifyRepository(repository: SourceDiscoveryRepository): Promise<SourceClassificationArchiveRecord> {
  let sourceSha: string | null = null
  const temporaryRoot = await mkdtemp(join(tmpdir(), `dsh-source-classification-${repository.repositoryId}-`))
  try {
    const shadowRepository = toShadowRepository(repository)
    sourceSha = await resolvePinnedSourceSha(shadowRepository)
    const archivePath = join(temporaryRoot, 'repository.tar.gz')
    const sourceDirectory = join(temporaryRoot, 'source')
    await downloadPinnedArchive({
      repositoryId: repository.repositoryId,
      repositoryFullName: repository.fullName,
      sourceSha,
      destinationPath: archivePath,
    })
    await extractPinnedArchive(archivePath, sourceDirectory)
    const snapshot = await loadExtractedSnapshot(shadowRepository, {
      sourceSha,
      sourceDirectory,
      scans: {
        trivy: { status: 'unavailable', vulnerabilities: [], secrets: [] },
        osv: { status: 'unavailable', vulnerabilities: [] },
        gitleaks: { status: 'unavailable', secrets: [] },
      },
    })
    return classificationRecord(repository, sourceSha, classifySourceSnapshot({ sourceSha, files: snapshot.files }))
  } catch (error) {
    const failureCode = error instanceof Error && error.message.includes('size limit')
      ? 'SOURCE_CLASSIFICATION_SIZE_LIMIT'
      : 'SOURCE_CLASSIFICATION_FAILED'
    return classificationRecord(repository, sourceSha, undefined, failureCode)
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true })
  }
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function listJsonFiles(directory: string): Promise<string[]> {
  try {
    const entries = await readdir(directory, { withFileTypes: true })
    const files: string[] = []
    for (const entry of entries) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) files.push(...await listJsonFiles(path))
      else if (entry.isFile() && entry.name.endsWith('.json')) files.push(path)
    }
    return files
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return []
    throw error
  }
}

export async function runSourceClassificationCli(args = process.argv.slice(2)): Promise<void> {
  const options = parseOptions(args)
  const discovery = parseSourceDiscovery(await readJson(options.discoveryPath))
  const previous = await readPrevious(options.previousPath)
  const now = new Date().toISOString()

  if (options.mode === 'plan') {
    const selection = buildSelection(discovery, previous, options.forceFull, options.shardCount, now)
    await writeJson(options.outputPath, selection)
    process.stdout.write(`${JSON.stringify({
      mode: selection.mode,
      repositoryCount: selection.repositoryIds.length,
      shards: selection.shards,
    })}\n`)
    return
  }

  if (options.mode === 'run') {
    if (options.selectionPath === null) throw new Error('Source classification run requires --selection')
    const selection = await readJson(options.selectionPath) as SourceClassificationSelection
    const selected = new Set(selection.repositoryIds)
    const repositories = discovery.repositories.filter((repository, index) => (
      index % options.shardCount === options.shardIndex && selected.has(repository.repositoryId)
    ))
    const records: SourceClassificationArchiveRecord[] = []
    for (const repository of repositories) records.push(await classifyRepository(repository))
    await writeJson(options.outputPath, { schemaVersion: 1, records })
    process.stdout.write(`${JSON.stringify({ shard: options.shardIndex, discovered: repositories.length, reportsWritten: records.length })}\n`)
    return
  }

  if (options.reportsPath === null || options.validationCatalogPath === null) {
    throw new Error('Source classification aggregation requires --reports and --validation-catalog')
  }
  const resultFiles = await listJsonFiles(options.reportsPath)
  const results: SourceClassificationArchiveRecord[] = []
  for (const path of resultFiles) {
    const value = await readJson(path)
    if (!value || typeof value !== 'object' || !Array.isArray((value as { records?: unknown }).records)) continue
    for (const record of (value as { records: unknown[] }).records) results.push(record as SourceClassificationArchiveRecord)
  }
  const mode = previous === null || options.forceFull ? 'full' : 'incremental'
  const archive = buildSourceClassificationArchive({ discovery, previous, results, mode, generatedAt: now })
  await writeJson(options.outputPath, archive)
  await writeJson(options.validationCatalogPath, buildValidationCatalog(discovery, archive))
  process.stdout.write(`${JSON.stringify({
    mode,
    repositories: archive.records.length,
    excluded: archive.records.filter(({ disposition }) => disposition === 'exclude').length,
    inconclusive: archive.records.filter(({ disposition }) => disposition === 'inconclusive').length,
  })}\n`)
}

const entrypoint = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (import.meta.url === entrypoint) await runSourceClassificationCli()

export function classifySourceSnapshot({
  sourceSha,
  files,
}: {
  sourceSha: string
  files: Readonly<Record<string, string | undefined>>
}): SourceClassification {
  return classifySource({ sourceSha, files })
}

export function shouldExcludeSourceClassification(classification: SourceClassification): boolean {
  return classification.confidence !== 'low'
    && excludedSourceTypes().has(classification.projectType)
}
