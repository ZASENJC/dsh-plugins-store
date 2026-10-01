import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { loadExtractedSnapshot, resolvePinnedSourceSha } from './archive-snapshot'

const temporaryRoots: string[] = []
const repository = {
  repositoryId: 42,
  fullName: 'owner/example-plugin',
  url: 'https://github.com/owner/example-plugin',
  pushedAt: '2026-08-14T08:00:00Z',
  projectType: 'plugin' as const,
  topics: ['dsh-plugin', 'tool'],
  defaultBranch: 'main',
  archived: false,
  sizeKb: 120,
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('archive-backed GitHub snapshot', () => {
  it('resolves the exact default-branch SHA with one numeric-ID REST request', async () => {
    const sourceSha = 'a'.repeat(40)
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ sha: sourceSha }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }))

    await expect(resolvePinnedSourceSha(repository, { fetchImpl })).resolves.toBe(sourceSha)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.github.com/repositories/42/commits/main',
      expect.objectContaining({ headers: expect.any(Object) }),
    )
  })

  it('builds file existence and structural content from the extracted fixed-SHA archive', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-archive-snapshot-'))
    temporaryRoots.push(root)
    await mkdir(join(root, 'lib'), { recursive: true })
    await mkdir(join(root, 'config'), { recursive: true })
    await writeFile(join(root, 'package.json'), JSON.stringify({
      main: './lib/index.js',
      dsh: { bundle: { patch: './config/custom.cordis.yml' } },
    }))
    await writeFile(join(root, '.npmrc'), '@private:registry=https://npm.pkg.github.com/\n')
    await writeFile(join(root, 'lib/index.js'), 'export default {}')
    await writeFile(join(root, 'config/custom.cordis.yml'), '- insert: []\n')

    const snapshot = await loadExtractedSnapshot(repository, {
      sourceSha: 'b'.repeat(40),
      sourceDirectory: root,
      scans: {
        trivy: { status: 'passed', vulnerabilities: [], secrets: [] },
        osv: { status: 'passed', vulnerabilities: [] },
        gitleaks: { status: 'passed', secrets: [] },
      },
    })

    expect(snapshot.repository).toMatchObject({
      id: 42,
      fullName: 'owner/example-plugin',
      sourceSha: 'b'.repeat(40),
      archived: false,
      sizeKb: 120,
    })
    expect(snapshot.files['package.json']).toContain('custom.cordis.yml')
    expect(snapshot.files['.npmrc']).toBe('@private:registry=https://npm.pkg.github.com/\n')
    expect(snapshot.files['lib/index.js']).toBe('')
    expect(snapshot.files['config/custom.cordis.yml']).toBe('- insert: []\n')
  })
})

function commitResponse(
  status: number,
  headers: Record<string, string> = {},
  body: unknown = { message: 'failed' },
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  })
}

function okCommit(sha: string): Response {
  return commitResponse(200, {}, { sha })
}

function namedError(name: string, message: string): Error {
  const error = new Error(message)
  error.name = name
  return error
}

interface ScriptedCommitClient {
  sleeps: number[]
  warnings: string[]
  timeouts: number[]
  calls: Array<{ input: RequestInfo | URL; init?: RequestInit }>
  signals: AbortSignal[]
  options: {
    fetchImpl: typeof fetch
    sleep: (ms: number) => Promise<void>
    warn: (message: string) => void
    timeoutSignal: (ms: number) => AbortSignal
  }
}

function scriptedCommitClient(outcomes: Array<Response | Error>): ScriptedCommitClient {
  const sleeps: number[] = []
  const warnings: string[] = []
  const timeouts: number[] = []
  const calls: ScriptedCommitClient['calls'] = []
  const signals: AbortSignal[] = []
  let index = 0
  return {
    sleeps,
    warnings,
    timeouts,
    calls,
    signals,
    options: {
      fetchImpl: async (input, init) => {
        calls.push({ input, init })
        const outcome = outcomes[index]
        index += 1
        if (outcome === undefined) throw new Error(`unexpected fetch #${index}`)
        if (outcome instanceof Error) throw outcome
        return outcome
      },
      sleep: async (ms) => {
        sleeps.push(ms)
      },
      warn: (message) => {
        warnings.push(message)
      },
      timeoutSignal: (ms) => {
        timeouts.push(ms)
        const signal = new AbortController().signal
        signals.push(signal)
        return signal
      },
    },
  }
}

async function rejectedMessage(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
  throw new Error('expected rejection')
}

describe('pinned source SHA request recovery', () => {
  it('retries a transient 502 and returns the pinned SHA', async () => {
    const sourceSha = 'c'.repeat(40)
    const client = scriptedCommitClient([
      commitResponse(502, { 'x-ratelimit-remaining': '22' }),
      okCommit(sourceSha),
    ])

    await expect(resolvePinnedSourceSha(repository, client.options)).resolves.toBe(sourceSha)
    expect(client.sleeps).toEqual([5_000])
    expect(client.calls).toHaveLength(2)
    expect(String(client.calls[0]?.input)).toBe('https://api.github.com/repositories/42/commits/main')
    expect(String(client.calls[1]?.input)).toBe('https://api.github.com/repositories/42/commits/main')
    expect(client.warnings).toEqual([
      'GitHub commit request failed (502) for /repositories/42/commits/main; waiting 5s before retry 1/5',
    ])
    expect(client.timeouts).toEqual([30_000, 30_000])
    expect(client.calls[0]?.init?.signal).toBe(client.signals[0])
    expect(client.calls[1]?.init?.signal).toBe(client.signals[1])
    expect(client.signals[0]).not.toBe(client.signals[1])
    const headers = new Headers(client.calls[1]?.init?.headers)
    expect(headers.get('accept')).toBe('application/vnd.github+json')
    expect(headers.get('user-agent')).toBe('dsh-plugins-store-validator')
    expect(headers.get('x-github-api-version')).toBe('2022-11-28')
  })

  it('retries HTTP 408 with the same first backoff', async () => {
    const sourceSha = 'd'.repeat(40)
    const client = scriptedCommitClient([
      commitResponse(408),
      okCommit(sourceSha),
    ])

    await expect(resolvePinnedSourceSha(repository, client.options)).resolves.toBe(sourceSha)
    expect(client.sleeps).toEqual([5_000])
    expect(client.warnings[0]).toContain('408')
    expect(client.warnings[0]).toContain('/repositories/42/commits/main')
    expect(client.calls).toHaveLength(2)
  })

  it('throws the commit request error after five transient retries are exhausted', async () => {
    const client = scriptedCommitClient([
      commitResponse(502, { 'x-ratelimit-remaining': '1' }),
      commitResponse(502, { 'x-ratelimit-remaining': '1' }),
      commitResponse(502, { 'x-ratelimit-remaining': '1' }),
      commitResponse(502, { 'x-ratelimit-remaining': '1' }),
      commitResponse(502, { 'x-ratelimit-remaining': '1' }),
      commitResponse(503, { 'x-ratelimit-remaining': '22' }),
    ])

    expect(await rejectedMessage(resolvePinnedSourceSha(repository, client.options)))
      .toBe('GitHub commit request failed: 503; remaining=22')
    expect(client.calls).toHaveLength(6)
    expect(client.sleeps).toEqual([5_000, 15_000, 30_000, 60_000, 60_000])
    expect(client.warnings).toEqual([
      'GitHub commit request failed (502) for /repositories/42/commits/main; waiting 5s before retry 1/5',
      'GitHub commit request failed (502) for /repositories/42/commits/main; waiting 15s before retry 2/5',
      'GitHub commit request failed (502) for /repositories/42/commits/main; waiting 30s before retry 3/5',
      'GitHub commit request failed (502) for /repositories/42/commits/main; waiting 60s before retry 4/5',
      'GitHub commit request failed (502) for /repositories/42/commits/main; waiting 60s before retry 5/5',
    ])
    expect(client.timeouts).toEqual([30_000, 30_000, 30_000, 30_000, 30_000, 30_000])
  })

  it('throws a 404 immediately without retrying', async () => {
    const client = scriptedCommitClient([
      commitResponse(404, { 'x-ratelimit-remaining': '18' }),
    ])

    expect(await rejectedMessage(resolvePinnedSourceSha(repository, client.options)))
      .toBe('GitHub commit request failed: 404; remaining=18')
    expect(client.calls).toHaveLength(1)
    expect(client.sleeps).toEqual([])
    expect(client.warnings).toEqual([])
    expect(client.timeouts).toEqual([30_000])
    expect(client.calls[0]?.init?.signal).toBe(client.signals[0])
  })

  it('throws 401, 403 with quota, and 422 immediately without retrying', async () => {
    const cases = [
      { status: 401, remaining: '0', message: 'GitHub commit request failed: 401; remaining=0' },
      { status: 403, remaining: '4', message: 'GitHub commit request failed: 403; remaining=4' },
      { status: 422, remaining: '9', message: 'GitHub commit request failed: 422; remaining=9' },
    ]
    for (const testCase of cases) {
      const client = scriptedCommitClient([
        commitResponse(testCase.status, { 'x-ratelimit-remaining': testCase.remaining }),
      ])
      expect(await rejectedMessage(resolvePinnedSourceSha(repository, client.options))).toBe(testCase.message)
      expect(client.calls).toHaveLength(1)
      expect(client.sleeps).toEqual([])
      expect(client.warnings).toEqual([])
      expect(client.timeouts).toEqual([30_000])
    }
  })

  it('waits out a 429 with retry-after and still returns the pinned SHA', async () => {
    const sourceSha = '0'.repeat(40)
    const client = scriptedCommitClient([
      commitResponse(429, { 'retry-after': '4' }),
      okCommit(sourceSha),
    ])

    await expect(resolvePinnedSourceSha(repository, client.options)).resolves.toBe(sourceSha)
    expect(client.sleeps).toEqual([4_000])
    expect(client.calls).toHaveLength(2)
    expect(client.warnings).toEqual([
      'GitHub commit rate limited for /repositories/42/commits/main; waiting 4s before retry 1/3',
    ])
  })

  it('waits out a 403 with exhausted rate limit using x-ratelimit-reset', async () => {
    const now = 1_700_000_000_000
    const sourceSha = '1'.repeat(40)
    const client = scriptedCommitClient([
      commitResponse(403, {
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': String(Math.ceil(now / 1000) + 30),
      }),
      okCommit(sourceSha),
    ])

    await expect(resolvePinnedSourceSha(repository, { ...client.options, now: () => now }))
      .resolves.toBe(sourceSha)
    expect(client.sleeps).toEqual([31_000])
  })

  it('throws after three bounded rate-limit waits', async () => {
    const limited = () => commitResponse(429, { 'retry-after': '30', 'x-ratelimit-remaining': '0' })
    const client = scriptedCommitClient([limited(), limited(), limited(), limited()])

    expect(await rejectedMessage(resolvePinnedSourceSha(repository, client.options)))
      .toBe('GitHub commit request failed: 429; remaining=0')
    expect(client.calls).toHaveLength(4)
    expect(client.sleeps).toEqual([30_000, 30_000, 30_000])
  })

  it('does not wait when the required rate-limit wait exceeds the bound', async () => {
    const client = scriptedCommitClient([
      commitResponse(429, { 'retry-after': '600', 'x-ratelimit-remaining': '0' }),
    ])

    expect(await rejectedMessage(resolvePinnedSourceSha(repository, client.options)))
      .toBe('GitHub commit request failed: 429; remaining=0')
    expect(client.calls).toHaveLength(1)
    expect(client.sleeps).toEqual([])
  })

  it('applies a fresh timeout signal to the commit request', async () => {
    const sourceSha = 'e'.repeat(40)
    const client = scriptedCommitClient([okCommit(sourceSha)])

    await expect(resolvePinnedSourceSha(repository, client.options)).resolves.toBe(sourceSha)
    expect(client.timeouts).toEqual([30_000])
    expect(client.calls[0]?.init?.signal).toBeInstanceOf(AbortSignal)
    expect(client.calls[0]?.init?.signal).toBe(client.signals[0])
    expect(client.sleeps).toEqual([])
    expect(client.warnings).toEqual([])
  })

  it('retries a rejected commit fetch, including an abort, then returns the SHA', async () => {
    const sourceSha = 'f'.repeat(40)
    const client = scriptedCommitClient([
      namedError('AbortError', 'The operation was aborted'),
      okCommit(sourceSha),
    ])

    await expect(resolvePinnedSourceSha(repository, client.options)).resolves.toBe(sourceSha)
    expect(client.sleeps).toEqual([5_000])
    expect(client.calls).toHaveLength(2)
    expect(client.warnings).toEqual([
      'GitHub commit request failed (AbortError: The operation was aborted) for /repositories/42/commits/main; waiting 5s before retry 1/5',
    ])
    expect(client.timeouts).toEqual([30_000, 30_000])
  })

  it('throws a descriptive error when rejected fetches exhaust the retry budget', async () => {
    const aborted = () => namedError('AbortError', 'The operation was aborted')
    const client = scriptedCommitClient([aborted(), aborted(), aborted(), aborted(), aborted(), aborted()])

    expect(await rejectedMessage(resolvePinnedSourceSha(repository, client.options)))
      .toBe('GitHub commit request failed: AbortError: The operation was aborted; remaining=unknown')
    expect(client.calls).toHaveLength(6)
    expect(client.sleeps).toEqual([5_000, 15_000, 30_000, 60_000, 60_000])
    expect(client.warnings).toHaveLength(5)
  })
})
