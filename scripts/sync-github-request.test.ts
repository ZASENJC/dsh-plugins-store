import { describe, expect, it } from 'vitest'

import { fetchPage, fetchRenderedReadme } from './sync-github'

const searchPage = {
  total_count: 1,
  incomplete_results: false,
  items: [],
}

interface RecordedCall {
  url: string
  init?: RequestInit
}

interface RecordedClient {
  sleeps: number[]
  warnings: string[]
  timeouts: number[]
  calls: RecordedCall[]
  signals: AbortSignal[]
  dependencies: {
    fetchImpl: (input: string, init?: RequestInit) => Promise<Response>
    sleep: (ms: number) => Promise<void>
    warn: (message: string) => void
    now: () => number
    timeoutSignal: (ms: number) => AbortSignal
  }
}

function searchResponse(
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

function okSearchPage(): Response {
  return new Response(JSON.stringify(searchPage), { status: 200, statusText: 'OK' })
}

function namedError(name: string, message: string): Error {
  const error = new Error(message)
  error.name = name
  return error
}

function scriptedGitHub(
  outcomes: Array<Response | Error>,
  now = 1_700_000_000_000,
): RecordedClient {
  const sleeps: number[] = []
  const warnings: string[] = []
  const timeouts: number[] = []
  const calls: RecordedCall[] = []
  const signals: AbortSignal[] = []
  let index = 0
  return {
    sleeps,
    warnings,
    timeouts,
    calls,
    signals,
    dependencies: {
      fetchImpl: async (url, init) => {
        calls.push({ url, init })
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
      now: () => now,
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

describe('GitHub search request recovery', () => {
  it('retries a transient 502 and returns the page after the first backoff', async () => {
    const client = scriptedGitHub([
      searchResponse(502, 'Bad Gateway', { 'x-ratelimit-remaining': '22' }),
      okSearchPage(),
    ])

    const page = await fetchPage(
      2,
      { createdStart: '2026-01-01', createdEnd: '2026-01-02' },
      { sort: 'stars', order: 'asc' },
      client.dependencies,
    )

    expect(page).toEqual(searchPage)
    expect(client.sleeps).toEqual([5_000])
    expect(client.warnings).toEqual([
      'GitHub Search 请求失败（502 Bad Gateway），等待 5 秒后重试（第 1/5 次）',
    ])
    expect(client.timeouts).toEqual([30_000, 30_000])
    expect(client.calls[0]?.init?.signal).toBe(client.signals[0])
    expect(client.calls[1]?.init?.signal).toBe(client.signals[1])
    expect(client.signals[0]).not.toBe(client.signals[1])

    const url = new URL(client.calls[0]?.url ?? '')
    expect(`${url.origin}${url.pathname}`).toBe('https://api.github.com/search/repositories')
    expect(url.searchParams.get('q')).toBe(
      'topic:dsh-plugin topic:deepseek-harness archived:false fork:false created:2026-01-01..2026-01-02',
    )
    expect(url.searchParams.get('page')).toBe('2')
    expect(url.searchParams.get('per_page')).toBe('100')
    expect(url.searchParams.get('sort')).toBe('stars')
    expect(url.searchParams.get('order')).toBe('asc')
    const headers = new Headers(client.calls[0]?.init?.headers)
    expect(headers.get('accept')).toBe('application/vnd.github+json')
    expect(headers.get('user-agent')).toBe('dsh-plugins-store-sync')
    expect(headers.get('x-github-api-version')).toBe('2022-11-28')
  })

  it('backs off through five distinct transient statuses before succeeding', async () => {
    const client = scriptedGitHub([
      searchResponse(502, 'Bad Gateway'),
      searchResponse(503, 'Service Unavailable'),
      searchResponse(504, 'Gateway Timeout'),
      searchResponse(501, 'Not Implemented'),
      searchResponse(408, 'Request Timeout'),
      okSearchPage(),
    ])

    await expect(fetchPage(1, {}, { sort: 'stars', order: 'desc' }, client.dependencies)).resolves.toEqual(searchPage)
    expect(client.sleeps).toEqual([5_000, 15_000, 30_000, 60_000, 60_000])
    expect(client.warnings).toEqual([
      'GitHub Search 请求失败（502 Bad Gateway），等待 5 秒后重试（第 1/5 次）',
      'GitHub Search 请求失败（503 Service Unavailable），等待 15 秒后重试（第 2/5 次）',
      'GitHub Search 请求失败（504 Gateway Timeout），等待 30 秒后重试（第 3/5 次）',
      'GitHub Search 请求失败（501 Not Implemented），等待 60 秒后重试（第 4/5 次）',
      'GitHub Search 请求失败（408 Request Timeout），等待 60 秒后重试（第 5/5 次）',
    ])
    expect(client.timeouts).toEqual([30_000, 30_000, 30_000, 30_000, 30_000, 30_000])
  })

  it('throws the failing response error after five transient retries, without a sixth wait', async () => {
    const client = scriptedGitHub([
      searchResponse(502, 'Bad Gateway', { 'x-ratelimit-remaining': '1' }),
      searchResponse(502, 'Bad Gateway', { 'x-ratelimit-remaining': '1' }),
      searchResponse(502, 'Bad Gateway', { 'x-ratelimit-remaining': '1' }),
      searchResponse(502, 'Bad Gateway', { 'x-ratelimit-remaining': '1' }),
      searchResponse(502, 'Bad Gateway', { 'x-ratelimit-remaining': '1' }),
      searchResponse(503, 'Service Unavailable', { 'x-ratelimit-remaining': '22' }),
    ])

    expect(await rejectedMessage(fetchPage(1, {}, { sort: 'stars', order: 'desc' }, client.dependencies)))
      .toBe('GitHub API 请求失败：503 Service Unavailable，剩余额度 22')
    expect(client.calls).toHaveLength(6)
    expect(client.sleeps).toEqual([5_000, 15_000, 30_000, 60_000, 60_000])
    expect(client.warnings).toHaveLength(5)
  })

  it('throws non-retryable statuses immediately and still times out that attempt', async () => {
    const cases: Array<{
      status: number
      statusText: string
      headers: Record<string, string>
      message: string
    }> = [
      {
        status: 401,
        statusText: 'Unauthorized',
        headers: { 'x-ratelimit-remaining': '0' },
        message: 'GitHub API 请求失败：401 Unauthorized，剩余额度 0',
      },
      {
        status: 404,
        statusText: 'Not Found',
        headers: {},
        message: 'GitHub API 请求失败：404 Not Found，剩余额度 未知',
      },
      {
        status: 403,
        statusText: 'Forbidden',
        headers: { 'x-ratelimit-remaining': '5' },
        message: 'GitHub API 请求失败：403 Forbidden，剩余额度 5',
      },
    ]

    for (const testCase of cases) {
      const client = scriptedGitHub([
        searchResponse(testCase.status, testCase.statusText, testCase.headers),
      ])
      expect(await rejectedMessage(fetchPage(1, {}, { sort: 'stars', order: 'desc' }, client.dependencies)))
        .toBe(testCase.message)
      expect(client.calls).toHaveLength(1)
      expect(client.sleeps).toEqual([])
      expect(client.warnings).toEqual([])
      expect(client.timeouts).toEqual([30_000])
    }
  })

  it('retries a rejected search fetch, including abort errors, on the transient budget', async () => {
    const client = scriptedGitHub([
      new TypeError('fetch failed'),
      okSearchPage(),
    ])

    await expect(fetchPage(1, {}, { sort: 'stars', order: 'desc' }, client.dependencies)).resolves.toEqual(searchPage)
    expect(client.sleeps).toEqual([5_000])
    expect(client.warnings).toEqual([
      'GitHub Search 请求失败（TypeError: fetch failed），等待 5 秒后重试（第 1/5 次）',
    ])
    expect(client.timeouts).toEqual([30_000, 30_000])
  })

  it('throws a descriptive error when aborted requests exhaust the retry cap', async () => {
    const aborted = () => namedError('AbortError', 'The operation was aborted')
    const client = scriptedGitHub([aborted(), aborted(), aborted(), aborted(), aborted(), aborted()])

    expect(await rejectedMessage(fetchPage(1, {}, { sort: 'stars', order: 'desc' }, client.dependencies)))
      .toBe('GitHub API 请求失败：AbortError: The operation was aborted，剩余额度 未知')
    expect(client.calls).toHaveLength(6)
    expect(client.sleeps).toEqual([5_000, 15_000, 30_000, 60_000, 60_000])
    expect(client.warnings).toEqual([
      'GitHub Search 请求失败（AbortError: The operation was aborted），等待 5 秒后重试（第 1/5 次）',
      'GitHub Search 请求失败（AbortError: The operation was aborted），等待 15 秒后重试（第 2/5 次）',
      'GitHub Search 请求失败（AbortError: The operation was aborted），等待 30 秒后重试（第 3/5 次）',
      'GitHub Search 请求失败（AbortError: The operation was aborted），等待 60 秒后重试（第 4/5 次）',
      'GitHub Search 请求失败（AbortError: The operation was aborted），等待 60 秒后重试（第 5/5 次）',
    ])
  })

  it('does not retry a successful response whose body cannot be parsed', async () => {
    const client = scriptedGitHub([
      new Response('not-json', { status: 200, statusText: 'OK' }),
    ])

    await expect(fetchPage(1, {}, { sort: 'stars', order: 'desc' }, client.dependencies)).rejects.toThrow()
    expect(client.calls).toHaveLength(1)
    expect(client.sleeps).toEqual([])
    expect(client.warnings).toEqual([])
  })

  it('keeps rate-limit waits unbounded and on the existing rate-limit message', async () => {
    const limited = () => searchResponse(429, 'Too Many Requests', { 'retry-after': '4' })
    const client = scriptedGitHub([
      limited(),
      limited(),
      limited(),
      limited(),
      limited(),
      limited(),
      okSearchPage(),
    ])

    await expect(fetchPage(1, {}, { sort: 'stars', order: 'desc' }, client.dependencies)).resolves.toEqual(searchPage)
    expect(client.sleeps).toEqual([4_000, 4_000, 4_000, 4_000, 4_000, 4_000])
    expect(client.warnings).toEqual(Array.from(
      { length: 6 },
      () => 'GitHub Search 达到速率限制，等待 4 秒后继续',
    ))
  })

  it('does not let rate-limit waits consume or reset the transient retry budget', async () => {
    const transient = () => searchResponse(502, 'Bad Gateway', { 'x-ratelimit-remaining': '1' })
    const limited = () => searchResponse(429, 'Too Many Requests', { 'retry-after': '3' })
    const client = scriptedGitHub([
      transient(),
      limited(),
      transient(),
      limited(),
      transient(),
      limited(),
      transient(),
      limited(),
      transient(),
      limited(),
      searchResponse(502, 'Bad Gateway', { 'x-ratelimit-remaining': '22' }),
    ])

    expect(await rejectedMessage(fetchPage(1, {}, { sort: 'stars', order: 'desc' }, client.dependencies)))
      .toBe('GitHub API 请求失败：502 Bad Gateway，剩余额度 22')
    expect(client.calls).toHaveLength(11)
    expect(client.sleeps).toEqual([
      5_000,
      3_000,
      15_000,
      3_000,
      30_000,
      3_000,
      60_000,
      3_000,
      60_000,
      3_000,
    ])
    expect(client.warnings).toEqual([
      'GitHub Search 请求失败（502 Bad Gateway），等待 5 秒后重试（第 1/5 次）',
      'GitHub Search 达到速率限制，等待 3 秒后继续',
      'GitHub Search 请求失败（502 Bad Gateway），等待 15 秒后重试（第 2/5 次）',
      'GitHub Search 达到速率限制，等待 3 秒后继续',
      'GitHub Search 请求失败（502 Bad Gateway），等待 30 秒后重试（第 3/5 次）',
      'GitHub Search 达到速率限制，等待 3 秒后继续',
      'GitHub Search 请求失败（502 Bad Gateway），等待 60 秒后重试（第 4/5 次）',
      'GitHub Search 达到速率限制，等待 3 秒后继续',
      'GitHub Search 请求失败（502 Bad Gateway），等待 60 秒后重试（第 5/5 次）',
      'GitHub Search 达到速率限制，等待 3 秒后继续',
    ])
  })

  it('treats a depleted 403 as a rate limit and prefers retry-after over reset', async () => {
    const client = scriptedGitHub([
      searchResponse(403, 'Forbidden', {
        'x-ratelimit-remaining': '0',
        'retry-after': '9',
        'x-ratelimit-reset': '1700000030',
      }),
      okSearchPage(),
    ])

    await expect(fetchPage(1, {}, { sort: 'stars', order: 'desc' }, client.dependencies)).resolves.toEqual(searchPage)
    expect(client.sleeps).toEqual([9_000])
    expect(client.warnings).toEqual(['GitHub Search 达到速率限制，等待 9 秒后继续'])
  })

  it('waits until the rate-limit reset and floors a past reset at one second', async () => {
    const future = scriptedGitHub([
      searchResponse(429, 'Too Many Requests', { 'x-ratelimit-reset': '1700000030' }),
      okSearchPage(),
    ])
    await expect(fetchPage(1, {}, { sort: 'stars', order: 'desc' }, future.dependencies)).resolves.toEqual(searchPage)
    expect(future.sleeps).toEqual([31_000])
    expect(future.warnings).toEqual(['GitHub Search 达到速率限制，等待 31 秒后继续'])

    const past = scriptedGitHub([
      searchResponse(429, 'Too Many Requests', { 'x-ratelimit-reset': '1600000000' }),
      okSearchPage(),
    ])
    await expect(fetchPage(1, {}, { sort: 'stars', order: 'desc' }, past.dependencies)).resolves.toEqual(searchPage)
    expect(past.sleeps).toEqual([1_000])
    expect(past.warnings).toEqual(['GitHub Search 达到速率限制，等待 1 秒后继续'])
  })

  it('falls back to a 60 second rate-limit wait when GitHub sends no hint', async () => {
    const client = scriptedGitHub([
      searchResponse(429, 'Too Many Requests'),
      okSearchPage(),
    ])

    await expect(fetchPage(1, {}, { sort: 'stars', order: 'desc' }, client.dependencies)).resolves.toEqual(searchPage)
    expect(client.sleeps).toEqual([60_000])
    expect(client.warnings).toEqual(['GitHub Search 达到速率限制，等待 60 秒后继续'])
  })
})

describe('rendered README fetch', () => {
  it('times out a rendered README read at 12 seconds without retrying failures', async () => {
    const success = scriptedGitHub([
      new Response('<p>verified</p>', { status: 200, statusText: 'OK' }),
    ])
    const response = await fetchRenderedReadme('qing3a/dsh-plugin-verify', success.dependencies)

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('<p>verified</p>')
    expect(success.calls).toHaveLength(1)
    expect(success.calls[0]?.url).toBe('https://api.github.com/repos/qing3a/dsh-plugin-verify/readme')
    expect(success.timeouts).toEqual([12_000])
    expect(success.calls[0]?.init?.signal).toBe(success.signals[0])
    expect(success.sleeps).toEqual([])
    const headers = new Headers(success.calls[0]?.init?.headers)
    expect(headers.get('accept')).toBe('application/vnd.github.html+json')
    expect(headers.get('user-agent')).toBe('dsh-plugins-store-sync')

    const encoded = scriptedGitHub([new Response('ok', { status: 200, statusText: 'OK' })])
    await fetchRenderedReadme('o w/r+p', encoded.dependencies)
    expect(encoded.calls[0]?.url).toBe('https://api.github.com/repos/o%20w/r%2Bp/readme')

    const failed = scriptedGitHub([namedError('AbortError', 'The operation was aborted')])
    expect(await rejectedMessage(fetchRenderedReadme('qing3a/dsh-plugin-verify', failed.dependencies)))
      .toBe('The operation was aborted')
    expect(failed.calls).toHaveLength(1)
    expect(failed.sleeps).toEqual([])
    expect(failed.timeouts).toEqual([12_000])
  })

  it('returns a non-ok rendered README response instead of throwing', async () => {
    const client = scriptedGitHub([searchResponse(404, 'Not Found')])

    const response = await fetchRenderedReadme('qing3a/dsh-plugin-verify', client.dependencies)

    expect(response.status).toBe(404)
    expect(client.calls).toHaveLength(1)
    expect(client.sleeps).toEqual([])
  })
})
