import { describe, expect, it } from 'vitest'

import {
  SOURCE_CLASSIFIER_VERSION,
  classifySource,
  parseSourceClassification,
} from './source-classification'

const sourceSha = 'a'.repeat(40)

describe('source classification', () => {
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
      projectType: 'plugin',
      confidence: 'high',
    })
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
      projectType: 'unknown',
      category: 'other',
      confidence: 'low',
      matchedSignals: [],
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
