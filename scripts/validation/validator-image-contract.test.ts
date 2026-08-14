import { readFile } from 'node:fs/promises'

import { describe, expect, it } from 'vitest'

describe('P2 validator image contract', () => {
  it('pins the runtime toolchain and executes validation as the node user', async () => {
    const [dockerfile, toolchainManifest, toolchainLock] = await Promise.all([
      readFile('validation/sandbox/Dockerfile', 'utf8'),
      readFile('validation/sandbox/toolchain/package.json', 'utf8').then(JSON.parse),
      readFile('validation/sandbox/toolchain/package-lock.json', 'utf8').then(JSON.parse),
    ])

    expect(dockerfile).toContain('FROM node:22.22.0-bookworm-slim')
    expect(dockerfile).toContain('npm ci --prefix /validator/toolchain --omit=dev --ignore-scripts')
    expect(dockerfile).toContain('ENV PATH="/validator/toolchain/node_modules/.bin:${PATH}"')
    expect(dockerfile).not.toContain('npm install --global')
    expect(toolchainManifest).toMatchObject({
      dependencies: {
        '@deepseek-ai/dsh': '0.1.0-rc.6',
        pnpm: '11.19.0',
      },
      overrides: {
        '@aws-sdk/credential-provider-node': '3.972.79',
        '@aws-sdk/credential-provider-ini': '3.973.13',
      },
    })
    expect(toolchainLock.lockfileVersion).toBe(3)
    expect(toolchainLock.packages[''].dependencies).toEqual(toolchainManifest.dependencies)
    expect(toolchainLock.packages['node_modules/@aws-sdk/credential-provider-node'].version).toBe('3.972.79')
    expect(toolchainLock.packages[
      'node_modules/@aws-sdk/credential-provider-node/node_modules/@aws-sdk/credential-provider-ini'
    ].version).toBe('3.973.13')
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
    expect(smoke).toMatch(/if \(smokeMode === 'tool-registration'\) \{\s*await apply\(context, \{\}\)/)
    expect(postflight).toContain('/proc/net')
    expect(postflight).toContain("entry.isDirectory() && entry.name !== 'node_modules'")
    expect(`${copySource}${smoke}${postflight}`).not.toMatch(/https?:\/\//)
  })
})
