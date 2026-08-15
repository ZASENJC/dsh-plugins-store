import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  buildValidationCatalog,
  parseSourceClassificationArchive,
  parseSourceDiscovery,
} from '../../src/lib/source-classification-archive'
import { parseValidationReport, type ValidationReport } from '../../src/lib/validation-report'
import { parseValidationSelection } from './validation-state'
import { buildValidationArchive } from './validation-archive'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

function valueAfter(args: string[], name: string): string | undefined {
  const index = args.indexOf(name)
  return index === -1 ? undefined : args[index + 1]
}

async function readReports(directory: string): Promise<ValidationReport[]> {
  let entries
  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return []
    throw error
  }
  const reports: ValidationReport[] = []
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) reports.push(...await readReports(path))
    else if (entry.isFile() && entry.name.endsWith('.json')) {
      try {
        reports.push(parseValidationReport(JSON.parse(await readFile(path, 'utf8'))))
      } catch {
        // A malformed or truncated report is represented by VALIDATION_NOT_OBSERVED
        // for its selected repository instead of failing the whole shard aggregate.
      }
    }
  }
  return reports
}

export async function runValidationArchiveCli(args = process.argv.slice(2)): Promise<void> {
  const classificationPath = resolve(valueAfter(args, '--classification') ?? join(root, 'validation/source-classification.json'))
  const selectionPath = resolve(valueAfter(args, '--selection') ?? join(root, 'validation/selection.json'))
  const reportsPath = resolve(valueAfter(args, '--reports') ?? join(root, 'validation/reports'))
  const discoveryPath = resolve(valueAfter(args, '--discovery') ?? join(root, 'validation-input/discovery.json'))
  const outputPath = resolve(valueAfter(args, '--output') ?? join(root, 'validation/source-classification.json'))
  const catalogPath = resolve(valueAfter(args, '--validation-catalog') ?? join(root, 'validation/validation-catalog.json'))
  const summaryPath = valueAfter(args, '--summary')
    ? resolve(valueAfter(args, '--summary')!)
    : null
  const generatedAt = new Date().toISOString()
  const archive = parseSourceClassificationArchive(JSON.parse(await readFile(classificationPath, 'utf8')))
  const selection = parseValidationSelection(JSON.parse(await readFile(selectionPath, 'utf8')))
  const reports = await readReports(reportsPath)
  const result = buildValidationArchive(archive, selection, reports, generatedAt)
  const discovery = parseSourceDiscovery(JSON.parse(await readFile(discoveryPath, 'utf8')))
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(result.archive, null, 2)}\n`, 'utf8')
  await mkdir(dirname(catalogPath), { recursive: true })
  await writeFile(catalogPath, `${JSON.stringify(buildValidationCatalog(discovery, result.archive), null, 2)}\n`, 'utf8')
  if (summaryPath !== null) {
    const byId = new Map(result.archive.records.map((record) => [record.repositoryId, record]))
    await mkdir(dirname(summaryPath), { recursive: true })
    await writeFile(summaryPath, `${JSON.stringify({
      schemaVersion: 1,
      generatedAt,
      verified: result.verified.map((repositoryId) => {
        const record = byId.get(repositoryId)
        return { repositoryId, fullName: record?.fullName ?? null, sourceSha: record?.sourceSha ?? null }
      }),
      autoFailed: result.autoFailed.map((repositoryId) => {
        const record = byId.get(repositoryId)
        const validation = record?.validation
        return {
          repositoryId,
          fullName: record?.fullName ?? null,
          sourceSha: record?.sourceSha ?? null,
          errorCode: validation?.errorCode ?? 'VALIDATION_FAILED',
        }
      }),
      retryable: result.retryable.map((repositoryId) => {
        const record = byId.get(repositoryId)
        const validation = record?.validation
        return {
          repositoryId,
          fullName: record?.fullName ?? null,
          sourceSha: record?.sourceSha ?? null,
          errorCode: validation?.errorCode ?? 'VALIDATION_NOT_OBSERVED',
        }
      }),
      manualReview: result.manualReview.map((repositoryId) => {
        const record = byId.get(repositoryId)
        const validation = record?.validation
        return {
          repositoryId,
          fullName: record?.fullName ?? null,
          sourceSha: record?.sourceSha ?? null,
          errorCode: validation?.errorCode ?? 'VALIDATION_NOT_OBSERVED',
        }
      }),
    }, null, 2)}\n`, 'utf8')
  }
  process.stdout.write(`${JSON.stringify({
    verified: result.verified,
    autoFailed: result.autoFailed,
    retryable: result.retryable,
    manualReview: result.manualReview,
    reportsObserved: reports.length,
  })}\n`)
}

const entrypoint = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (import.meta.url === entrypoint) await runValidationArchiveCli()
