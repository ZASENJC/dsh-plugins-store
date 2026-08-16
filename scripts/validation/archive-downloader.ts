import { execFile } from 'node:child_process'
import { chmod, mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const CODELOAD_URL = 'https://codeload.github.com'
const MAX_ARCHIVE_BYTES = 250 * 1024 * 1024
const DOWNLOAD_TIMEOUT_MS = 120_000
const EXTRACTION_IMAGE = 'alpine:3.22.1'

export interface ArchiveExtractionCommand {
  file: 'docker'
  args: string[]
}

export interface ArchiveExtractionIdentity {
  uid: number
  gid: number
}

function currentExtractionIdentity(): ArchiveExtractionIdentity {
  const uid = process.getuid?.()
  const gid = process.getgid?.()
  return Number.isSafeInteger(uid) && Number(uid) > 0
    && Number.isSafeInteger(gid) && Number(gid) >= 0
    ? { uid: Number(uid), gid: Number(gid) }
    : { uid: 65532, gid: 65532 }
}

export function buildArchiveExtractionCommand(
  archivePath: string,
  outputDirectory: string,
  identity = currentExtractionIdentity(),
): ArchiveExtractionCommand {
  if (!Number.isSafeInteger(identity.uid) || identity.uid <= 0
    || !Number.isSafeInteger(identity.gid) || identity.gid < 0) {
    throw new Error('Archive extraction requires a non-root identity')
  }
  const archive = resolve(archivePath)
  const output = resolve(outputDirectory)
  return {
    file: 'docker',
    args: [
      'run', '--rm', '--network=none', '--read-only', '--cap-drop=ALL',
      '--security-opt=no-new-privileges', '--pids-limit=64', '--memory=256m', '--cpus=1',
      `--user=${identity.uid}:${identity.gid}`, '--tmpfs=/tmp:rw,noexec,nosuid,size=32m',
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

async function readResponseBytes(response: Response): Promise<Uint8Array> {
  if (!response.body) throw new Error('GitHub archive response has no body')

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = value ?? new Uint8Array()
      total += chunk.byteLength
      if (total > MAX_ARCHIVE_BYTES) {
        await reader.cancel()
        throw new Error('GitHub archive exceeds validation size limit')
      }
      chunks.push(chunk)
    }
  } finally {
    reader.releaseLock()
  }

  const data = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    data.set(chunk, offset)
    offset += chunk.byteLength
  }
  return data
}

export async function downloadPinnedArchive({
  repositoryId,
  repositoryFullName,
  sourceSha,
  destinationPath,
  fetchImpl = fetch,
  writeArchive = defaultWriteArchive,
}: {
  repositoryId: number
  repositoryFullName: string
  sourceSha: string
  destinationPath: string
  fetchImpl?: typeof fetch
  writeArchive?: (path: string, data: Uint8Array) => Promise<void>
}): Promise<void> {
  if (!Number.isSafeInteger(repositoryId) || repositoryId <= 0) throw new Error('Repository numeric ID is invalid')
  const nameParts = repositoryFullName.split('/')
  if (nameParts.length !== 2
    || nameParts.some((part) => !/^[A-Za-z0-9_.-]+$/.test(part) || part === '.' || part === '..')) {
    throw new Error('Repository full name is invalid')
  }
  if (!/^[a-f0-9]{40}$/i.test(sourceSha)) throw new Error('Repository source SHA is invalid')
  const encodedName = nameParts.map(encodeURIComponent).join('/')
  const controller = new AbortController()
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    const operation = (async () => {
      const response = await fetchImpl(`${CODELOAD_URL}/${encodedName}/tar.gz/${sourceSha}`, {
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'User-Agent': 'dsh-plugins-store-validator',
        },
      })
      if (!response.ok) throw new Error(`GitHub archive request failed: ${response.status}`)
      const contentLength = response.headers.get('content-length')
      if (contentLength !== null) {
        const declaredSize = Number(contentLength)
        if (!Number.isSafeInteger(declaredSize) || declaredSize < 0 || declaredSize > MAX_ARCHIVE_BYTES) {
          throw new Error('GitHub archive exceeds validation size limit')
        }
      }
      const data = await readResponseBytes(response)
      if (controller.signal.aborted) throw new Error('GitHub archive download timed out')
      await writeArchive(destinationPath, data)
    })()
    await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          controller.abort()
          reject(new Error('GitHub archive download timed out'))
        }, DOWNLOAD_TIMEOUT_MS)
      }),
    ])
  } catch (error) {
    if (controller.signal.aborted) throw new Error('GitHub archive download timed out')
    throw error
  } finally {
    if (timeout) clearTimeout(timeout)
  }
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
