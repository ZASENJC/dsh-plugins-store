import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { assertValidationInputConsistency } from './validation-input'

function valueAfter(args: string[], name: string): string {
  const index = args.indexOf(name)
  const value = index === -1 ? undefined : args[index + 1]
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`)
  return resolve(value)
}

export async function runValidationInputCli(args = process.argv.slice(2)): Promise<void> {
  const discovery = JSON.parse(await readFile(valueAfter(args, '--discovery'), 'utf8'))
  const validationCatalog = JSON.parse(await readFile(valueAfter(args, '--validation-catalog'), 'utf8'))
  const selectionPath = args.includes('--selection') ? valueAfter(args, '--selection') : undefined
  const selection = selectionPath === undefined ? undefined : JSON.parse(await readFile(selectionPath, 'utf8'))
  process.stdout.write(`${JSON.stringify(assertValidationInputConsistency(discovery, validationCatalog, selection))}\n`)
}

const entrypoint = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (import.meta.url === entrypoint) await runValidationInputCli()
