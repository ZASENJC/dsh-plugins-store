import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { parseBaseline } from './baseline'
import { parseValidationFeed } from '../../src/lib/validation'
import {
  parseValidationState,
  reconcileValidationState,
  selectValidationDelta,
  type ValidationState,
} from './validation-state'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

function valueAfter(args: string[], name: string): string | undefined {
  const index = args.indexOf(name)
  return index === -1 ? undefined : args[index + 1]
}

async function readPrevious(path: string | undefined): Promise<ValidationState | null> {
  if (!path) return null
  try {
    return parseValidationState(JSON.parse(await readFile(resolve(path), 'utf8')))
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null
    throw error
  }
}

export async function runValidationSelectCli(args = process.argv.slice(2)): Promise<void> {
  const catalogPath = resolve(valueAfter(args, '--catalog') ?? join(root, 'src/data/catalog.json'))
  const baselinePath = resolve(valueAfter(args, '--baseline') ?? join(root, 'validation/baseline.json'))
  const outputPath = resolve(valueAfter(args, '--output') ?? join(root, 'validation/selection.json'))
  const shardCount = Number(valueAfter(args, '--shard-count') ?? '20')
  const catalog = JSON.parse(await readFile(catalogPath, 'utf8'))
  const baselineSource = await readFile(baselinePath, 'utf8')
  const baseline = parseBaseline(JSON.parse(baselineSource))
  const previousPath = valueAfter(args, '--previous')
  const target = {
    dshVersion: baseline.dshVersion,
    platform: baseline.platform,
    validatorVersion: baseline.validatorVersion,
    baselineDigest: createHash('sha256').update(baselineSource).digest('hex'),
  }
  const now = new Date().toISOString()
  let previous = await readPrevious(previousPath)
  const previousFeedPath = valueAfter(args, '--previous-feed')
  if (previousFeedPath) {
    previous = reconcileValidationState(
      catalog,
      previous,
      parseValidationFeed(JSON.parse(await readFile(resolve(previousFeedPath), 'utf8'))),
      target,
      now,
    )
    if (previous !== null && previousPath) {
      const resolvedPreviousPath = resolve(previousPath)
      await mkdir(dirname(resolvedPreviousPath), { recursive: true })
      await writeFile(resolvedPreviousPath, `${JSON.stringify(previous, null, 2)}\n`, 'utf8')
    }
  }
  const selection = selectValidationDelta(
    catalog,
    previous,
    target,
    shardCount,
    now,
  )
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(selection, null, 2)}\n`, 'utf8')
  process.stdout.write(`${JSON.stringify({
    mode: selection.mode,
    firstRun: selection.mode === 'full',
    repositoryCount: selection.repositoryIds.length,
    shards: selection.shards,
  })}\n`)
}

const entrypoint = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (import.meta.url === entrypoint) await runValidationSelectCli()
