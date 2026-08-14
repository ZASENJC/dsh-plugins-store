import { readFile } from 'node:fs/promises'

import { describe, expect, it } from 'vitest'

describe('P2 validator image contract', () => {
  it('pins the runtime toolchain and executes validation as the node user', async () => {
    const dockerfile = await readFile('validation/sandbox/Dockerfile', 'utf8')

    expect(dockerfile).toContain('FROM node:22.22.0-bookworm-slim')
    expect(dockerfile).toContain('@deepseek-ai/dsh@0.1.0-rc.6')
    expect(dockerfile).toContain('pnpm@11.19.0')
    expect(dockerfile).toMatch(/USER node\s*$/m)
    expect(dockerfile).not.toMatch(/(ENV|ARG)\s+.*(TOKEN|SECRET|KEY)/i)
  })

  it('ships local smoke and residue checks instead of fetching test code at runtime', async () => {
    const [copySource, smoke, postflight] = await Promise.all([
      readFile('validation/sandbox/copy-source.mjs', 'utf8'),
      readFile('validation/sandbox/host-tool-smoke.mjs', 'utf8'),
      readFile('validation/sandbox/postflight.mjs', 'utf8'),
    ])

    expect(copySource).toContain('cp')
    expect(smoke).toContain('tool-registration')
    expect(postflight).toContain('/proc/net')
    expect(`${copySource}${smoke}${postflight}`).not.toMatch(/https?:\/\//)
  })
})
