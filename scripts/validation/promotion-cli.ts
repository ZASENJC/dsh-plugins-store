import { randomUUID } from 'node:crypto'
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { parseValidationReport, type ValidationReport } from '../../src/lib/validation-report'
import type { ValidationFeed } from '../../src/lib/validation'
import { parseBaseline } from './baseline'
import { assessPromotionGate, buildPublicValidationFeed, mergeValidationFeeds } from './promotion'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

export interface PromotionOptions {
  baselinePath: string
  reportsPath: string
  gateReportsPath: string
  previousFeedPath: string | null
  outputPath: string
  publish: boolean
}

function valueAfter(args: string[], name: string): string | undefined {
  const index = args.indexOf(name)
  return index === -1 ? undefined : args[index + 1]
}

export function parsePromotionOptions(args: string[]): PromotionOptions {
  const valued = new Set(['--baseline', '--reports', '--gate-reports', '--previous-feed', '--output'])
  const known = new Set([...valued, '--publish'])
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (!known.has(argument)) throw new Error(`Unknown promotion option: ${argument}`)
    if (valued.has(argument)) {
      if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error(`${argument} requires a value`)
      index += 1
    }
  }
  const reportsPath = resolve(valueAfter(args, '--reports') ?? join(root, 'validation/reports'))
  return {
    baselinePath: resolve(valueAfter(args, '--baseline') ?? join(root, 'validation/baseline.json')),
    reportsPath,
    gateReportsPath: resolve(valueAfter(args, '--gate-reports') ?? reportsPath),
    previousFeedPath: valueAfter(args, '--previous-feed')
      ? resolve(valueAfter(args, '--previous-feed')!)
      : null,
    outputPath: resolve(valueAfter(args, '--output') ?? join(root, 'src/data/validation.json')),
    publish: args.includes('--publish'),
  }
}

export async function readReports(directory: string): Promise<ValidationReport[]> {
  const reports: ValidationReport[] = []
  let entries
  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return reports
    throw error
  }
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) reports.push(...await readReports(path))
    else if (entry.isFile() && entry.name.endsWith('.json')) {
      reports.push(parseValidationReport(JSON.parse(await readFile(path, 'utf8'))))
    }
  }
  return reports
}

export async function writePromotionOutput({
  outputPath,
  feed,
  publish,
  eligible,
}: {
  outputPath: string
  feed: ValidationFeed
  publish: boolean
  eligible: boolean
}): Promise<{ published: boolean }> {
  if (!publish) return { published: false }
  if (!eligible) throw new Error('P4 质量门禁未通过，拒绝发布')
  const temporaryPath = join(dirname(outputPath), `.${randomUUID()}.tmp`)
  await mkdir(dirname(outputPath), { recursive: true })
  try {
    await writeFile(temporaryPath, `${JSON.stringify(feed, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' })
    await rename(temporaryPath, outputPath)
  } finally {
    await rm(temporaryPath, { force: true })
  }
  return { published: true }
}

export async function runPromotionCli(args = process.argv.slice(2)): Promise<void> {
  const options = parsePromotionOptions(args)
  const baseline = parseBaseline(JSON.parse(await readFile(options.baselinePath, 'utf8')))
  const reports = await readReports(options.reportsPath)
  const gateReports = options.gateReportsPath === options.reportsPath
    ? reports
    : await readReports(options.gateReportsPath)
  const publicationReports = options.gateReportsPath === options.reportsPath
    ? reports
    : [...gateReports, ...reports]
  const assessment = assessPromotionGate(baseline, gateReports)
  const currentFeed = assessment.eligible
    ? buildPublicValidationFeed(baseline, publicationReports, new Date().toISOString(), gateReports)
    : { schemaVersion: 1 as const, generatedAt: new Date().toISOString(), records: [] }
  const feed = assessment.eligible && options.previousFeedPath
    ? mergeValidationFeeds(
      JSON.parse(await readFile(options.previousFeedPath, 'utf8')) as ValidationFeed,
      currentFeed,
    )
    : currentFeed
  const result = await writePromotionOutput({
    outputPath: options.outputPath,
    feed,
    publish: options.publish,
    eligible: assessment.eligible,
  })
  process.stdout.write(`${JSON.stringify({ mode: options.publish ? 'publish' : 'observe', assessment, ...result }, null, 2)}\n`)
}

const entrypoint = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (import.meta.url === entrypoint) await runPromotionCli()
