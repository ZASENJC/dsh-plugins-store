import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

import type { ValidationReport } from '../../src/lib/validation-report'
import { downloadPinnedArchive, extractPinnedArchive } from './archive-downloader'
import { parseBaseline, type BaselineTarget } from './baseline'
import { runCandidateBatch } from './candidate-runner'
import { discoverCatalogRepositories } from './shadow-cli'
import { loadGitHubSnapshot } from './github-snapshot'
import { buildLinuxSandboxPlan } from './linux-sandbox'
import { executeLinuxSandboxPlan } from './sandbox-runner'
import { runScannerCommands, type ScannerResults } from './scanner-adapters'
import { writeReportAtomically, type ShadowCatalogRepository } from './shadow-runner'
import { runStructureCheck } from './structure-check'

const execFileAsync = promisify(execFile)
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

function unavailableScans(): ScannerResults {
  return {
    trivy: { status: 'unavailable', vulnerabilities: [], secrets: [] },
    osv: { status: 'unavailable', vulnerabilities: [] },
    gitleaks: { status: 'unavailable', secrets: [] },
  }
}

export function selectBaselineTargets(
  targets: BaselineTarget[],
  { repositoryId, limit }: { repositoryId: number | null, limit: number },
): BaselineTarget[] {
  if (repositoryId !== null) {
    const target = targets.find((candidate) => candidate.repositoryId === repositoryId)
    if (!target) throw new Error(`Repository ${repositoryId} is not in the baseline`)
    return [target]
  }
  return limit > 0 ? targets.slice(0, limit) : targets
}

export function evaluateBaselineOutcome(
  target: BaselineTarget,
  report: ValidationReport,
): { expected: boolean, observed: ValidationReport['currentStatus'] } {
  return {
    expected: target.expectedFinalStatuses.includes(
      report.currentStatus as BaselineTarget['expectedFinalStatuses'][number],
    ),
    observed: report.currentStatus,
  }
}

export function resolveBaselineRepository(
  target: BaselineTarget,
  catalogRepository: ShadowCatalogRepository | undefined,
): ShadowCatalogRepository {
  return catalogRepository ?? {
    repositoryId: target.repositoryId,
    fullName: target.fullName,
    url: `https://github.com/${target.fullName}`,
    pushedAt: '1970-01-01T00:00:00.000Z',
    projectType: 'plugin',
    topics: [],
    defaultBranch: 'main',
    archived: false,
    sizeKb: 0,
  }
}

interface BaselineCliOptions {
  outputDir: string
  repositoryId: number | null
  limit: number
  skipImageBuild: boolean
}

function optionValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name)
  return index === -1 ? undefined : args[index + 1]
}

function nonNegativeInteger(value: string | undefined, fallback: number, name: string): number {
  const parsed = value === undefined ? fallback : Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`${name} must be a non-negative integer`)
  return parsed
}

function parseOptions(args: string[]): BaselineCliOptions {
  const known = new Set(['--output', '--repository-id', '--limit', '--skip-image-build'])
  for (let index = 0; index < args.length; index += 1) {
    if (!known.has(args[index])) throw new Error(`Unknown baseline option: ${args[index]}`)
    if (args[index] !== '--skip-image-build') index += 1
  }
  const repositoryId = nonNegativeInteger(optionValue(args, '--repository-id'), 0, '--repository-id')
  return {
    outputDir: resolve(optionValue(args, '--output') ?? join(root, 'validation/reports/baseline')),
    repositoryId: repositoryId === 0 ? null : repositoryId,
    limit: nonNegativeInteger(optionValue(args, '--limit'), 0, '--limit'),
    skipImageBuild: args.includes('--skip-image-build'),
  }
}

export async function buildValidatorImage(): Promise<void> {
  await execFileAsync('docker', [
    'build', '--platform=linux/amd64',
    '--tag', 'dsh-plugin-validator:0.1.1',
    '--file', join(root, 'validation/sandbox/Dockerfile'),
    root,
  ], { maxBuffer: 32 * 1024 * 1024 })
}

export async function runBaselineCli(args = process.argv.slice(2)): Promise<void> {
  const options = parseOptions(args)
  const baseline = parseBaseline(JSON.parse(await readFile(join(root, 'validation/baseline.json'), 'utf8')))
  const catalog = discoverCatalogRepositories(JSON.parse(await readFile(join(root, 'src/data/catalog.json'), 'utf8')))
  const catalogById = new Map(catalog.map((repository) => [repository.repositoryId, repository]))
  const targets = selectBaselineTargets(baseline.targets, options)
  if (!options.skipImageBuild) await buildValidatorImage()

  const observations: Array<{
    repositoryId: number
    expected: boolean
    observed?: ValidationReport['currentStatus']
    code?: string
    reportPath?: string
  }> = []
  for (const target of targets) {
    const repository = resolveBaselineRepository(target, catalogById.get(target.repositoryId))
    const temporaryRoot = await mkdtemp(join(tmpdir(), `dsh-baseline-${target.repositoryId}-`))
    try {
      const snapshot = await loadGitHubSnapshot(repository, {
        sourceSha: target.sourceSha,
        scans: unavailableScans(),
      })
      const archivePath = join(temporaryRoot, 'repository.tar.gz')
      const sourceDirectory = join(temporaryRoot, 'source')
      await downloadPinnedArchive({
        repositoryId: target.repositoryId,
        repositoryFullName: snapshot.repository.fullName,
        sourceSha: target.sourceSha,
        destinationPath: archivePath,
      })
      await extractPinnedArchive(archivePath, sourceDirectory)
      snapshot.scans = await runScannerCommands(sourceDirectory)
      const now = new Date().toISOString()
      const structure = runStructureCheck(snapshot, {
        now,
        dshVersion: baseline.dshVersion,
        nodeVersion: process.version.replace(/^v/, ''),
        validatorVersion: baseline.validatorVersion,
        platform: baseline.platform,
      })
      let report = structure.report
      if (structure.decision === 'passed' && structure.report.executionType === target.executionType) {
        const batch = await runCandidateBatch([report], {
          executeQueued: async (candidateReport) => {
            const plan = buildLinuxSandboxPlan(target, {
              runId: `run-${Date.now().toString(36)}`,
              sourceDirectory,
              dshVersion: baseline.dshVersion,
              validatorVersion: baseline.validatorVersion,
            })
            return (await executeLinuxSandboxPlan(candidateReport, plan)).report
          },
        })
        report = batch.reports[0]
      }
      const reportPath = await writeReportAtomically(options.outputDir, report)
      observations.push({ repositoryId: target.repositoryId, ...evaluateBaselineOutcome(target, report), reportPath })
    } catch {
      observations.push({ repositoryId: target.repositoryId, expected: false, code: 'BASELINE_INFRASTRUCTURE_FAILED' })
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true })
    }
  }
  process.stdout.write(`${JSON.stringify({ mode: 'baseline', observations }, null, 2)}\n`)
}

const entrypoint = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (import.meta.url === entrypoint) await runBaselineCli()
