import { describe, expect, it, vi } from 'vitest'

import { loadGitHubSnapshot } from './github-snapshot'

const repository = {
  repositoryId: 42,
  fullName: 'old-owner/example-plugin',
  url: 'https://github.com/old-owner/example-plugin',
  pushedAt: '2026-08-14T08:00:00Z',
  projectType: 'plugin' as const,
  topics: ['dsh-plugin', 'tool'],
  defaultBranch: 'main',
  archived: false,
  sizeKb: 120,
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('GitHub fixed-SHA snapshot loader', () => {
  it('revalidates numeric identity, resolves a full SHA, and reads only structural blobs', async () => {
    const sourceSha = 'a'.repeat(40)
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith('/repositories/42')) return jsonResponse({
        id: 42,
        full_name: 'new-owner/example-plugin',
        html_url: 'https://github.com/new-owner/example-plugin',
        default_branch: 'stable',
        pushed_at: '2026-08-14T08:30:00Z',
        private: false,
        archived: false,
        size: 120,
      })
      if (url.endsWith('/repositories/42/commits/stable')) return jsonResponse({ sha: sourceSha })
      if (url.endsWith(`/repositories/42/git/trees/${sourceSha}?recursive=1`)) return jsonResponse({
        truncated: false,
        tree: [
          { path: 'package.json', type: 'blob', sha: 'pkg', size: 300 },
          { path: '.npmrc', type: 'blob', sha: 'npmrc', size: 80 },
          { path: 'config/custom.cordis.yml', type: 'blob', sha: 'patch', size: 120 },
          { path: 'lib/index.js', type: 'blob', sha: 'code', size: 40_000 },
          { path: 'LICENSE', type: 'blob', sha: 'license', size: 1_000 },
        ],
      })
      if (url.endsWith('/repositories/42/git/blobs/pkg')) return jsonResponse({
        encoding: 'base64',
        content: Buffer.from(JSON.stringify({
          main: './lib/index.js',
          dsh: { bundle: { patch: './config/custom.cordis.yml' } },
        })).toString('base64'),
      })
      if (url.endsWith('/repositories/42/git/blobs/npmrc')) return jsonResponse({
        encoding: 'base64',
        content: Buffer.from('@private:registry=https://npm.pkg.github.com/\n').toString('base64'),
      })
      if (url.endsWith('/repositories/42/git/blobs/patch')) return jsonResponse({
        encoding: 'base64',
        content: Buffer.from('- insert: []\n').toString('base64'),
      })
      if (url.endsWith('/repositories/42/git/blobs/license')) return jsonResponse({
        encoding: 'base64',
        content: Buffer.from('MIT License').toString('base64'),
      })
      throw new Error(`Unexpected request: ${url}`)
    })

    const snapshot = await loadGitHubSnapshot(repository, {
      fetchImpl,
      scans: {
        trivy: { status: 'passed', vulnerabilities: [], secrets: [] },
        osv: { status: 'passed', vulnerabilities: [] },
        gitleaks: { status: 'passed', secrets: [] },
      },
    })

    expect(snapshot.repository).toMatchObject({
      id: 42,
      fullName: 'new-owner/example-plugin',
      sourceSha,
    })
    expect(snapshot.files['package.json']).toContain('custom.cordis.yml')
    expect(snapshot.files['.npmrc']).toBe('@private:registry=https://npm.pkg.github.com/\n')
    expect(snapshot.files['lib/index.js']).toBe('')
    expect(snapshot.files['config/custom.cordis.yml']).toBe('- insert: []\n')
    expect(fetchImpl).not.toHaveBeenCalledWith(
      expect.stringContaining('/git/blobs/code'),
      expect.anything(),
    )
  })

  it('rejects a mismatched numeric repository identity', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ id: 99 }))

    await expect(loadGitHubSnapshot(repository, {
      fetchImpl,
      scans: {
        trivy: { status: 'unavailable', vulnerabilities: [], secrets: [] },
        osv: { status: 'unavailable', vulnerabilities: [] },
        gitleaks: { status: 'unavailable', secrets: [] },
      },
    })).rejects.toThrow('numeric ID')
  })

  it('refuses a truncated tree because missing files would create false failures', async () => {
    const sourceSha = 'b'.repeat(40)
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith('/repositories/42')) return jsonResponse({
        id: 42,
        full_name: repository.fullName,
        html_url: repository.url,
        default_branch: 'main',
        pushed_at: repository.pushedAt,
        private: false,
        archived: false,
        size: 100,
      })
      if (url.endsWith('/repositories/42/commits/main')) return jsonResponse({ sha: sourceSha })
      return jsonResponse({ truncated: true, tree: [] })
    })

    await expect(loadGitHubSnapshot(repository, {
      fetchImpl,
      scans: {
        trivy: { status: 'passed', vulnerabilities: [], secrets: [] },
        osv: { status: 'passed', vulnerabilities: [] },
        gitleaks: { status: 'passed', secrets: [] },
      },
    })).rejects.toThrow('truncated')
  })

  it('loads an explicitly pinned baseline SHA instead of silently following the default branch', async () => {
    const sourceSha = 'd'.repeat(40)
    const requestedUrls: string[] = []
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      requestedUrls.push(url)
      if (url.endsWith('/repositories/42')) return jsonResponse({
        id: 42,
        full_name: repository.fullName,
        html_url: repository.url,
        default_branch: 'main',
        pushed_at: repository.pushedAt,
        private: false,
        archived: false,
        size: 100,
      })
      if (url.endsWith(`/repositories/42/commits/${sourceSha}`)) return jsonResponse({ sha: sourceSha })
      if (url.endsWith(`/repositories/42/git/trees/${sourceSha}?recursive=1`)) return jsonResponse({
        truncated: false,
        tree: [],
      })
      throw new Error(`Unexpected request: ${url}`)
    })

    const snapshot = await loadGitHubSnapshot(repository, {
      fetchImpl,
      sourceSha,
      scans: {
        trivy: { status: 'passed', vulnerabilities: [], secrets: [] },
        osv: { status: 'passed', vulnerabilities: [] },
        gitleaks: { status: 'passed', secrets: [] },
      },
    })

    expect(snapshot.repository.sourceSha).toBe(sourceSha)
    expect(requestedUrls.some((url) => url.endsWith('/commits/main'))).toBe(false)
  })
})

const passedScans = {
  trivy: { status: 'passed' as const, vulnerabilities: [], secrets: [] },
  osv: { status: 'passed' as const, vulnerabilities: [] },
  gitleaks: { status: 'passed' as const, secrets: [] },
}

const emptyTreeSha = 'c'.repeat(40)

interface RecordedCall {
  url: string
  init?: RequestInit
}

interface RecoveryClient {
  sleeps: number[]
  warnings: string[]
  timeouts: number[]
  calls: RecordedCall[]
  signals: AbortSignal[]
  fetchImpl: typeof fetch
  sleep: (ms: number) => Promise<void>
  warn: (message: string) => void
  timeoutSignal: (ms: number) => AbortSignal
}

function statusResponse(
  status: number,
  statusText: string,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify({ message: statusText }), {
    status,
    statusText,
    headers,
  })
}

function repositoryMetadata() {
  return {
    id: 42,
    full_name: repository.fullName,
    html_url: repository.url,
    default_branch: 'main',
    pushed_at: repository.pushedAt,
    private: false,
    archived: false,
    size: 100,
  }
}

function routeEmptySnapshot(url: string): Response {
  if (url.endsWith('/repositories/42')) return jsonResponse(repositoryMetadata())
  if (url.endsWith('/repositories/42/commits/main')) return jsonResponse({ sha: emptyTreeSha })
  if (url.endsWith(`/repositories/42/git/trees/${emptyTreeSha}?recursive=1`)) {
    return jsonResponse({ truncated: false, tree: [] })
  }
  throw new Error(`Unexpected request: ${url}`)
}

function recoveryClient(
  respond: (url: string, callIndex: number) => Response | Error,
): RecoveryClient {
  const sleeps: number[] = []
  const warnings: string[] = []
  const timeouts: number[] = []
  const calls: RecordedCall[] = []
  const signals: AbortSignal[] = []
  const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    calls.push({ url, init })
    const outcome = respond(url, calls.length)
    if (outcome instanceof Error) throw outcome
    return outcome
  }) as typeof fetch
  return {
    sleeps,
    warnings,
    timeouts,
    calls,
    signals,
    fetchImpl,
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
  }
}

function loadWith(client: RecoveryClient, token = 'test-token') {
  return loadGitHubSnapshot(repository, {
    fetchImpl: client.fetchImpl,
    token,
    scans: passedScans,
    sleep: client.sleep,
    warn: client.warn,
    timeoutSignal: client.timeoutSignal,
  })
}

async function rejectedMessage(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
  throw new Error('expected rejection')
}

function namedError(name: string, message: string): Error {
  const error = new Error(message)
  error.name = name
  return error
}

describe('GitHub snapshot request recovery', () => {
  it('retries a transient 502 and returns the snapshot after the first backoff', async () => {
    const client = recoveryClient((url, callIndex) => {
      if (callIndex === 1) return statusResponse(502, 'Bad Gateway')
      return routeEmptySnapshot(url)
    })

    const snapshot = await loadWith(client)

    expect(snapshot.repository).toMatchObject({ id: 42, sourceSha: emptyTreeSha })
    expect(client.sleeps).toEqual([5_000])
    expect(client.warnings).toEqual([
      'GitHub snapshot request failed (502 Bad Gateway /repositories/42), waiting 5s before retry (1/5)',
    ])
    expect(client.warnings[0]).not.toContain('test-token')
    expect(client.timeouts).toEqual([30_000, 30_000, 30_000, 30_000])
    expect(client.calls.map((call) => call.init?.signal)).toEqual(client.signals)
    expect(client.signals[0]).not.toBe(client.signals[1])
    expect(client.calls[0]?.url).toBe('https://api.github.com/repositories/42')
    expect(client.calls[1]?.url).toBe('https://api.github.com/repositories/42')
    const headers = new Headers(client.calls[0]?.init?.headers)
    expect(headers.get('accept')).toBe('application/vnd.github+json')
    expect(headers.get('authorization')).toBe('Bearer test-token')
    expect(headers.get('user-agent')).toBe('dsh-plugins-store-validator')
    expect(headers.get('x-github-api-version')).toBe('2022-11-28')
  })

  it('retries HTTP 408 with the same bounded backoff', async () => {
    const client = recoveryClient((url, callIndex) => {
      if (callIndex === 1) return statusResponse(408, 'Request Timeout')
      return routeEmptySnapshot(url)
    })

    await expect(loadWith(client)).resolves.toMatchObject({
      repository: { sourceSha: emptyTreeSha },
    })
    expect(client.sleeps).toEqual([5_000])
    expect(client.warnings).toEqual([
      'GitHub snapshot request failed (408 Request Timeout /repositories/42), waiting 5s before retry (1/5)',
    ])
    expect(client.timeouts).toEqual([30_000, 30_000, 30_000, 30_000])
  })

  it('throws the failing response error after five transient retries, without a sixth wait', async () => {
    const client = recoveryClient((_url, callIndex) => (
      callIndex < 6
        ? statusResponse(502, 'Bad Gateway')
        : statusResponse(503, 'Service Unavailable')
    ))

    expect(await rejectedMessage(loadWith(client)))
      .toBe('GitHub API request failed: 503 /repositories/42')
    expect(client.calls).toHaveLength(6)
    expect(client.calls.every((call) => call.url === 'https://api.github.com/repositories/42')).toBe(true)
    expect(client.sleeps).toEqual([5_000, 15_000, 30_000, 60_000, 60_000])
    expect(client.warnings).toEqual([
      'GitHub snapshot request failed (502 Bad Gateway /repositories/42), waiting 5s before retry (1/5)',
      'GitHub snapshot request failed (502 Bad Gateway /repositories/42), waiting 15s before retry (2/5)',
      'GitHub snapshot request failed (502 Bad Gateway /repositories/42), waiting 30s before retry (3/5)',
      'GitHub snapshot request failed (502 Bad Gateway /repositories/42), waiting 60s before retry (4/5)',
      'GitHub snapshot request failed (502 Bad Gateway /repositories/42), waiting 60s before retry (5/5)',
    ])
    expect(client.timeouts).toEqual([30_000, 30_000, 30_000, 30_000, 30_000, 30_000])
    expect(new Set(client.signals).size).toBe(6)
  })

  it('throws 404 and other non-retryable statuses immediately without retrying', async () => {
    const cases: Array<{
      status: number
      statusText: string
      headers: Record<string, string>
    }> = [
      { status: 401, statusText: 'Unauthorized', headers: { 'x-ratelimit-remaining': '0' } },
      { status: 403, statusText: 'Forbidden', headers: { 'x-ratelimit-remaining': '0' } },
      { status: 403, statusText: 'Forbidden', headers: { 'x-ratelimit-remaining': '5' } },
      { status: 404, statusText: 'Not Found', headers: {} },
      { status: 422, statusText: 'Unprocessable Entity', headers: {} },
      { status: 429, statusText: 'Too Many Requests', headers: { 'retry-after': '4' } },
    ]

    for (const testCase of cases) {
      const client = recoveryClient(() => statusResponse(
        testCase.status,
        testCase.statusText,
        testCase.headers,
      ))

      expect(await rejectedMessage(loadWith(client)))
        .toBe(`GitHub API request failed: ${testCase.status} /repositories/42`)
      expect(client.calls).toHaveLength(1)
      expect(client.sleeps).toEqual([])
      expect(client.warnings).toEqual([])
      expect(client.timeouts).toEqual([30_000])
      expect(client.calls[0]?.init?.signal).toBeInstanceOf(AbortSignal)
      expect(client.calls[0]?.init?.signal).toBe(client.signals[0])
    }
  })

  it('applies a fresh 30s timeout signal on every successful snapshot request', async () => {
    const client = recoveryClient((url) => routeEmptySnapshot(url))

    const snapshot = await loadWith(client)

    expect(snapshot.repository.sourceSha).toBe(emptyTreeSha)
    expect(client.sleeps).toEqual([])
    expect(client.warnings).toEqual([])
    expect(client.timeouts).toEqual([30_000, 30_000, 30_000])
    expect(client.calls.map((call) => call.init?.signal)).toEqual(client.signals)
    expect(client.signals.every((signal) => signal instanceof AbortSignal)).toBe(true)
    expect(new Set(client.signals).size).toBe(3)
    expect(client.calls.map((call) => call.url)).toEqual([
      'https://api.github.com/repositories/42',
      'https://api.github.com/repositories/42/commits/main',
      `https://api.github.com/repositories/42/git/trees/${emptyTreeSha}?recursive=1`,
    ])
  })

  it('retries only the failing request and does not repeat earlier snapshot reads', async () => {
    const client = recoveryClient((url, callIndex) => {
      if (url.endsWith('/commits/main') && callIndex === 2) return statusResponse(500, 'Internal Server Error')
      return routeEmptySnapshot(url)
    })

    await expect(loadWith(client)).resolves.toMatchObject({
      repository: { sourceSha: emptyTreeSha },
    })
    expect(client.calls.filter((call) => call.url.endsWith('/repositories/42'))).toHaveLength(1)
    expect(client.calls.filter((call) => call.url.endsWith('/commits/main'))).toHaveLength(2)
    expect(client.sleeps).toEqual([5_000])
    expect(client.warnings).toEqual([
      'GitHub snapshot request failed (500 Internal Server Error /repositories/42/commits/main), waiting 5s before retry (1/5)',
    ])
  })

  it('retries a rejected fetch, including abort errors, then succeeds', async () => {
    const client = recoveryClient((url, callIndex) => {
      if (callIndex === 1) return new TypeError('fetch failed')
      return routeEmptySnapshot(url)
    })

    await expect(loadWith(client)).resolves.toMatchObject({
      repository: { id: 42 },
    })
    expect(client.sleeps).toEqual([5_000])
    expect(client.warnings).toEqual([
      'GitHub snapshot request failed (TypeError: fetch failed /repositories/42), waiting 5s before retry (1/5)',
    ])
    expect(client.timeouts).toEqual([30_000, 30_000, 30_000, 30_000])
    expect(client.calls[0]?.init?.signal).toBe(client.signals[0])
    expect(client.calls[1]?.init?.signal).toBe(client.signals[1])
  })

  it('throws a descriptive error when aborted requests exhaust the retry budget', async () => {
    const client = recoveryClient(() => namedError('AbortError', 'The operation was aborted'))

    expect(await rejectedMessage(loadWith(client)))
      .toBe('GitHub API request failed: AbortError: The operation was aborted /repositories/42')
    expect(client.calls).toHaveLength(6)
    expect(client.sleeps).toEqual([5_000, 15_000, 30_000, 60_000, 60_000])
    expect(client.warnings).toEqual([
      'GitHub snapshot request failed (AbortError: The operation was aborted /repositories/42), waiting 5s before retry (1/5)',
      'GitHub snapshot request failed (AbortError: The operation was aborted /repositories/42), waiting 15s before retry (2/5)',
      'GitHub snapshot request failed (AbortError: The operation was aborted /repositories/42), waiting 30s before retry (3/5)',
      'GitHub snapshot request failed (AbortError: The operation was aborted /repositories/42), waiting 60s before retry (4/5)',
      'GitHub snapshot request failed (AbortError: The operation was aborted /repositories/42), waiting 60s before retry (5/5)',
    ])
    expect(client.timeouts).toEqual([30_000, 30_000, 30_000, 30_000, 30_000, 30_000])
  })

  it('does not retry a successful response whose body cannot be parsed', async () => {
    const client = recoveryClient((url, callIndex) => {
      if (callIndex === 1) return new Response('not-json', { status: 200, statusText: 'OK' })
      return routeEmptySnapshot(url)
    })

    await expect(loadWith(client)).rejects.toThrow()
    expect(client.calls).toHaveLength(1)
    expect(client.sleeps).toEqual([])
    expect(client.warnings).toEqual([])
    expect(client.timeouts).toEqual([30_000])
  })
})
