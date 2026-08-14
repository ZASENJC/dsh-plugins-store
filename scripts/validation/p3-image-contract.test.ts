import { readFile } from 'node:fs/promises'

import { describe, expect, it } from 'vitest'

describe('P3 browser and mock image contract', () => {
  it('pins Playwright and copies only trusted local validator scripts', async () => {
    const dockerfile = await readFile('validation/sandbox/Dockerfile.web', 'utf8')

    expect(dockerfile).toContain('mcr.microsoft.com/playwright:v1.55.0-noble')
    expect(dockerfile).toContain('@deepseek-ai/dsh@0.1.0-rc.6')
    expect(dockerfile).toContain('playwright@1.55.0')
    expect(dockerfile).toContain('ws@8.18.3')
    expect(dockerfile).toMatch(/USER pwuser\s*$/m)
  })

  it('uses condition-based browser waits and loopback-only mocks', async () => {
    const [web, channel, uninstall] = await Promise.all([
      readFile('validation/sandbox/web-smoke.mjs', 'utf8'),
      readFile('validation/sandbox/channel-mock-smoke.mjs', 'utf8'),
      readFile('validation/sandbox/verify-uninstall.mjs', 'utf8'),
    ])

    expect(web).toContain('waitForLoadState')
    expect(web).not.toContain('waitForTimeout')
    expect(web).toContain("consoleErrors")
    expect(channel).toContain('127.0.0.1')
    expect(channel).toContain('WebSocketServer')
    expect(uninstall).toContain('dsh.profile.bundles')
    expect(`${web}${channel}${uninstall}`).not.toMatch(/api\.example\.com|process\.env\.(TOKEN|SECRET|KEY)/)
  })
})
