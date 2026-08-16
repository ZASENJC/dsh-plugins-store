import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmod, lstat, mkdir, readFile, realpath } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { isAbsolute, join, posix, relative, resolve } from 'node:path'

import type { ScannerSecret, ScannerVulnerability } from './structure-check'

const MAX_SCANNER_OUTPUT_BYTES = 16 * 1024 * 1024
const SCANNER_TIMEOUT_MS = 120_000
const MAX_SECRET_CONTEXT_BYTES = 1_000_000

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

export interface ScannerExecutionResult {
  stdout: string
  exitCode: number | null
  timedOut: boolean
  truncated: boolean
}

type Executor = (file: string, args: string[]) => Promise<string | ScannerExecutionResult>

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
      args: [
        ...dockerPrefix(sourceDir),
        SCANNER_IMAGES.osv,
        'scan', 'source', '--format=json', '--recursive', '--allow-no-lockfiles', '/workspace',
      ],
      outputPath: join(outputRoot, 'osv.json'),
    },
    {
      tool: 'gitleaks',
      file: 'docker',
      args: [...dockerPrefix(sourceDir), '--network=none', SCANNER_IMAGES.gitleaks, 'dir', '/workspace', '--no-banner', '--redact=100', '--report-format=json', '--report-path=/dev/stdout', '--exit-code=0'],
      outputPath: join(outputRoot, 'gitleaks.json'),
    },
  ]
}

function normalizedScannerPath(value: string): string | null {
  const unixPath = value.replace(/\\/g, '/')
  const workspaceRelative = unixPath.startsWith('/workspace/')
    ? unixPath.slice('/workspace/'.length)
    : unixPath.replace(/^\.\//, '')
  const normalized = posix.normalize(workspaceRelative)
  return normalized !== '.'
    && normalized !== '..'
    && !normalized.startsWith('../')
    && !posix.isAbsolute(normalized)
    && !normalized.includes('\0')
    ? normalized
    : null
}

function isNonRuntimeEvidencePath(path: string): boolean {
  return /(^|\/)(?:__tests__|docs?|documentation|examples?|fixtures?|references?|samples?|specs?|test|tests|testdata|digest)(?:\/|$)/i.test(path)
    || /(^|\/)README(?:\.[^/]*)?$/i.test(path)
    || /\.(?:fixture|spec|test)\.[^/]+$/i.test(path)
}

function hasAssignmentSyntax(match: string): boolean {
  const redactionIndex = match.indexOf('REDACTED')
  if (redactionIndex < 0) return true
  const prefix = match.slice(0, redactionIndex)
  return /[\w.-]{1,80}\s*["']?\s*(?:=|:{1,3}=|:|=>|\?=)\s*["']?\s*$/i.test(prefix)
}

function gitleaksFindingTriage(
  ruleId: string,
  path: string | null,
  match: unknown,
): ScannerSecret['triage'] | undefined {
  if (ruleId !== 'generic-api-key' || path === null) return undefined
  if (isNonRuntimeEvidencePath(path)) return 'generic-non-runtime'
  if (typeof match === 'string' && !hasAssignmentSyntax(match)) return 'generic-syntax-noise'
  return undefined
}

async function hasKnownPublicClientContext(
  sourceDirectory: string,
  secret: ScannerSecret,
): Promise<boolean> {
  if (secret.ruleId !== 'generic-api-key' || secret.path === undefined || secret.line === undefined) return false
  try {
    const sourceRoot = await realpath(resolve(sourceDirectory))
    const sourcePath = resolve(sourceRoot, secret.path)
    const relativePath = relative(sourceRoot, sourcePath)
    if (relativePath === '' || relativePath === '..' || relativePath.startsWith(`..${posix.sep}`) || isAbsolute(relativePath)) {
      return false
    }
    const stats = await lstat(sourcePath)
    if (!stats.isFile() || stats.size > MAX_SECRET_CONTEXT_BYTES) return false
    const content = await readFile(sourcePath, 'utf8')
    const findingLine = content.split(/\r?\n/)[secret.line - 1] ?? ''
    return /\btoken\s*[:=]/i.test(findingLine)
      && /static\.cloudflareinsights\.com\/beacon\.min\.js/i.test(content)
      && /data-cf-beacon/i.test(content)
  } catch {
    return false
  }
}

async function triageKnownPublicClientIdentifiers(
  result: ScannerResults['gitleaks'],
  sourceDirectory: string,
): Promise<ScannerResults['gitleaks']> {
  return {
    ...result,
    secrets: await Promise.all(result.secrets.map(async (secret) => (
      secret.triage === undefined && await hasKnownPublicClientContext(sourceDirectory, secret)
        ? { ...secret, triage: 'public-client-identifier' as const }
        : secret
    ))),
  }
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
    const path = typeof finding.File === 'string' ? normalizedScannerPath(finding.File) : null
    const line = Number.isSafeInteger(finding.StartLine) && Number(finding.StartLine) > 0
      ? Number(finding.StartLine)
      : undefined
    const triage = gitleaksFindingTriage(finding.RuleID, path, finding.Match)
    secrets.push({
      ruleId: finding.RuleID,
      ...(path ? { path } : {}),
      ...(line === undefined ? {} : { line }),
      ...(triage === undefined ? {} : { triage }),
    })
  }
  return { status: secrets.length > 0 ? 'findings' : 'passed', secrets }
}

async function defaultExecutor(file: string, args: string[]): Promise<ScannerExecutionResult> {
  return new Promise((resolve) => {
    const child = spawn(file, args, { stdio: ['ignore', 'pipe', 'ignore'] })
    const chunks: Buffer[] = []
    let outputBytes = 0
    let timedOut = false
    let truncated = false
    let settled = false
    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGKILL')
    }, SCANNER_TIMEOUT_MS)

    const finish = (exitCode: number | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({
        stdout: Buffer.concat(chunks).toString('utf8'),
        exitCode,
        timedOut,
        truncated,
      })
    }

    child.stdout.on('data', (chunk: Buffer) => {
      if (truncated) return
      outputBytes += chunk.byteLength
      if (outputBytes > MAX_SCANNER_OUTPUT_BYTES) {
        truncated = true
        child.kill('SIGKILL')
        return
      }
      chunks.push(chunk)
    })
    child.on('error', () => finish(null))
    child.on('close', (exitCode) => finish(exitCode))
  })
}

function parseJson(output: string): unknown {
  return output.trim() === '' ? [] : JSON.parse(output)
}

function structuredOutputFromError(error: unknown): string | null {
  const record = asRecord(error)
  return typeof record?.stdout === 'string' && record.stdout.trim() !== ''
    ? record.stdout
    : null
}

function hasScannerFindings(tool: keyof ScannerResults, value: ScannerResults[keyof ScannerResults]): boolean {
  if (tool === 'trivy' && 'vulnerabilities' in value && 'secrets' in value) {
    return value.vulnerabilities.length > 0 || value.secrets.length > 0
  }
  if (tool === 'osv' && 'vulnerabilities' in value) return value.vulnerabilities.length > 0
  if (tool === 'gitleaks' && 'secrets' in value) return value.secrets.length > 0
  return false
}

async function executeScannerWithTimeout(
  executor: Executor,
  file: string,
  args: string[],
): Promise<string | ScannerExecutionResult> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      executor(file, args),
      new Promise<ScannerExecutionResult>((resolve) => {
        timeout = setTimeout(() => resolve({
          stdout: '',
          exitCode: null,
          timedOut: true,
          truncated: false,
        }), SCANNER_TIMEOUT_MS)
      }),
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
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
    let parsed: unknown
    let nonZeroExit = false
    try {
      const execution = await executeScannerWithTimeout(executor, command.file, command.args)
      if (typeof execution === 'string') {
        parsed = parseJson(execution)
      } else {
        nonZeroExit = execution.exitCode !== 0 || execution.timedOut || execution.truncated
        parsed = parseJson(execution.stdout)
      }
    } catch (error) {
      nonZeroExit = true
      const output = structuredOutputFromError(error)
      if (output === null) continue
      try {
        parsed = parseJson(output)
      } catch {
        continue
      }
      // Unavailable is an infrastructure result; never turn it into a plugin failure.
    }
    // A scanner that exits non-zero without findings is an infrastructure failure,
    // never a clean result. Structured findings remain useful and are preserved.
    if (command.tool === 'trivy') {
      const parsedResult = parseTrivyReport(parsed)
      if (!nonZeroExit || hasScannerFindings(command.tool, parsedResult)) result.trivy = parsedResult
    } else if (command.tool === 'osv') {
      const parsedResult = parseOsvReport(parsed)
      if (!nonZeroExit || hasScannerFindings(command.tool, parsedResult)) result.osv = parsedResult
    } else {
      const parsedResult = await triageKnownPublicClientIdentifiers(parseGitleaksReport(parsed), sourceDirectory)
      if (!nonZeroExit || hasScannerFindings(command.tool, parsedResult)) result.gitleaks = parsedResult
    }
  }
  return result
}
