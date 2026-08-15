import { describe, expect, it } from 'vitest'

import {
  INSTALLED_PLUGIN_LIST_ARGS,
  buildInstalledPluginSnapshot,
  compareCatalogInstallation,
  getInstalledPluginRemoveTarget,
  isUpdateAvailable,
  parseInstalledPluginList,
} from '../src/installed-plugins.js'

describe('local plugin inventory', () => {
  it('normalizes pnpm list JSON into direct profile dependencies', () => {
    const output = JSON.stringify([
      {
        name: 'dsh-profile-web',
        dependencies: {
          'dsh-example': {
            from: 'github:owner/dsh-example',
            version: '1.2.3',
            resolved: 'github:owner/dsh-example#abc123',
            path: '/profile/node_modules/dsh-example',
          },
        },
      },
    ])

    expect(parseInstalledPluginList(output)).toEqual([
      {
        name: 'dsh-example',
        from: 'github:owner/dsh-example',
        version: '1.2.3',
        resolved: 'github:owner/dsh-example#abc123',
      },
    ])
    expect(INSTALLED_PLUGIN_LIST_ARGS).toEqual([
      'plugin', '--profile', 'web', 'list', '--depth=0', '--json',
    ])
  })

  it('rejects malformed list output instead of inventing installed state', () => {
    expect(() => parseInstalledPluginList('{')).toThrow('本地插件清单格式无效')
    expect(parseInstalledPluginList(JSON.stringify([{ name: 'profile' }]))).toEqual([])
  })

  it('matches GitHub and npm catalog candidates to installed dependencies', () => {
    const installed = [
      {
        name: 'dsh-example',
        from: 'github:Owner/dsh-example',
        version: '1.0.0',
        resolved: 'github:Owner/dsh-example#oldsha',
      },
      {
        name: '@scope/search',
        from: '@scope/search@1.0.0',
        version: '1.0.0',
        resolved: 'https://registry.npmjs.org/@scope/search/-/search-1.0.0.tgz',
      },
    ]

    expect(compareCatalogInstallation({
      fullName: 'owner/dsh-example',
      install: { candidate: { source: 'github', target: 'owner/dsh-example' } },
    }, installed)).toMatchObject({ name: 'dsh-example' })
    expect(compareCatalogInstallation({
      fullName: 'scope/search',
      install: { candidate: { source: 'npm', target: '@scope/search' } },
    }, installed)).toMatchObject({ name: '@scope/search' })
  })

  it('marks only a clearly newer pinned source or semver catalog target as updateable', () => {
    const oldGithub = { name: 'dsh-example', from: 'github:owner/dsh-example', resolved: `github:owner/dsh-example#${'a'.repeat(40)}`, version: '1.0.0' }
    expect(isUpdateAvailable({
      validation: { sourceSha: 'b'.repeat(40) },
      install: { candidate: { source: 'github', target: 'owner/dsh-example' } },
    }, oldGithub)).toBe(true)
    expect(isUpdateAvailable({
      validation: { sourceSha: 'a'.repeat(40) },
      install: { candidate: { source: 'github', target: 'owner/dsh-example' } },
    }, oldGithub)).toBe(false)
    expect(isUpdateAvailable({
      validation: { sourceSha: 'a'.repeat(40) },
      install: { candidate: { source: 'github', target: 'owner/dsh-example' } },
    }, { ...oldGithub, resolved: 'github:owner/dsh-example#aaaaaaa' })).toBe(false)
    expect(isUpdateAvailable({
      install: { candidate: { source: 'npm', target: '@scope/search@1.1.0' } },
    }, { name: '@scope/search', version: '1.0.0' })).toBe(true)
    expect(isUpdateAvailable({
      install: { candidate: { source: 'npm', target: '@scope/search' } },
    }, { name: '@scope/search', version: '1.0.0' })).toBe(false)
  })

  it('only exposes a remove target for an installed direct dependency', () => {
    const snapshot = buildInstalledPluginSnapshot([
      { name: 'dsh-example', version: '1.0.0', from: 'github:owner/dsh-example' },
    ])
    expect(getInstalledPluginRemoveTarget(snapshot, 'dsh-example')).toBe('dsh-example')
    expect(getInstalledPluginRemoveTarget(snapshot, 'owner/dsh-example')).toBeNull()
    expect(getInstalledPluginRemoveTarget(snapshot, 'dsh-example;rm -rf /')).toBeNull()
  })
})
