import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { downloadPinnedArchive, extractPinnedArchive } from './archive-downloader'
import { buildValidatorImage } from './baseline-cli'
import { needsLinuxValidatorImage, runCandidateBatch } from './candidate-runner'
import { buildLinuxSandboxPlan } from './linux-sandbox'
import { readReports } from './promotion-cli'
import { executeLinuxSandboxPlan } from './sandbox-runner'
import { writeReportAtomically } from './shadow-runner'

interface CandidateCliOptions {
  reportsPath: string
  outputDir: string
  skipImageBuild: boolean
}

function valueAfter(args: string[], name: string): string | undefined {
  const index = args.indexOf(name)
  return index === -1 ? undefined : args[index + 1]
}

export function parseCandidateCliOptions(args: string[]): CandidateCliOptions {
  const valued = new Set(['--reports', '--output'])
  const known = new Set([...valued, '--skip-image-build'])
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (!known.has(argument)) throw new Error(`Unknown candidate option: ${argument}`)
    if (valued.has(argument)) {
      if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error(`${argument} requires a value`)
      index += 1
    }
  }
  return {
    reportsPath: resolve(valueAfter(args, '--reports') ?? join('validation', 'reports', 'structure')),
    outputDir: resolve(valueAfter(args, '--output') ?? join('validation', 'reports', 'candidates')),
    skipImageBuild: args.includes('--skip-image-build'),
  }
}

export async function runCandidateCli(args = process.argv.slice(2)): Promise<void> {
  const options = parseCandidateCliOptions(args)
  const reports = (await readReports(options.reportsPath))
    .filter(({ currentStatus }) => currentStatus === 'structure_passed')
    .sort((left, right) => left.repository.id - right.repository.id)
  if (!options.skipImageBuild && needsLinuxValidatorImage(reports)) await buildValidatorImage()

  const result = await runCandidateBatch(reports, {
    executeQueued: async (report, plan) => {
      const temporaryRoot = await mkdtemp(join(tmpdir(), `dsh-candidate-${report.repository.id}-`))
      try {
        const archivePath = join(temporaryRoot, 'repository.tar.gz')
        const sourceDirectory = join(temporaryRoot, 'source')
        await downloadPinnedArchive({
          repositoryId: report.repository.id,
          repositoryFullName: report.repository.fullName,
          sourceSha: report.repository.sourceSha,
          destinationPath: archivePath,
        })
        await extractPinnedArchive(archivePath, sourceDirectory)
        const sandboxPlan = buildLinuxSandboxPlan({
          repositoryId: report.repository.id,
          sourceSha: report.repository.sourceSha,
          smokeMode: plan.smokeMode,
        }, {
          runId: `run-${Date.now().toString(36)}`,
          sourceDirectory,
          dshVersion: report.target.dshVersion,
          validatorVersion: report.target.validatorVersion,
        })
        return (await executeLinuxSandboxPlan(report, sandboxPlan)).report
      } finally {
        await rm(temporaryRoot, { recursive: true, force: true })
      }
    },
    onReport: async (report) => {
      await writeReportAtomically(options.outputDir, report)
    },
  })
  process.stdout.write(`${JSON.stringify({
    mode: 'candidates',
    attempted: result.attempted,
    verified: result.verified,
    inconclusive: result.inconclusive,
    failed: result.failed,
  }, null, 2)}\n`)
}

const entrypoint = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (import.meta.url === entrypoint) await runCandidateCli()
