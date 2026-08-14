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
          { path: 'cordis.patch.yml', type: 'blob', sha: 'patch', size: 120 },
          { path: 'lib/index.js', type: 'blob', sha: 'code', size: 40_000 },
          { path: 'LICENSE', type: 'blob', sha: 'license', size: 1_000 },
        ],
      })
      if (url.endsWith('/repositories/42/git/blobs/pkg')) return jsonResponse({
        encoding: 'base64',
        content: Buffer.from('{"main":"./lib/index.js"}').toString('base64'),
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
    expect(snapshot.files['package.json']).toBe('{"main":"./lib/index.js"}')
    expect(snapshot.files['lib/index.js']).toBe('')
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
