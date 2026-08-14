import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmod, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'

import type { ScannerSecret, ScannerVulnerability } from './structure-check'

const execFileAsync = promisify(execFile)

export const SCANNER_IMAGES = Object.freeze({
  trivy: 'aquasec/trivy:0.74.0',
  osv: 'ghcr.io/google/osv-scanner:v2.5.0',
  gitleaks: 'ghcr.io/gitleaks/gitleaks:v8.30.1',
})

export interface ScannerResults {
  trivy: {
    status: 'passed' | 'findings' | 'unavailable'
    vulnerabilities: ScannerVulnerability[]
    secrets: ScannerSecret[]
  }
  osv: {
    status: 'passed' | 'findings' | 'unavailable'
    vulnerabilities: ScannerVulnerability[]
  }
  gitleaks: {
    status: 'passed' | 'findings' | 'unavailable'
    secrets: ScannerSecret[]
  }
}

export interface ScannerCommand {
  tool: keyof ScannerResults
  file: 'docker'
  args: string[]
  outputPath: string
}

type Executor = (file: string, args: string[]) => Promise<string>

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function dockerPrefix(
  sourceDir: string,
  { memory = '1g', temporarySize = '128m' }: { memory?: string, temporarySize?: string } = {},
): string[] {
  return [
    'run', '--rm', '--read-only', '--cap-drop=ALL',
    '--security-opt=no-new-privileges', '--pids-limit=128', `--memory=${memory}`, '--cpus=1',
    '--user=65532:65532', `--tmpfs=/tmp:rw,noexec,nosuid,size=${temporarySize}`,
    '--mount', `type=bind,src=${sourceDir},dst=/workspace,readonly`,
  ]
}

function getTrivyCacheDirectory(value?: string): string {
  return resolve(value ?? process.env.DSH_TRIVY_CACHE_DIR ?? join(tmpdir(), 'dsh-validation-scanner-cache', 'trivy-0.74.0'))
}

export function buildScannerCommands(
  sourceDirectory: string,
  { trivyCacheDirectory }: { trivyCacheDirectory?: string } = {},
): ScannerCommand[] {
  const sourceDir = resolve(sourceDirectory)
  const trivyCache = getTrivyCacheDirectory(trivyCacheDirectory)
  const runId = createHash('sha256').update(sourceDir).digest('hex').slice(0, 16)
  const outputRoot = join(tmpdir(), 'dsh-validation-scans', runId)
  return [
    {
      tool: 'trivy',
      file: 'docker',
      args: [
        ...dockerPrefix(sourceDir, { temporarySize: '512m' }),
        '--mount', `type=bind,src=${trivyCache},dst=/tmp/trivy-cache`,
        SCANNER_IMAGES.trivy,
        'fs', '--quiet', '--cache-dir=/tmp/trivy-cache', '--format=json', '--scanners=vuln,secret', '/workspace',
      ],
      outputPath: join(outputRoot, 'trivy.json'),
    },
    {
      tool: 'osv',
      file: 'docker',
      args: [...dockerPrefix(sourceDir), SCANNER_IMAGES.osv, 'scan', 'source', '--format=json', '--recursive', '/workspace'],
      outputPath: join(outputRoot, 'osv.json'),
    },
    {
      tool: 'gitleaks',
      file: 'docker',
      args: [...dockerPrefix(sourceDir), '--network=none', SCANNER_IMAGES.gitleaks, 'dir', '/workspace', '--no-banner', '--report-format=json', '--report-path=/dev/stdout', '--exit-code=0'],
      outputPath: join(outputRoot, 'gitleaks.json'),
    },
  ]
}

export function parseTrivyReport(value: unknown): ScannerResults['trivy'] {
  const root = asRecord(value)
  const results = Array.isArray(root?.Results) ? root.Results : []
  const vulnerabilities: ScannerVulnerability[] = []
  const secrets: ScannerSecret[] = []
  for (const rawResult of results) {
    const result = asRecord(rawResult)
    if (!result) continue
    for (const raw of Array.isArray(result.Vulnerabilities) ? result.Vulnerabilities : []) {
      const vulnerability = asRecord(raw)
      if (!vulnerability || typeof vulnerability.VulnerabilityID !== 'string') continue
      vulnerabilities.push({
        id: vulnerability.VulnerabilityID,
        ...(typeof vulnerability.Severity === 'string' ? { severity: vulnerability.Severity } : {}),
        ...(typeof vulnerability.PkgPath === 'string' ? { path: vulnerability.PkgPath } : {}),
      })
    }
    for (const raw of Array.isArray(result.Secrets) ? result.Secrets : []) {
      const secret = asRecord(raw)
      if (!secret || typeof secret.RuleID !== 'string') continue
      secrets.push({
        ruleId: secret.RuleID,
        ...(typeof result.Target === 'string' ? { path: result.Target } : {}),
      })
    }
  }
  return {
    status: vulnerabilities.length > 0 || secrets.length > 0 ? 'findings' : 'passed',
    vulnerabilities,
    secrets,
  }
}

export function parseOsvReport(value: unknown): ScannerResults['osv'] {
  const root = asRecord(value)
  const results = Array.isArray(root?.results) ? root.results : []
  const vulnerabilities: ScannerVulnerability[] = []
  for (const rawResult of results) {
    const result = asRecord(rawResult)
    if (!result) continue
    for (const rawPackage of Array.isArray(result.packages) ? result.packages : []) {
      const packageResult = asRecord(rawPackage)
      const source = asRecord(packageResult?.source)
      if (!packageResult) continue
      for (const raw of Array.isArray(packageResult.vulnerabilities) ? packageResult.vulnerabilities : []) {
        const vulnerability = asRecord(raw)
        if (!vulnerability || typeof vulnerability.id !== 'string') continue
        vulnerabilities.push({
          id: vulnerability.id,
          ...(typeof source?.path === 'string' ? { path: source.path } : {}),
        })
      }
    }
  }
  return { status: vulnerabilities.length > 0 ? 'findings' : 'passed', vulnerabilities }
}

export function parseGitleaksReport(value: unknown): ScannerResults['gitleaks'] {
  const findings = Array.isArray(value) ? value : []
  const secrets: ScannerSecret[] = []
  for (const raw of findings) {
    const finding = asRecord(raw)
    if (!finding || typeof finding.RuleID !== 'string') continue
    secrets.push({
      ruleId: finding.RuleID,
      ...(typeof finding.File === 'string' ? { path: finding.File } : {}),
    })
  }
  return { status: secrets.length > 0 ? 'findings' : 'passed', secrets }
}

async function defaultExecutor(file: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync(file, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  return stdout
}

function parseJson(output: string): unknown {
  return output.trim() === '' ? [] : JSON.parse(output)
}

export async function runScannerCommands(
  sourceDirectory: string,
  {
    executor = defaultExecutor,
    trivyCacheDirectory,
  }: { executor?: Executor, trivyCacheDirectory?: string } = {},
): Promise<ScannerResults> {
  const trivyCache = getTrivyCacheDirectory(trivyCacheDirectory)
  await mkdir(trivyCache, { recursive: true })
  await chmod(trivyCache, 0o777)
  const commands = buildScannerCommands(sourceDirectory, { trivyCacheDirectory: trivyCache })
  const result: ScannerResults = {
    trivy: { status: 'unavailable', vulnerabilities: [], secrets: [] },
    osv: { status: 'unavailable', vulnerabilities: [] },
    gitleaks: { status: 'unavailable', secrets: [] },
  }
  for (const command of commands) {
    try {
      const parsed = parseJson(await executor(command.file, command.args))
      if (command.tool === 'trivy') result.trivy = parseTrivyReport(parsed)
      else if (command.tool === 'osv') result.osv = parseOsvReport(parsed)
      else result.gitleaks = parseGitleaksReport(parsed)
    } catch {
      // Unavailable is an infrastructure result; never turn it into a plugin failure.
    }
  }
  return result
}
