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
    code: 'SNAPSHOT_LOAD_FAILED' | 'STRUCTURE_CHECK_FAILED' | 'REPORT_WRITE_FAILED'
    reason: string
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
  snapshotAttempts = 1,
  concurrency = 1,
}: {
  repositories: ShadowCatalogRepository[]
  outputDir: string
  target: StructureCheckTarget
  snapshotLoader: (repository: ShadowCatalogRepository) => Promise<RepositoryStructureSnapshot>
  snapshotAttempts?: number
  concurrency?: number
}): Promise<ShadowRunSummary> {
  if (!Number.isSafeInteger(snapshotAttempts) || snapshotAttempts < 1) {
    throw new Error('Snapshot attempts must be a positive integer')
  }
  if (!Number.isSafeInteger(concurrency) || concurrency < 1) {
    throw new Error('Shadow concurrency must be a positive integer')
  }
  const summary: ShadowRunSummary = {
    mode: 'shadow',
    discovered: repositories.length,
    reportsWritten: 0,
    decisions: {},
    queueable: 0,
    reportPaths: [],
    loadFailures: [],
  }

  let nextIndex = 0
  async function runWorker(): Promise<void> {
    while (true) {
      const index = nextIndex
      nextIndex += 1
      if (index >= repositories.length) return
      const repository = repositories[index]
      let snapshot: RepositoryStructureSnapshot | undefined
      let loaded = false
      for (let attempt = 1; attempt <= snapshotAttempts; attempt += 1) {
        try {
          snapshot = await snapshotLoader(repository)
          loaded = true
          break
        } catch {
          // Transient GitHub, download, and scanner errors are retried before the
          // repository is left in the archive retry queue.
        }
      }
      if (!loaded || snapshot === undefined) {
        summary.loadFailures.push({
          repositoryId: repository.repositoryId,
          code: 'SNAPSHOT_LOAD_FAILED',
          reason: '仓库快照或扫描基础设施不可用',
        })
        continue
      }
      let result: StructureCheckResult
      try {
        result = runStructureCheck(snapshot, target)
      } catch {
        summary.loadFailures.push({
          repositoryId: repository.repositoryId,
          code: 'STRUCTURE_CHECK_FAILED',
          reason: '源码结构检查发生未预期错误',
        })
        continue
      }
      try {
        const reportPath = await writeReportAtomically(outputDir, result.report)
        summary.reportsWritten += 1
        summary.decisions[result.decision] = (summary.decisions[result.decision] ?? 0) + 1
        if (result.queueSandbox) summary.queueable += 1
        summary.reportPaths.push(reportPath)
      } catch {
        summary.loadFailures.push({
          repositoryId: repository.repositoryId,
          code: 'REPORT_WRITE_FAILED',
          reason: '验证报告无法写入工作区',
        })
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, repositories.length) }, () => runWorker()))

  return summary
}
