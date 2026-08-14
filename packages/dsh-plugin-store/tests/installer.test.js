import { describe, expect, it, vi } from 'vitest'

import { installRepository } from '../src/installer.js'

describe('host-side repository installation', () => {
  it('uses the DSH launcher with fixed argv and never constructs a shell command', async () => {
    const runner = vi.fn().mockResolvedValue({
      stdout: 'installed',
      stderr: '',
    })
    const signal = new AbortController().signal

    const result = await installRepository('owner/repository', {
      runner,
      execPath: '/usr/bin/node',
      cliPath: '/opt/dsh/bin.js',
      signal,
    })

    expect(runner).toHaveBeenCalledWith('/usr/bin/node', [
      '/opt/dsh/bin.js',
      'plugin',
      '--profile',
      'web',
      'add',
      'github:owner/repository',
    ], signal)
    expect(result).toEqual({ output: 'installed' })
  })

  it.each([
    '',
    'owner',
    'owner/repo/extra',
    'owner/repo; touch unsafe',
    '../owner/repo',
  ])('rejects an unsafe repository name before invoking the runner: %s', async (fullName) => {
    const runner = vi.fn()

    await expect(installRepository(fullName, {
      runner,
      execPath: '/usr/bin/node',
      cliPath: '/opt/dsh/bin.js',
      signal: new AbortController().signal,
    })).rejects.toThrow('仓库名称无效')
    expect(runner).not.toHaveBeenCalled()
  })
})
