import { createHash } from 'node:crypto'
import { posix } from 'node:path'

import { parse as parseYaml } from 'yaml'

import type { ProjectType } from '../../src/lib/classification'
import {
  parseValidationReport,
  type ExecutionType,
  type FailureAttribution,
  type StructureCheckEvidence,
  type ValidationKind,
  type ValidationReport,
} from '../../src/lib/validation-report'

type Manifest = Record<string, unknown>

export interface ScannerVulnerability {
  id: string
  severity?: string
  path?: string
}

export interface ScannerSecret {
  ruleId: string
  path?: string
}

export interface RepositoryStructureSnapshot {
  repository: {
    id: number
    fullName: string
    url: string
    sourceSha: string
    sourcePushedAt: string
    isPrivate: boolean
    archived: boolean
    deleted: boolean
    sizeKb: number
  }
  projectType: ProjectType
  topics: string[]
  files: Record<string, string | undefined>
  scans: {
    trivy: {
      status: 'passed' | 'findings' | 'unavailable'
      vulnerabilities: ScannerVulnerability[]
      secrets: ScannerSecret[]
    }
    osv: {
      status: 'passed' | 'findings' | 'unavailable'
      vulnerabilities: ScannerVulnerability[]
    }
    gitleaks?: {
      status: 'passed' | 'findings' | 'unavailable'
      secrets: ScannerSecret[]
    }
  }
}

export interface StructureCheckTarget {
  now: string
  dshVersion: string
  nodeVersion: string
  validatorVersion: string
  platform: string
}

export interface StructureCheckResult {
  decision: 'passed' | 'failed' | 'quarantined' | 'inconclusive' | 'not-applicable'
  queueSandbox: boolean
  publicReason: string | null
  report: ValidationReport
}

interface ExecutionTypeInput {
  projectType: ProjectType
  manifest: Manifest
  topics: string[]
}

const NON_PLUGIN_TYPES = new Set<ProjectType>(['application', 'infrastructure', 'directory'])
const CHANNEL_SIGNALS = /(^|-)mcp($|-)|mcp-server|channel|bridge|bot|messaging|notification/

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function hasOwnPath(files: RepositoryStructureSnapshot['files'], value: string): boolean {
  const normalized = posix.normalize(value.replace(/^\.\//, ''))
  return normalized !== '..'
    && !normalized.startsWith('../')
    && !posix.isAbsolute(normalized)
    && typeof files[normalized] === 'string'
}

function getManifest(files: RepositoryStructureSnapshot['files']): Manifest | null {
  const raw = files['package.json']
  if (typeof raw !== 'string') return null
  try {
    return asRecord(JSON.parse(raw))
  } catch {
    return null
  }
}

function getNestedRecord(value: unknown, ...keys: string[]): Record<string, unknown> | null {
  let current = asRecord(value)
  for (const key of keys) {
    if (current === null) return null
    current = asRecord(current[key])
  }
  return current
}

function getNestedString(value: unknown, ...keys: string[]): string | null {
  let current: unknown = value
  for (const key of keys) {
    const record = asRecord(current)
    if (record === null) return null
    current = record[key]
  }
  return typeof current === 'string' && current.length > 0 ? current : null
}

function collectEntrypoints(value: unknown, result = new Set<string>()): Set<string> {
  if (typeof value === 'string' && value.startsWith('./')) result.add(value)
  else if (Array.isArray(value)) value.forEach((item) => collectEntrypoints(item, result))
  else if (asRecord(value)) Object.values(value as Record<string, unknown>)
    .forEach((item) => collectEntrypoints(item, result))
  return result
}

function fingerprint(repositoryId: number, sourceSha: string, code: string): string {
  return createHash('sha256')
    .update(`${repositoryId}:${sourceSha}:${code}`)
    .digest('hex')
}

function validationKindFor(executionType: ExecutionType): ValidationKind {
  const kinds: Record<ExecutionType, ValidationKind> = {
    'host-tool': 'linux-headless',
    web: 'dsh-web',
    command: 'command-smoke',
    'channel-mcp': 'channel-mock',
    native: 'native',
    skill: 'skill-static',
    collection: 'collection',
    'non-plugin': 'non-plugin',
  }
  return kinds[executionType]
}

export function inferExecutionType({ projectType, manifest, topics }: ExecutionTypeInput): ExecutionType {
  if (NON_PLUGIN_TYPES.has(projectType)) return 'non-plugin'
  if (projectType === 'skill') return 'skill'
  if (projectType === 'collection') return 'collection'
  if (projectType === 'channel') return 'channel-mcp'

  const operatingSystems = Array.isArray(manifest.os)
    ? manifest.os.filter((value): value is string => typeof value === 'string')
    : []
  if (operatingSystems.length > 0
    && operatingSystems.every((value) => value === 'win32' || value === 'darwin')) return 'native'
  if (getNestedString(manifest, 'dsh', 'client', 'platform') === 'web') return 'web'
  if (topics.some((topic) => CHANNEL_SIGNALS.test(topic.toLowerCase()))) return 'channel-mcp'
  if (asRecord(manifest.bin) !== null || typeof manifest.bin === 'string') return 'command'
  return 'host-tool'
}

function check(
  checks: StructureCheckEvidence[],
  code: string,
  status: StructureCheckEvidence['status'],
  severity: StructureCheckEvidence['severity'],
  message: string,
  path?: string,
  tool?: string,
): void {
  checks.push({ code, status, severity, message, ...(path ? { path } : {}), ...(tool ? { tool } : {}) })
}

function createReport({
  snapshot,
  target,
  executionType,
  checks,
  failure,
}: {
  snapshot: RepositoryStructureSnapshot
  target: StructureCheckTarget
  executionType: ExecutionType
  checks: StructureCheckEvidence[]
  failure: null | { attribution: FailureAttribution, code: string, reason: string }
}): ValidationReport {
  const repository = snapshot.repository
  const status = failure === null ? 'structure_passed' as const : 'structure_failed' as const
  const failureFingerprint = failure ? fingerprint(repository.id, repository.sourceSha, failure.code) : null
  return parseValidationReport({
    schemaVersion: 1,
    reportId: `${repository.id}-${repository.sourceSha.slice(0, 12)}-${target.platform}-dsh-${target.dshVersion}`,
    mode: 'shadow',
    validationKind: validationKindFor(executionType),
    executionType,
    repository: {
      id: repository.id,
      fullName: repository.fullName,
      url: repository.url,
      sourceSha: repository.sourceSha,
      sourcePushedAt: repository.sourcePushedAt,
    },
    target: {
      dshVersion: target.dshVersion,
      platform: target.platform,
      nodeVersion: target.nodeVersion,
      validatorVersion: target.validatorVersion,
    },
    startedAt: target.now,
    completedAt: target.now,
    currentStatus: status,
    events: [
      { sequence: 1, stage: 'discovery', status: 'discovered', at: target.now },
      { sequence: 2, stage: 'classification', status: 'recognized', at: target.now },
      {
        sequence: 3,
        stage: 'structure',
        status,
        at: target.now,
        ...(failure ? {
          code: failure.code,
          reason: failure.reason,
          attribution: failure.attribution,
          fingerprint: failureFingerprint,
        } : {}),
      },
    ],
    structureChecks: checks,
    failure: failure ? {
      ...failure,
      fingerprint: failureFingerprint,
      reproducibility: { attempts: 1, matchingFingerprints: 1 },
    } : null,
    artifacts: [],
  })
}

function createUnrecognizedReport(
  snapshot: RepositoryStructureSnapshot,
  target: StructureCheckTarget,
  checks: StructureCheckEvidence[],
): ValidationReport {
  const repository = snapshot.repository
  return parseValidationReport({
    schemaVersion: 1,
    reportId: `${repository.id}-${repository.sourceSha.slice(0, 12)}-${target.platform}-dsh-${target.dshVersion}`,
    mode: 'shadow',
    validationKind: 'structure',
    executionType: null,
    repository: {
      id: repository.id,
      fullName: repository.fullName,
      url: repository.url,
      sourceSha: repository.sourceSha,
      sourcePushedAt: repository.sourcePushedAt,
    },
    target: {
      dshVersion: target.dshVersion,
      platform: target.platform,
      nodeVersion: target.nodeVersion,
      validatorVersion: target.validatorVersion,
    },
    startedAt: target.now,
    completedAt: target.now,
    currentStatus: 'unrecognized',
    events: [
      { sequence: 1, stage: 'discovery', status: 'discovered', at: target.now },
      { sequence: 2, stage: 'classification', status: 'unrecognized', at: target.now },
    ],
    structureChecks: checks,
    failure: null,
    artifacts: [],
  })
}

export function runStructureCheck(
  snapshot: RepositoryStructureSnapshot,
  target: StructureCheckTarget,
): StructureCheckResult {
  const checks: StructureCheckEvidence[] = []
  const repository = snapshot.repository
  const pinned = Number.isSafeInteger(repository.id)
    && repository.id > 0
    && /^[a-f0-9]{40}$/i.test(repository.sourceSha)
  check(
    checks,
    'REPOSITORY_PINNED',
    pinned ? 'passed' : 'failed',
    'required',
    pinned ? 'Repository ID and source SHA are pinned.' : 'Repository ID or source SHA is invalid.',
  )
  const repositoryActive = !repository.isPrivate && !repository.archived && !repository.deleted
  check(
    checks,
    'REPOSITORY_ACTIVE',
    repositoryActive ? 'passed' : 'failed',
    'required',
    repositoryActive ? 'Repository is public and active.' : 'Repository is private, deleted, or archived.',
  )
  check(
    checks,
    'REPOSITORY_SIZE',
    repository.sizeKb <= 200_000 ? 'passed' : 'failed',
    'required',
    repository.sizeKb <= 200_000 ? 'Repository size is within the validation limit.' : 'Repository exceeds 200 MB.',
  )

  if (snapshot.projectType === 'unknown') {
    check(checks, 'EXECUTION_TYPE_UNRECOGNIZED', 'not-run', 'required', 'Execution type could not be recognized.')
    return {
      decision: 'inconclusive',
      queueSandbox: false,
      publicReason: '待识别执行类型',
      report: createUnrecognizedReport(snapshot, target, checks),
    }
  }

  const manifest = getManifest(snapshot.files) ?? {}
  const executionType = inferExecutionType({
    projectType: snapshot.projectType,
    manifest,
    topics: snapshot.topics,
  })

  if (executionType === 'non-plugin') {
    check(checks, 'PLUGIN_VALIDATION_NOT_APPLICABLE', 'not-run', 'required', 'Project uses a non-plugin validation channel.')
    return {
      decision: 'not-applicable',
      queueSandbox: false,
      publicReason: '非 DSH 插件验证范围',
      report: createReport({ snapshot, target, executionType, checks, failure: null }),
    }
  }

  if (executionType === 'skill') {
    const skillFiles = Object.keys(snapshot.files).filter((path) => /(^|\/)SKILL\.md$/i.test(path))
    check(
      checks,
      'SKILL_DOCUMENT_PRESENT',
      skillFiles.length > 0 ? 'passed' : 'failed',
      'required',
      skillFiles.length > 0 ? 'Skill document is present.' : 'No SKILL.md was found.',
      skillFiles[0],
    )
  } else if (executionType === 'collection') {
    const manifests = Object.keys(snapshot.files).filter((path) => /(^|\/)package\.json$/.test(path))
    check(
      checks,
      'COLLECTION_MEMBERS_PRESENT',
      manifests.length > 1 ? 'passed' : 'failed',
      'required',
      manifests.length > 1 ? 'Collection contains member package manifests.' : 'Collection has no discoverable member package.',
    )
  } else {
    const packagePresent = Object.keys(manifest).length > 0
    check(
      checks,
      'PACKAGE_MANIFEST_VALID',
      packagePresent ? 'passed' : 'failed',
      'required',
      packagePresent ? 'package.json is valid JSON.' : 'package.json is missing or invalid.',
      'package.json',
    )

    const scripts = asRecord(manifest.scripts) ?? {}
    const hasBuild = typeof scripts.build === 'string' || typeof scripts.prepare === 'string' || typeof scripts.prepack === 'string'
    const entrypoints = new Set<string>()
    collectEntrypoints(manifest.main, entrypoints)
    collectEntrypoints(manifest.exports, entrypoints)
    collectEntrypoints(manifest.bin, entrypoints)
    const relevantEntrypoints = [...entrypoints].filter((path) => !/(?:package\.json|cordis\.patch\.yml)$/.test(path))
    const missingEntrypoints = relevantEntrypoints.filter((path) => !hasOwnPath(snapshot.files, path))
    if (relevantEntrypoints.length === 0) {
      check(checks, 'PACKAGE_ENTRYPOINT_MISSING', 'failed', 'required', 'No executable package entrypoint is declared.', 'package.json')
    } else if (missingEntrypoints.length > 0 && hasBuild) {
      check(checks, 'BUILD_ARTIFACT_REQUIRES_BUILD', 'warning', 'advisory', 'Declared entrypoints require the sandbox build stage.', missingEntrypoints[0])
    } else if (missingEntrypoints.length > 0) {
      check(checks, 'PACKAGE_ENTRYPOINT_MISSING', 'failed', 'required', 'A declared package entrypoint is missing and no build step is declared.', missingEntrypoints[0])
    } else {
      check(checks, 'PACKAGE_ENTRYPOINTS_VALID', 'passed', 'required', 'Declared package entrypoints exist.')
    }

    if (typeof scripts.prepare === 'string') {
      check(checks, 'PREPARE_SCRIPT_DECLARED', 'warning', 'advisory', 'prepare must run only in the isolated execution phase.', 'package.json')
    }

    if (executionType === 'host-tool' || executionType === 'web') {
      const patchPath = getNestedString(manifest, 'dsh', 'bundle', 'patch')
      let patchValid = patchPath !== null && hasOwnPath(snapshot.files, patchPath)
      if (patchValid && patchPath) {
        try {
          patchValid = Array.isArray(parseYaml(snapshot.files[patchPath.replace(/^\.\//, '')] as string))
        } catch {
          patchValid = false
        }
      }
      check(
        checks,
        'DSH_BUNDLE_PATCH_VALID',
        patchValid ? 'passed' : 'failed',
        'required',
        patchValid ? 'DSH bundle patch exists and parses as a patch list.' : 'DSH bundle patch is missing or invalid.',
        patchPath ?? 'package.json',
      )
    }
  }

  const lockfile = Object.keys(snapshot.files).find((path) => /(^|\/)(pnpm-lock\.yaml|package-lock\.json|yarn\.lock|bun\.lockb?)$/.test(path))
  check(
    checks,
    'LOCKFILE_PRESENT',
    lockfile ? 'passed' : 'warning',
    'advisory',
    lockfile ? 'A dependency lockfile is present.' : 'No supported dependency lockfile was found.',
    lockfile,
  )
  const hasLicense = typeof manifest.license === 'string'
    || Object.keys(snapshot.files).some((path) => /(^|\/)(LICENSE|COPYING)(\..*)?$/i.test(path))
  check(
    checks,
    'LICENSE_DECLARED',
    hasLicense ? 'passed' : 'warning',
    'advisory',
    hasLicense ? 'License evidence is present.' : 'No license evidence was found.',
  )
  const hasSubmodules = typeof snapshot.files['.gitmodules'] === 'string'
  check(
    checks,
    'SUBMODULES_DECLARED',
    hasSubmodules ? 'warning' : 'passed',
    'advisory',
    hasSubmodules ? 'Git submodules require pinned recursive fetch validation.' : 'No Git submodules declared.',
    hasSubmodules ? '.gitmodules' : undefined,
  )
  const usesLfs = typeof snapshot.files['.gitattributes'] === 'string'
    && snapshot.files['.gitattributes']!.includes('filter=lfs')
  check(
    checks,
    'GIT_LFS_DECLARED',
    usesLfs ? 'warning' : 'passed',
    'advisory',
    usesLfs ? 'Git LFS objects require completeness validation.' : 'No Git LFS filters declared.',
    usesLfs ? '.gitattributes' : undefined,
  )

  const scannerUnavailable = snapshot.scans.trivy.status === 'unavailable'
    || snapshot.scans.osv.status === 'unavailable'
    || snapshot.scans.gitleaks?.status === 'unavailable'
  const secretFindings = snapshot.scans.trivy.secrets.length
    + (snapshot.scans.gitleaks?.secrets.length ?? 0)
  const vulnerabilityFindings = [
    ...snapshot.scans.trivy.vulnerabilities,
    ...snapshot.scans.osv.vulnerabilities,
  ]
  if (snapshot.scans.trivy.status === 'unavailable') {
    check(checks, 'TRIVY_SCAN_UNAVAILABLE', 'not-run', 'security', 'Trivy result is unavailable.', undefined, 'trivy')
  } else if (secretFindings > 0) {
    check(checks, 'SECRET_SCAN_QUARANTINE', 'quarantined', 'security', 'Potential secret material requires private human review.', undefined, 'trivy')
  } else {
    check(checks, 'TRIVY_SCAN_CLEAN', 'passed', 'security', 'Trivy vulnerability and secret scan produced no blocking findings.', undefined, 'trivy')
  }
  if (snapshot.scans.osv.status === 'unavailable') {
    check(checks, 'OSV_SCAN_UNAVAILABLE', 'not-run', 'security', 'OSV result is unavailable.', undefined, 'osv-scanner')
  } else if (vulnerabilityFindings.length > 0) {
    check(checks, 'VULNERABILITY_REVIEW_REQUIRED', 'quarantined', 'security', 'Known vulnerabilities require policy review.', undefined, 'osv-scanner')
  } else {
    check(checks, 'OSV_SCAN_CLEAN', 'passed', 'security', 'OSV scan produced no known vulnerability findings.', undefined, 'osv-scanner')
  }
  if (snapshot.scans.gitleaks?.status === 'unavailable') {
    check(checks, 'GITLEAKS_SCAN_UNAVAILABLE', 'not-run', 'security', 'Gitleaks result is unavailable.', undefined, 'gitleaks')
  } else if ((snapshot.scans.gitleaks?.secrets.length ?? 0) > 0) {
    check(checks, 'GITLEAKS_SCAN_QUARANTINE', 'quarantined', 'security', 'Potential secret material requires private human review.', undefined, 'gitleaks')
  } else if (snapshot.scans.gitleaks) {
    check(checks, 'GITLEAKS_SCAN_CLEAN', 'passed', 'security', 'Gitleaks scan produced no secret findings.', undefined, 'gitleaks')
  }

  const requiredFailure = checks.find(({ status, severity }) => status === 'failed' && severity === 'required')
  let decision: StructureCheckResult['decision'] = 'passed'
  let failure: Parameters<typeof createReport>[0]['failure'] = null
  let publicReason: string | null = null
  if (secretFindings > 0 || vulnerabilityFindings.length > 0) {
    decision = 'quarantined'
    publicReason = '需要人工安全复核'
    failure = { attribution: 'policy', code: 'SECURITY_REVIEW_REQUIRED', reason: publicReason }
  } else if (scannerUnavailable) {
    decision = 'inconclusive'
    publicReason = '验证基础设施暂不可用'
    failure = { attribution: 'infrastructure', code: 'SCANNER_UNAVAILABLE', reason: publicReason }
  } else if (requiredFailure) {
    decision = 'failed'
    publicReason = requiredFailure.message
    failure = { attribution: 'plugin', code: requiredFailure.code, reason: requiredFailure.message }
  }

  return {
    decision,
    queueSandbox: decision === 'passed' && !['native', 'skill', 'non-plugin'].includes(executionType),
    publicReason,
    report: createReport({ snapshot, target, executionType, checks, failure }),
  }
}
