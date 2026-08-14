import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import type { ProjectType } from '../../src/lib/classification'
import type { ValidationReport } from '../../src/lib/validation-report'
import {
  runStructureCheck,
  type RepositoryStructureSnapshot,
  type StructureCheckResult,
  type StructureCheckTarget,
} from './structure-check'

export interface ShadowCatalogRepository {
  repositoryId: number
  fullName: string
  url: string
  pushedAt: string
  projectType: ProjectType
  topics: string[]
  defaultBranch: string
  archived: boolean
  sizeKb: number
}

export interface ShadowRunSummary {
  mode: 'shadow'
  discovered: number
  reportsWritten: number
  decisions: Partial<Record<StructureCheckResult['decision'], number>>
  queueable: number
  reportPaths: string[]
  loadFailures: Array<{
    repositoryId: number
    code: 'SNAPSHOT_LOAD_FAILED'
    reason: '仓库快照或扫描基础设施不可用'
  }>
}

export async function writeReportAtomically(outputDir: string, report: ValidationReport): Promise<string> {
  const repositoryDir = join(outputDir, String(report.repository.id), report.repository.sourceSha)
  const reportKey = createHash('sha256').update(report.reportId).digest('hex')
  const reportPath = join(repositoryDir, `${reportKey}.json`)
  const temporaryPath = join(repositoryDir, `.${reportKey}.${randomUUID()}.tmp`)
  const serialized = `${JSON.stringify(report, null, 2)}\n`
  await mkdir(repositoryDir, { recursive: true })
  try {
    const existing = await readFile(reportPath, 'utf8')
    if (existing !== serialized) throw new Error(`影子报告不可覆盖：${reportPath}`)
    return reportPath
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error
  }
  try {
    await writeFile(temporaryPath, serialized, { encoding: 'utf8', flag: 'wx' })
    await rename(temporaryPath, reportPath)
  } finally {
    await rm(temporaryPath, { force: true })
  }
  return reportPath
}

export async function runShadowBatch({
  repositories,
  outputDir,
  target,
  snapshotLoader,
}: {
  repositories: ShadowCatalogRepository[]
  outputDir: string
  target: StructureCheckTarget
  snapshotLoader: (repository: ShadowCatalogRepository) => Promise<RepositoryStructureSnapshot>
}): Promise<ShadowRunSummary> {
  const summary: ShadowRunSummary = {
    mode: 'shadow',
    discovered: repositories.length,
    reportsWritten: 0,
    decisions: {},
    queueable: 0,
    reportPaths: [],
    loadFailures: [],
  }

  for (const repository of repositories) {
    let snapshot: RepositoryStructureSnapshot
    try {
      snapshot = await snapshotLoader(repository)
    } catch {
      summary.loadFailures.push({
        repositoryId: repository.repositoryId,
        code: 'SNAPSHOT_LOAD_FAILED',
        reason: '仓库快照或扫描基础设施不可用',
      })
      continue
    }
    const result = runStructureCheck(snapshot, target)
    const reportPath = await writeReportAtomically(outputDir, result.report)
    summary.reportsWritten += 1
    summary.decisions[result.decision] = (summary.decisions[result.decision] ?? 0) + 1
    if (result.queueSandbox) summary.queueable += 1
    summary.reportPaths.push(reportPath)
  }

  return summary
}
