import type { ValidationReport } from '../../src/lib/validation-report'
import type { DockerCommand } from './linux-sandbox'

interface WebValidationTarget {
  repositoryId: number
  sourceSha: string
  packageName: string
  expectedSelector: string
}

interface WebValidationStep {
  id: 'install-web' | 'web-smoke' | 'uninstall-web' | 'uninstall-check'
  command: DockerCommand
}

interface ChannelMockContract {
  protocol: 'http' | 'websocket'
  endpointEnv: string
  request: { method: string, path: string }
  response: { status: number, body: unknown }
  smokeCommand: string[]
  requiresCredentials: false
}

interface CollectionManifest {
  members: Array<{ repositoryId: number, sourceSha: string, required: boolean }>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function runtimeArgs(
  containerName: string,
  volumeName: string,
  command: string[],
): string[] {
  return [
    'run', '--rm', '--name', containerName,
    '--platform=linux/amd64', '--network=none',
    '--read-only', '--cap-drop=ALL', '--security-opt=no-new-privileges',
    '--pids-limit=256', '--memory=2g', '--cpus=2', '--user=1000:1000',
    '--tmpfs=/tmp:rw,noexec,nosuid,size=256m',
    '--mount', `type=volume,src=${volumeName},dst=/validation`,
    '--env=HOME=/validation/home', '--env=DSH_HOME=/validation/dsh-home', '--env=CI=1',
    '--workdir=/validation/workspace/plugin',
    'dsh-web-validator:0.1.0',
    ...command,
  ]
}

function safeResourceName(value: string): void {
  if (!/^[a-zA-Z0-9_.-]+$/.test(value)) throw new Error('P3 resource name is invalid')
}

export function buildWebValidationPlan(
  target: WebValidationTarget,
  { containerName, volumeName }: { containerName: string, volumeName: string },
): { steps: WebValidationStep[] } {
  safeResourceName(containerName)
  safeResourceName(volumeName)
  if (!/^[a-f0-9]{40}$/i.test(target.sourceSha)
    || !/^(?:@[a-z0-9_.-]+\/)?[a-z0-9_.-]+$/i.test(target.packageName)
    || target.expectedSelector.length === 0
    || target.expectedSelector.length > 200) throw new Error('Web validation target is invalid')
  const command = (args: string[]): DockerCommand => ({
    file: 'docker',
    args: runtimeArgs(containerName, volumeName, args),
  })
  return {
    steps: [
      {
        id: 'install-web',
        command: command(['dsh', 'plugin', '--profile', 'web', 'add', '--ignore-scripts', 'file:/validation/workspace/plugin']),
      },
      {
        id: 'web-smoke',
        command: command(['node', '/validator/web-smoke.mjs', target.packageName, target.expectedSelector]),
      },
      {
        id: 'uninstall-web',
        command: command(['dsh', 'plugin', '--profile', 'web', 'remove', '--ignore-scripts', target.packageName]),
      },
      {
        id: 'uninstall-check',
        command: command(['node', '/validator/verify-uninstall.mjs', target.packageName]),
      },
    ],
  }
}

function parseCollectionManifest(value: unknown): CollectionManifest {
  if (!isRecord(value) || !Array.isArray(value.members) || value.members.length === 0) {
    throw new Error('Collection manifest is invalid')
  }
  const ids = new Set<number>()
  const members = value.members.map((raw): CollectionManifest['members'][number] => {
    if (!isRecord(raw)
      || !Number.isSafeInteger(raw.repositoryId)
      || Number(raw.repositoryId) <= 0
      || typeof raw.sourceSha !== 'string'
      || !/^[a-f0-9]{40}$/i.test(raw.sourceSha)
      || typeof raw.required !== 'boolean') throw new Error('Collection member binding is invalid')
    const repositoryId = Number(raw.repositoryId)
    if (ids.has(repositoryId)) throw new Error('Collection member identity is duplicated')
    ids.add(repositoryId)
    return { repositoryId, sourceSha: raw.sourceSha, required: raw.required }
  })
  return { members }
}

export function validateCollectionMembers(
  value: unknown,
  reports: ValidationReport[],
  target: { dshVersion: string, platform: string },
): { status: 'verified' | 'failed' | 'inconclusive', code: string, memberCount: number } {
  const manifest = parseCollectionManifest(value)
  for (const member of manifest.members.filter(({ required }) => required)) {
    const exact = reports.find((report) => report.repository.id === member.repositoryId
      && report.repository.sourceSha === member.sourceSha
      && report.target.dshVersion === target.dshVersion
      && report.target.platform === target.platform)
    if (!exact) return { status: 'inconclusive', code: 'COLLECTION_MEMBER_NOT_CURRENT', memberCount: manifest.members.length }
    if (exact.currentStatus === 'failed') {
      return { status: 'failed', code: 'COLLECTION_MEMBER_FAILED', memberCount: manifest.members.length }
    }
    if (exact.currentStatus !== 'verified') {
      return { status: 'inconclusive', code: 'COLLECTION_MEMBER_NOT_CURRENT', memberCount: manifest.members.length }
    }
  }
  return { status: 'verified', code: 'COLLECTION_MEMBERS_VERIFIED', memberCount: manifest.members.length }
}

export function parseChannelMockContract(value: unknown): ChannelMockContract {
  if (!isRecord(value)
    || !['http', 'websocket'].includes(value.protocol as string)
    || typeof value.endpointEnv !== 'string'
    || !/^DSH_[A-Z0-9_]*(?:ENDPOINT|URL)$/.test(value.endpointEnv)
    || !isRecord(value.request)
    || typeof value.request.method !== 'string'
    || !/^[A-Z]+$/.test(value.request.method)
    || typeof value.request.path !== 'string'
    || !/^\/(?!\/)/.test(value.request.path)
    || !isRecord(value.response)
    || !Number.isInteger(value.response.status)
    || Number(value.response.status) < 100
    || Number(value.response.status) > 599
    || !Array.isArray(value.smokeCommand)
    || value.smokeCommand.length === 0
    || !value.smokeCommand.every((argument) => typeof argument === 'string' && argument.length > 0)
    || ['sh', 'bash', 'zsh'].includes(value.smokeCommand[0] as string)
    || value.smokeCommand.includes('-c')
    || value.requiresCredentials !== false
    || 'endpoint' in value) {
    throw new Error('Channel/MCP mock contract is invalid or unsafe')
  }
  return {
    protocol: value.protocol as ChannelMockContract['protocol'],
    endpointEnv: value.endpointEnv,
    request: { method: value.request.method, path: value.request.path },
    response: { status: Number(value.response.status), body: value.response.body },
    smokeCommand: value.smokeCommand as string[],
    requiresCredentials: false,
  }
}

export function buildChannelMockPlan(
  contract: ChannelMockContract,
  { containerName, volumeName }: { containerName: string, volumeName: string },
): { command: DockerCommand } {
  safeResourceName(containerName)
  safeResourceName(volumeName)
  const encodedContract = Buffer.from(JSON.stringify(contract)).toString('base64url')
  return {
    command: {
      file: 'docker',
      args: runtimeArgs(containerName, volumeName, [
        'node', '/validator/channel-mock-smoke.mjs', encodedContract,
      ]),
    },
  }
}
