import { describe, expect, it, vi } from 'vitest'

import {
  buildAgentAnalysisPrompt,
  sendInstallFailureToAgent,
} from '../src/agent-analysis.js'

describe('install failure handoff', () => {
  it('retains a new session until readiness and prompt settlement, navigates through uiWorkspace, then releases', async () => {
    const prompt = vi.fn().mockResolvedValue({ ok: true })
    const release = vi.fn()
    let ready
    const reference = { ready: new Promise((resolve) => { ready = resolve }), release }
    const sessions = {
      create: vi.fn().mockResolvedValue('new-session'),
      retain: vi.fn().mockReturnValue(reference),
      binding: vi.fn(),
    }
    const uiWorkspace = { openSession: vi.fn() }
    const sending = sendInstallFailureToAgent({ sessions, uiWorkspace, fullName: 'owner/repo', error: 'failed' })
    await vi.waitFor(() => expect(sessions.retain).toHaveBeenCalledWith('new-session', { source: 'controllerOperation' }))
    expect(prompt).not.toHaveBeenCalled()
    expect(release).not.toHaveBeenCalled()
    ready({ session: { prompt } })
    await expect(sending).resolves.toBe('new-session')
    expect(uiWorkspace.openSession).toHaveBeenCalledWith('new-session')
    expect(prompt).toHaveBeenCalledWith([{ type: 'text', text: expect.stringContaining('owner/repo') }], 'queue')
    expect(sessions.binding).not.toHaveBeenCalled()
    expect(release).toHaveBeenCalledOnce()
  })

  it.each(['ready', 'prompt'])('releases the session reference after a %s failure', async (failure) => {
    const release = vi.fn()
    const reference = {
      ready: failure === 'ready'
        ? Promise.reject(new Error('open failed'))
        : Promise.resolve({ session: { prompt: vi.fn().mockResolvedValue({ ok: false, error: { message: 'prompt refused' } }) } }),
      release,
    }
    // Install a rejection observer before the asynchronously-created session is retained.
    reference.ready.catch(() => {})
    const sessions = { create: vi.fn().mockResolvedValue('new-session'), retain: vi.fn().mockReturnValue(reference) }
    await expect(sendInstallFailureToAgent({ sessions, fullName: 'owner/repo', error: 'failed' })).rejects.toThrow(failure === 'ready' ? 'open failed' : 'prompt refused')
    expect(release).toHaveBeenCalledOnce()
  })

  it('builds a bounded diagnostic prompt without exposing bearer credentials', () => {
    const prompt = buildAgentAnalysisPrompt({
      fullName: 'owner/repository',
      install: {
        source: 'github',
        target: 'owner/repository',
        command: `dsh plugin --profile web add github:owner/repository#${'a'.repeat(40)}`,
      },
      error: 'request failed Authorization: Bearer secret-token\n' + 'x'.repeat(5000),
    })

    expect(prompt).toContain('owner/repository')
    expect(prompt).toContain(`github:owner/repository#${'a'.repeat(40)}`)
    expect(prompt).toContain('安装来源：GitHub 仓库')
    expect(prompt).not.toContain('默认分支')
    expect(prompt).not.toContain('secret-token')
    expect(prompt.length).toBeLessThan(4500)
  })

  it('creates, opens, and prompts a fresh session through the runtime face', async () => {
    const prompt = vi.fn().mockResolvedValue({ ok: true, value: { accepted: true } })
    const session = { prompt }
    const sessions = {
      create: vi.fn().mockResolvedValue('session-new'),
      open: vi.fn(),
      binding: vi.fn().mockReturnValue({ session }),
    }

    await expect(sendInstallFailureToAgent({
      sessions,
      fullName: 'owner/repository',
      install: {
        source: 'github',
        target: 'owner/repository',
        command: `dsh plugin --profile web add github:owner/repository#${'a'.repeat(40)}`,
      },
      error: 'host failed',
    })).resolves.toBe('session-new')

    expect(sessions.create).toHaveBeenCalledWith({})
    expect(sessions.open).toHaveBeenCalledWith('session-new')
    expect(prompt).toHaveBeenCalledWith([
      { type: 'text', text: expect.stringContaining(`github:owner/repository#${'a'.repeat(40)}`) },
    ], 'queue')
  })

  it('uses a session id returned by the workspace fallback when available', async () => {
    const prompt = vi.fn().mockResolvedValue({ ok: true })
    const sessions = {
      open: vi.fn(),
      binding: vi.fn().mockReturnValue({ session: { prompt } }),
    }
    const workspaces = {
      startSession: vi.fn().mockResolvedValue('session-from-workspace'),
    }

    await expect(sendInstallFailureToAgent({
      sessions,
      workspaces,
      fullName: 'owner/repository',
      install: { source: 'github', target: 'owner/repository' },
      error: 'host failed',
    })).resolves.toBe('session-from-workspace')

    expect(sessions.open).toHaveBeenCalledWith('session-from-workspace')
    expect(prompt).toHaveBeenCalled()
  })
})
