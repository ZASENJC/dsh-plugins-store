import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { parseValidationFeed } from '../../src/lib/validation'
import { parseValidationState } from './validation-state'

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8'))
}

export async function verifyValidationArtifact(directory: string): Promise<void> {
  const root = resolve(directory)
  const feedValue = await readJson(`${root}/validation.json`)
  const stateValue = await readJson(`${root}/state.json`)
  const records = parseValidationFeed(feedValue)
  const state = parseValidationState(stateValue)

  for (const record of records.values()) {
    if (record.sandbox.status !== 'passed') continue
    if (record.dshVersion !== state.target.dshVersion
      || record.platform !== state.target.platform
      || record.validatorVersion !== state.target.validatorVersion) {
      throw new Error(`Validation record ${record.repositoryId} is not bound to the artifact target`)
    }
  }
}

export async function runVerifyValidationArtifactCli(args = process.argv.slice(2)): Promise<void> {
  const directory = args[0]
  if (!directory || args.length !== 1) throw new Error('Usage: verify-validation-artifact <directory>')
  await verifyValidationArtifact(directory)
  process.stdout.write('Validation artifact schema and binding verified.\n')
}

const entrypoint = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (import.meta.url === entrypoint) await runVerifyValidationArtifactCli()
