import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { PROJECT_TYPES, type ProjectType } from '../../src/lib/classification'
import { parseSourceDiscovery } from '../../src/lib/source-classification-archive'
import { downloadPinnedArchive, extractPinnedArchive } from './archive-downloader'
import { loadExtractedSnapshot, resolvePinnedSourceSha } from './archive-snapshot'
import { runScannerCommands, type ScannerResults } from './scanner-adapters'
import { runShadowBatch, type ShadowCatalogRepository } from './shadow-runner'
import { parseValidationSelection } from './validation-state'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const projectTypeIds = new Set<string>(PROJECT_TYPES.map(({ id }) => id))

function unavailableScans(): ScannerResults {
  return {
    trivy: { status: 'unavailable', vulnerabilities: [], secrets: [] },
    osv: { status: 'unavailable', vulnerabilities: [] },
    gitleaks: { status: 'unavailable', secrets: [] },
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

export function discoverCatalogRepositories(value: unknown): ShadowCatalogRepository[] {
  const catalog = asRecord(value)
  if (!catalog || catalog.schemaVersion !== 1 || !Array.isArray(catalog.repositories)) {
    throw new Error('Catalog discovery source is invalid')
  }
  if (catalog.repositories.some((raw) => asRecord(raw)?.full_name !== undefined)) {
    const discovery = parseSourceDiscovery(value)
    return discovery.repositories.map((repository) => ({
      repositoryId: repository.repositoryId,
      fullName: repository.fullName,
      url: repository.url,
      pushedAt: repository.pushedAt,
      projectType: repository.projectType,
      topics: repository.topics,
      defaultBranch: repository.defaultBranch,
      archived: repository.archived,
      sizeKb: repository.sizeKb,
    }))
  }
  const repositories = catalog.repositories.map((raw): ShadowCatalogRepository => {
    const repository = asRecord(raw)
    if (!repository
      || !Number.isSafeInteger(repository.repositoryId)
      || Number(repository.repositoryId) <= 0
      || typeof repository.fullName !== 'string'
      || typeof repository.url !== 'string'
      || typeof repository.pushedAt !== 'string'
      || typeof repository.projectType !== 'string'
      || !projectTypeIds.has(repository.projectType)
      || !Array.isArray(repository.topics)
      || !repository.topics.every((topic) => typeof topic === 'string')
      || typeof repository.defaultBranch !== 'string'
      || typeof repository.archived !== 'boolean'
      || (!Number.isSafeInteger(repository.size) && !Number.isSafeInteger(repository.sizeKb))
      || Number(repository.size ?? repository.sizeKb) < 0) {
      throw new Error('Catalog repository discovery record is invalid')
    }
    return {
      repositoryId: Number(repository.repositoryId),
      fullName: repository.fullName,
      url: repository.url,
      pushedAt: repository.pushedAt,
      projectType: repository.projectType as ProjectType,
      topics: repository.topics as string[],
      defaultBranch: repository.defaultBranch,
      archived: repository.archived,
      sizeKb: Number(repository.size ?? repository.sizeKb),
    }
  })
  return repositories.sort((left, right) => left.repositoryId - right.repositoryId)
}

export function selectRepositoryShard(
  repositories: ShadowCatalogRepository[],
  shardIndex: number,
  shardCount: number,
  selectedRepositoryIds?: ReadonlySet<number>,
  shardPlan?: ReadonlyMap<number, number>,
): ShadowCatalogRepository[] {
  if (!Number.isSafeInteger(shardCount) || shardCount < 1
    || !Number.isSafeInteger(shardIndex) || shardIndex < 0 || shardIndex >= shardCount) {
    throw new Error('Invalid validation shard coordinates')
  }
  return repositories.filter((repository, index) => (
    (shardPlan?.get(repository.repositoryId) ?? (index % shardCount)) === shardIndex
    && (selectedRepositoryIds === undefined || selectedRepositoryIds.has(repository.repositoryId))
  ))
}

interface CliOptions {
  discoveryPath: string
  outputDir: string
  shardIndex: number
  shardCount: number
  limit: number
  selectionPath: string | null
}

function parseInteger(value: string | undefined, option: string): number {
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`${option} must be a non-negative integer`)
  return parsed
}

export function parseShadowCliOptions(args: string[]): CliOptions {
  const values = new Map<string, string>()
  for (let index = 0; index < args.length; index += 2) {
    const option = args[index]
    const value = args[index + 1]
    if (!option?.startsWith('--') || value === undefined) throw new Error(`Invalid shadow CLI argument: ${option ?? ''}`)
    values.set(option, value)
  }
  return {
    discoveryPath: resolve(values.get('--discovery') ?? join(root, 'src/data/catalog.json')),
    outputDir: resolve(values.get('--output') ?? join(root, 'validation/reports')),
    shardIndex: parseInteger(values.get('--shard-index') ?? '0', '--shard-index'),
    shardCount: parseInteger(values.get('--shard-count') ?? '1', '--shard-count'),
    limit: parseInteger(values.get('--limit') ?? '0', '--limit'),
    selectionPath: values.has('--selection') ? resolve(values.get('--selection')!) : null,
  }
}

export async function runShadowCli(args = process.argv.slice(2)): Promise<void> {
  const options = parseShadowCliOptions(args)
  const catalog = JSON.parse(await readFile(options.discoveryPath, 'utf8'))
  const discovered = discoverCatalogRepositories(catalog)
  const selection = options.selectionPath === null
    ? null
    : parseValidationSelection(JSON.parse(await readFile(options.selectionPath, 'utf8')))
  const selected = selection === null ? undefined : new Set(selection.repositoryIds)
  const shardPlan = selection?.shardPlan === undefined
    ? undefined
    : new Map(selection.shardPlan.map(({ repositoryId, shard }) => [repositoryId, shard]))
  const shard = selectRepositoryShard(discovered, options.shardIndex, options.shardCount, selected, shardPlan)
  const repositories = options.limit > 0 ? shard.slice(0, options.limit) : shard
  const now = new Date().toISOString()

  const summary = await runShadowBatch({
    repositories,
    outputDir: options.outputDir,
    snapshotAttempts: 3,
    target: {
      now,
      dshVersion: process.env.DSH_VALIDATION_VERSION ?? '0.1.0-rc.6',
      nodeVersion: process.version.replace(/^v/, ''),
      validatorVersion: process.env.VALIDATOR_VERSION ?? '0.1.0',
      platform: 'linux-x64',
    },
    snapshotLoader: async (repository) => {
      const sourceSha = await resolvePinnedSourceSha(repository)
      const temporaryRoot = await mkdtemp(join(tmpdir(), `dsh-validation-${repository.repositoryId}-`))
      try {
        const archivePath = join(temporaryRoot, 'repository.tar.gz')
        const sourceDirectory = join(temporaryRoot, 'source')
        await downloadPinnedArchive({
          repositoryId: repository.repositoryId,
          repositoryFullName: repository.fullName,
          sourceSha,
          destinationPath: archivePath,
        })
        await extractPinnedArchive(archivePath, sourceDirectory)
        const snapshot = await loadExtractedSnapshot(repository, {
          sourceSha,
          sourceDirectory,
          scans: unavailableScans(),
        })
        snapshot.scans = await runScannerCommands(sourceDirectory)
        return snapshot
      } finally {
        await rm(temporaryRoot, { recursive: true, force: true })
      }
    },
  })
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
}

const entrypoint = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (import.meta.url === entrypoint) {
  await runShadowCli()
}
