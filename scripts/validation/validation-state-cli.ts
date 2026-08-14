import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { readReports } from './promotion-cli'
import {
  buildValidationState,
  parseValidationSelection,
  parseValidationState,
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

export async function runValidationStateCli(args = process.argv.slice(2)): Promise<void> {
  const catalogPath = resolve(valueAfter(args, '--catalog') ?? join(root, 'src/data/catalog.json'))
  const selectionPath = resolve(valueAfter(args, '--selection') ?? join(root, 'validation/selection.json'))
  const reportsPath = resolve(valueAfter(args, '--reports') ?? join(root, 'validation/reports'))
  const outputPath = resolve(valueAfter(args, '--output') ?? join(root, 'validation/state.json'))
  const state = buildValidationState(
    JSON.parse(await readFile(catalogPath, 'utf8')),
    await readPrevious(valueAfter(args, '--previous')),
    parseValidationSelection(JSON.parse(await readFile(selectionPath, 'utf8'))),
    await readReports(reportsPath),
    new Date().toISOString(),
  )
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
  process.stdout.write(`${JSON.stringify({ entries: state.entries.length })}\n`)
}

const entrypoint = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (import.meta.url === entrypoint) await runValidationStateCli()
