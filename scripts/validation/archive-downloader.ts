import { execFile } from 'node:child_process'
import { chmod, mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const API_URL = 'https://api.github.com'
const MAX_ARCHIVE_BYTES = 250 * 1024 * 1024
const EXTRACTION_IMAGE = 'alpine:3.22.1'

export interface ArchiveExtractionCommand {
  file: 'docker'
  args: string[]
}

export function buildArchiveExtractionCommand(
  archivePath: string,
  outputDirectory: string,
): ArchiveExtractionCommand {
  const archive = resolve(archivePath)
  const output = resolve(outputDirectory)
  return {
    file: 'docker',
    args: [
      'run', '--rm', '--network=none', '--read-only', '--cap-drop=ALL',
      '--security-opt=no-new-privileges', '--pids-limit=64', '--memory=256m', '--cpus=1',
      '--user=65532:65532', '--tmpfs=/tmp:rw,noexec,nosuid,size=32m',
      '--mount', `type=bind,src=${archive},dst=/archive/repository.tar.gz,readonly`,
      '--mount', `type=bind,src=${output},dst=/output`,
      EXTRACTION_IMAGE,
      'tar', '-xzf', '/archive/repository.tar.gz', '-C', '/output', '--strip-components=1',
    ],
  }
}

async function defaultWriteArchive(path: string, data: Uint8Array): Promise<void> {
  await writeFile(path, data, { flag: 'wx' })
}

export async function downloadPinnedArchive({
  repositoryId,
  sourceSha,
  destinationPath,
  fetchImpl = fetch,
  token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN,
  writeArchive = defaultWriteArchive,
}: {
  repositoryId: number
  sourceSha: string
  destinationPath: string
  fetchImpl?: typeof fetch
  token?: string
  writeArchive?: (path: string, data: Uint8Array) => Promise<void>
}): Promise<void> {
  if (!Number.isSafeInteger(repositoryId) || repositoryId <= 0) throw new Error('Repository numeric ID is invalid')
  if (!/^[a-f0-9]{40}$/i.test(sourceSha)) throw new Error('Repository source SHA is invalid')
  const response = await fetchImpl(`${API_URL}/repositories/${repositoryId}/tarball/${sourceSha}`, {
    redirect: 'follow',
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'dsh-plugin-store-validator',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  if (!response.ok) throw new Error(`GitHub archive request failed: ${response.status}`)
  const declaredSize = Number(response.headers.get('content-length') ?? 0)
  if (declaredSize > MAX_ARCHIVE_BYTES) throw new Error('GitHub archive exceeds validation size limit')
  const data = new Uint8Array(await response.arrayBuffer())
  if (data.byteLength > MAX_ARCHIVE_BYTES) throw new Error('GitHub archive exceeds validation size limit')
  await writeArchive(destinationPath, data)
}

export async function extractPinnedArchive(
  archivePath: string,
  outputDirectory: string,
  {
    executor = async (file: string, args: string[]) => {
      await execFileAsync(file, args, { maxBuffer: 16 * 1024 * 1024 })
    },
  }: {
    executor?: (file: string, args: string[]) => Promise<void>
  } = {},
): Promise<void> {
  await mkdir(outputDirectory, { recursive: true })
  await chmod(outputDirectory, 0o777)
  const command = buildArchiveExtractionCommand(archivePath, outputDirectory)
  await executor(command.file, command.args)
}
