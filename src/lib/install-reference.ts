import {
  classifyRepository,
  type ProjectType,
} from './classification'
import type { SourceClassification } from './source-classification'

export type InstallSource = 'github' | 'npm' | 'readme-command'

export interface InstallEvidence {
  source: 'readme'
  pattern: 'dsh-plugin-add' | 'package-manager-add'
  heading: string | null
}

export interface InstallCandidate {
  source: InstallSource
  target: string
  command: string
  args: string[]
  executable: boolean
  evidence: InstallEvidence
}

export interface InstallReference {
  status: 'recognized' | 'ambiguous' | 'unrecognized'
  candidate?: InstallCandidate
  candidates: InstallCandidate[]
}

interface ReadmeBlock {
  heading: string | null
  lines: string[]
}

interface CatalogInstallContext {
  fullName: string
  validation?: {
    overall?: string
    sourceSha?: string | null
  }
}

interface InstallReferenceRepository {
  fullName: string
  name: string
  description: string
  topics: string[]
}

const INSTALL_HEADING = /(?:install(?:ation)?|setup|get(?:ting)? started|quicks*start|安装|安装方法|安装方式|快速开始)/i
const GITHUB_SPECIFIER = /^github:([A-Za-z0-9](?:[A-Za-z0-9_.-]{0,99})\/[A-Za-z0-9](?:[A-Za-z0-9_.-]{0,99}))(?:#([A-Za-z0-9][A-Za-z0-9_.:-]{0,127}))?$/
const NPM_PACKAGE = /^(?:@[A-Za-z0-9](?:[A-Za-z0-9._-]{0,99})\/)?[A-Za-z0-9](?:[A-Za-z0-9._-]{0,99})(?:@[A-Za-z0-9^~<>=*+._-][A-Za-z0-9^~<>=*+._-]{0,127})?$/
const SOURCE_SHA = /^[a-f0-9]{40}$/i
const UNSAFE_COMMAND = /(?:&&|\|\||[|;&<>`$\\])/u
const PACKAGE_MANAGER_FLAG = /^(?:-D|-E|-g|--global|--save|--save-dev|--save-exact|--exact|--frozen-lockfile|--workspace)$/
const INSTALLABLE_PROJECT_TYPES = new Set<ProjectType>(['plugin', 'skill', 'collection', 'channel'])

export function canExtractInstallReference(
  repository: InstallReferenceRepository,
  sourceClassification?: SourceClassification,
): boolean {
  const topicProjectType = classifyRepository(repository).projectType
  const sourceProjectType = sourceClassification
    && sourceClassification.projectType !== 'unknown'
    && sourceClassification.confidence !== 'low'
    ? sourceClassification.projectType
    : undefined
  return INSTALLABLE_PROJECT_TYPES.has(sourceProjectType ?? topicProjectType)
}

function collectCodeBlocks(readme: string): ReadmeBlock[] {
  const blocks: ReadmeBlock[] = []
  let heading: string | null = null
  let fence: { marker: string; length: number } | null = null
  let lines: string[] = []

  for (const line of readme.split(/\r?\n/u)) {
    const headingMatch = /^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/u.exec(line)
    if (fence === null && headingMatch) {
      heading = headingMatch[1].trim()
      continue
    }

    const fenceMatch = /^\s{0,3}(`{3,}|~{3,})(?:[^`]*)$/u.exec(line)
    if (fence === null && fenceMatch) {
      fence = { marker: fenceMatch[1][0], length: fenceMatch[1].length }
      lines = []
      continue
    }
    if (fence !== null) {
      const closeMatch = new RegExp(`^\\s{0,3}${fence.marker}{${fence.length},}\\s*$`, 'u').test(line)
      if (closeMatch) {
        blocks.push({ heading, lines })
        fence = null
        lines = []
      } else {
        lines.push(line)
      }
    }
  }

  return blocks
}

function normalizeCommand(line: string): string | null {
  let command = line.trim()
  if (command.startsWith('$ ')) command = command.slice(2).trim()
  if (command.startsWith('> ')) command = command.slice(2).trim()
  if (command.length === 0 || UNSAFE_COMMAND.test(command)) return null
  return command
}

function parseSpecifier(specifier: string): Pick<InstallCandidate, 'source' | 'target'> {
  const github = GITHUB_SPECIFIER.exec(specifier)
  if (github) return { source: 'github', target: github[1] }

  const npmSpecifier = specifier.startsWith('npm:') ? specifier.slice(4) : specifier
  if (NPM_PACKAGE.test(npmSpecifier)) return { source: 'npm', target: npmSpecifier }

  return { source: 'readme-command', target: specifier }
}

function parseDshCommand(command: string, heading: string | null): InstallCandidate | null {
  const match = /^dsh\s+plugin(?:\s+--profile\s+([A-Za-z0-9_-]+))?\s+add\s+(\S+)$/u.exec(command)
  if (!match) return null

  const profile = match[1] ?? 'web'
  const specifier = match[2]
  const parsed = parseSpecifier(specifier)
  return {
    ...parsed,
    command: match[1] === undefined
      ? `dsh plugin --profile web add ${specifier}`
      : command,
    args: ['plugin', '--profile', profile, 'add', specifier],
    executable: profile === 'web' && (parsed.source === 'github' || parsed.source === 'npm'),
    evidence: { source: 'readme', pattern: 'dsh-plugin-add', heading },
  }
}

function parsePackageManagerCommand(command: string, heading: string | null): InstallCandidate | null {
  if (heading === null || !INSTALL_HEADING.test(heading)) return null
  const match = /^(npm|pnpm|yarn)\s+(?:install|i|add)\s+(.+)$/u.exec(command)
  if (!match) return null

  const tokens = match[2].trim().split(/\s+/u)
  if (tokens.length === 0) return null
  const specifiers = tokens.filter((token) => !PACKAGE_MANAGER_FLAG.test(token))
  if (specifiers.length !== 1 || tokens.some((token) => (
    token !== specifiers[0] && !PACKAGE_MANAGER_FLAG.test(token)
  ))) return null
  const [specifier] = specifiers
  const parsed = parseSpecifier(specifier)
  if (parsed.source !== 'npm') return null

  return {
    source: 'npm',
    target: parsed.target,
    command,
    args: [],
    executable: false,
    evidence: { source: 'readme', pattern: 'package-manager-add', heading },
  }
}

export function extractInstallReference(readme: string): InstallReference {
  const candidates: InstallCandidate[] = []
  const seen = new Set<string>()

  for (const block of collectCodeBlocks(readme)) {
    for (const line of block.lines) {
      const command = normalizeCommand(line)
      if (command === null) continue
      const candidate = parseDshCommand(command, block.heading)
        ?? parsePackageManagerCommand(command, block.heading)
      if (candidate === null) continue
      const key = `${candidate.source}:${candidate.target}:${candidate.command}`
      if (seen.has(key)) continue
      seen.add(key)
      candidates.push(candidate)
    }
  }

  if (candidates.length === 0) return { status: 'unrecognized', candidates: [] }
  if (candidates.length > 1) {
    const executableWebCandidates = candidates.filter(({ executable }) => executable)
    if (executableWebCandidates.length === 1) {
      return { status: 'recognized', candidate: executableWebCandidates[0], candidates }
    }
    return { status: 'ambiguous', candidates }
  }
  return { status: 'recognized', candidate: candidates[0], candidates }
}

export function resolveCatalogInstallReference(
  reference: InstallReference,
  repository: CatalogInstallContext,
): InstallReference {
  if (reference.status !== 'recognized' || reference.candidate === undefined) return reference

  const candidate = { ...reference.candidate, args: [...reference.candidate.args] }
  const sourceSha = repository.validation?.sourceSha
  const verified = repository.validation?.overall === 'verified'
    && typeof sourceSha === 'string'
    && SOURCE_SHA.test(sourceSha)
  const securityReview = repository.validation?.overall === 'security-review'

  if (candidate.source === 'github') {
    const sameRepository = candidate.target.toLowerCase() === repository.fullName.toLowerCase()
    if (securityReview || !sameRepository || !candidate.executable || candidate.evidence.pattern !== 'dsh-plugin-add') {
      candidate.executable = false
    } else if (verified) {
      const pinnedSpecifier = `github:${repository.fullName}#${sourceSha.toLowerCase()}`
      candidate.command = `dsh plugin --profile web add ${pinnedSpecifier}`
      candidate.args = ['plugin', '--profile', 'web', 'add', pinnedSpecifier]
    }
  } else if (candidate.source === 'npm') {
    if (!securityReview && candidate.evidence.pattern === 'package-manager-add') {
      candidate.args = ['plugin', '--profile', 'web', 'add', `npm:${candidate.target}`]
      candidate.executable = true
    } else if (securityReview) {
      candidate.executable = false
    }
  } else {
    candidate.executable = false
  }

  return { status: 'recognized', candidate, candidates: [candidate] }
}
