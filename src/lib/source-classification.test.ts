import { describe, expect, it } from 'vitest'

import {
  SOURCE_CLASSIFIER_VERSION,
  classifySource,
  parseSourceClassification,
} from './source-classification'

const sourceSha = 'a'.repeat(40)

describe('source classification', () => {
  it('uses the current repository-name-aware classifier binding', () => {
    expect(SOURCE_CLASSIFIER_VERSION).toBe('0.2.1')
  })

  it('recognizes a DSH bundle from audited structure files', () => {
    const result = classifySource({
      sourceSha,
      files: {
        'package.json': JSON.stringify({
          name: '@fixture/dsh-tool',
          main: './lib/index.js',
          dsh: { bundle: { patch: './cordis.patch.yml' } },
        }),
        'cordis.patch.yml': '- insert:\n    - id: fixture\n',
        'lib/index.js': undefined,
      },
    })

    expect(result).toMatchObject({
      classifierVersion: SOURCE_CLASSIFIER_VERSION,
      sourceSha,
      dshRelevance: 'recognized',
      projectType: 'plugin',
      typeConfidence: 'high',
      confidence: 'high',
    })
    expect(result.relevanceSignals).toEqual([
      'package.json:dsh.bundle.patch',
      'cordis.patch.yml:parsed',
    ])
    expect(result.matchedSignals).toEqual(expect.arrayContaining([
      'package.json:dsh.bundle.patch',
      'cordis.patch.yml',
    ]))
  })

  it('recognizes skills, collections, and documentation-only directories', () => {
    expect(classifySource({
      sourceSha,
      files: { 'SKILL.md': '# Security audit\n' },
    }).projectType).toBe('skill')

    expect(classifySource({
      sourceSha,
      files: {
        'package.json': JSON.stringify({ workspaces: ['packages/*'] }),
        'packages/one/package.json': '{}',
        'packages/two/package.json': '{}',
      },
    }).projectType).toBe('collection')

    expect(classifySource({
      sourceSha,
      files: { README: undefined, 'LICENSE': undefined },
    }).projectType).toBe('directory')
  })

  it('derives expanded category signals from audited manifests and paths', () => {
    const result = classifySource({
      sourceSha,
      files: {
        'package.json': JSON.stringify({
          name: '@fixture/dsh-mcp-gateway',
          dependencies: {
            '@modelcontextprotocol/sdk': '^1.0.0',
            'openid-client': '^6.0.0',
          },
        }),
        'src/webhook/authentication.ts': undefined,
      },
    })

    expect(result.categories).toEqual(expect.arrayContaining(['model-mcp', 'security', 'communication']))
    expect(result.matchedSignals).toEqual(expect.arrayContaining([
      'model-mcp',
      'security',
      'communication',
    ]))
  })

  it('does not manufacture a source classification without structural evidence', () => {
    expect(classifySource({ sourceSha, files: {} })).toMatchObject({
      dshRelevance: 'unrecognized',
      projectType: 'unknown',
      category: 'other',
      typeConfidence: 'low',
      categoryConfidence: 'low',
      confidence: 'low',
      matchedSignals: [],
    })
  })

  it('does not admit the reported static-site false positive from filenames alone', () => {
    const result = classifySource({
      sourceSha,
      files: {
        'robots.txt': 'User-agent: *\nAllow: /\n',
        'og-image.jpg': undefined,
        'index.html': '<a href="https://dshmk.com/">DSH plugins</a>',
        'README.md': '# DSH plugin recommendation\n',
      },
    })

    expect(result).toMatchObject({
      dshRelevance: 'unrecognized',
      relevanceSignals: [],
      projectType: 'unknown',
      typeConfidence: 'low',
    })
    expect(result.categoryConfidence).not.toBe('high')
  })

  it.each([
    'dsh-plugin',
    'DSH-Theme',
  ])('admits the case-insensitive dsh- repository name prefix without a source contract: %s', (repositoryName) => {
    const result = classifySource({
      sourceSha,
      repositoryFullName: `fixture/${repositoryName}`,
      files: {
        'README.md': '# Community plugin\n',
      },
    })

    expect(result).toMatchObject({
      dshRelevance: 'recognized',
      relevanceSignals: [`repository-name:${repositoryName.toLowerCase()}`],
      projectType: 'plugin',
      typeConfidence: 'high',
    })
  })

  it.each([
    'fixture/dsh',
    'fixture/dshplugin',
    'fixture/not-dsh-plugin',
    'dsh-owner/plugin',
  ])('requires dsh- at the beginning of the repository name segment: %s', (repositoryFullName) => {
    expect(classifySource({
      sourceSha,
      repositoryFullName,
      files: {},
    })).toMatchObject({
      dshRelevance: 'unrecognized',
      relevanceSignals: [],
    })
  })

  it('recognizes a safe custom DSH patch path from the fixed-SHA snapshot', () => {
    const result = classifySource({
      sourceSha,
      files: {
        'package.json': JSON.stringify({
          name: '@fixture/custom-patch',
          dsh: { bundle: { patch: 'config/cordis.bundle.yml' } },
        }),
        'config/cordis.bundle.yml': '- insert: []\n',
      },
    })

    expect(result).toMatchObject({
      dshRelevance: 'recognized',
      relevanceSignals: [
        'package.json:dsh.bundle.patch',
        'config/cordis.bundle.yml:parsed',
      ],
      projectType: 'plugin',
    })
  })

  it.each([
    ['missing patch', './missing.yml', undefined],
    ['unsafe patch', '../outside.yml', '- insert: []\n'],
    ['invalid YAML patch', './broken.yml', 'not: [a, patch, list]\n'],
  ])('rejects a DSH manifest with a %s', (_label, patch, content) => {
    expect(classifySource({
      sourceSha,
      files: {
        'package.json': JSON.stringify({ dsh: { bundle: { patch } } }),
        ...(content === undefined ? {} : { [patch.replace(/^\.\//, '')]: content }),
      },
    })).toMatchObject({
      dshRelevance: 'unrecognized',
      relevanceSignals: [],
    })
  })

  it('rejects a source classification with an invalid binding', () => {
    expect(() => parseSourceClassification({
      sourceSha: 'not-a-sha',
      classifierVersion: SOURCE_CLASSIFIER_VERSION,
      projectType: 'plugin',
      category: 'development',
      categories: ['development'],
      matchedSignals: ['cordis.patch.yml'],
      confidence: 'high',
    })).toThrow()
  })
})
