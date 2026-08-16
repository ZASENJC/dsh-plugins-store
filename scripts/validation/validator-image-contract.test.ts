import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

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
    expect(smoke).toContain("smokeMode = process.argv[3] ?? 'loader'")
    expect(smoke).toContain("smokeMode !== 'loader'")
    expect(smoke).not.toContain('tool-registration')
    expect(smoke).toContain('awaitWithTimeout(apply(context, config), 30_000)')
    expect(postflight).toContain('/proc/net')
    expect(postflight).toContain("entry.isDirectory() && entry.name !== 'node_modules'")
    expect(`${copySource}${smoke}${postflight}`).not.toMatch(/https?:\/\//)
  })

  it('provides nested callable capabilities when invoking a plugin entrypoint', async () => {
    const helperUrl = pathToFileURL(resolve('validation/sandbox/capability-stub.mjs')).href
    const { awaitWithTimeout, createCapabilityStub, resolvePluginConfig } = await import(helperUrl)
    const capability = createCapabilityStub()

    expect(typeof capability.tools.register).toBe('function')
    expect(capability.tools.register({ name: 'fixture' })).toBe(capability)
    expect(capability.logger('fixture')).toBe(capability)
    expect(resolvePluginConfig({
      Config: (value: object) => ({
        ...value,
        answerer: { allowJustifications: [] },
        checkOnStart: true,
      }),
    })).toEqual({ answerer: { allowJustifications: [] }, checkOnStart: false })
    expect(resolvePluginConfig({})).toEqual({})
    await expect(awaitWithTimeout(Promise.resolve('ready'), 1_000)).resolves.toBe('ready')
    await expect(awaitWithTimeout(new Promise(() => {}), 10)).rejects.toThrow('Plugin apply timed out')
  })

  it('smokes the package activated in the DSH profile instead of only the source checkout', async () => {
    const smoke = await readFile('validation/sandbox/host-tool-smoke.mjs', 'utf8')

    expect(smoke).toContain('process.env.DSH_HOME')
    expect(smoke).toContain("'profiles', 'validation'")
    expect(smoke).toContain('profileManifest.dependencies')
    expect(smoke).toContain('profileManifest.dsh?.profile?.bundles')
    expect(smoke).toContain("resolve(profileRoot, 'node_modules')")
    expect(smoke).toContain('resolve(nodeModulesRoot, packageName)')
    expect(smoke).toContain("readFile(resolve(installedRoot, 'package.json')")
    expect(smoke).toContain('pathToFileURL(entrypointReal)')
    expect(smoke).toContain('Plugin entrypoint escapes installed plugin boundary')
    expect(smoke).toContain('invoked: true')
    expect(smoke).not.toContain('pathToFileURL(resolve(pluginRoot, entrypoint))')
  })
})
