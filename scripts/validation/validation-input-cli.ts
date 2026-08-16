import { readFile, readdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import {
  mergeSourceValidationHistory,
  parseSourceClassificationArchive,
} from '../../src/lib/source-classification-archive'
import { assertValidationInputConsistency } from './validation-input'

function optionalValueAfter(args: string[], name: string): string | undefined {
  const index = args.indexOf(name)
  if (index === -1) return undefined
  const value = args[index + 1]
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`)
  return resolve(value)
}

function valueAfter(args: string[], name: string): string {
  const value = optionalValueAfter(args, name)
  if (!value) throw new Error(`${name} requires a value`)
  return value
}

export async function runValidationInputCli(args = process.argv.slice(2)): Promise<void> {
  const discovery = JSON.parse(await readFile(valueAfter(args, '--discovery'), 'utf8'))
  const validationCatalog = JSON.parse(await readFile(valueAfter(args, '--validation-catalog'), 'utf8'))
  const selectionPath = optionalValueAfter(args, '--selection')
  const selection = selectionPath === undefined ? undefined : JSON.parse(await readFile(selectionPath, 'utf8'))
  const classificationPath = optionalValueAfter(args, '--classification')
  const historyDirectory = optionalValueAfter(args, '--validation-history-directory')
  if ((classificationPath === undefined) !== (historyDirectory === undefined)) {
    throw new Error('--classification and --validation-history-directory must be used together')
  }
  let validationHistoryArchives = 0
  if (classificationPath && historyDirectory) {
    const historyPaths = (await readdir(historyDirectory, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map((entry) => resolve(historyDirectory, entry.name))
      .sort()
    const current = parseSourceClassificationArchive(JSON.parse(await readFile(classificationPath, 'utf8')))
    const histories = await Promise.all(historyPaths.map(async (path) => (
      parseSourceClassificationArchive(JSON.parse(await readFile(path, 'utf8')))
    )))
    const merged = mergeSourceValidationHistory(current, histories)
    await writeFile(classificationPath, `${JSON.stringify(merged, null, 2)}\n`, 'utf8')
    validationHistoryArchives = histories.length
  }
  process.stdout.write(`${JSON.stringify(assertValidationInputConsistency(discovery, validationCatalog, selection))}\n`)
  if (validationHistoryArchives > 0) {
    process.stderr.write(`Merged exact-SHA validation history from ${validationHistoryArchives} archives.\n`)
  }
}

const entrypoint = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (import.meta.url === entrypoint) await runValidationInputCli()
