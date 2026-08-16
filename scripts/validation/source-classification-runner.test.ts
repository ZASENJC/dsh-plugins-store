import { describe, expect, it } from 'vitest'

import {
  classifySourceSnapshot,
  shouldExcludeSourceClassification,
} from './source-classification-runner'

describe('source classification runner', () => {
  it('classifies from structural files without requiring scanner or runtime output', () => {
    const result = classifySourceSnapshot({
      sourceSha: 'a'.repeat(40),
      topics: ['dsh-plugin'],
      files: {
        'package.json': JSON.stringify({ dsh: { bundle: { patch: './config/cordis.yml' } } }),
        'config/cordis.yml': '- insert: []\n',
      },
    })

    expect(result.projectType).toBe('plugin')
    expect(result.dshRelevance).toBe('recognized')
    expect(result.confidence).toBe('high')
    expect(result.matchedSignals).toContain('package.json:dsh.bundle.patch')
    expect(shouldExcludeSourceClassification(result)).toBe(false)
  })

  it('excludes an unrelated static site even when filenames resemble category or channel signals', () => {
    const result = classifySourceSnapshot({
      sourceSha: 'c'.repeat(40),
      topics: ['dsh', 'deepseek-harness'],
      files: {
        'robots.txt': 'User-agent: *\nAllow: /\n',
        'og-image.jpg': undefined,
        'README.md': '# Visit the DSH plugin store\n',
      },
    })

    expect(result.dshRelevance).toBe('unrecognized')
    expect(shouldExcludeSourceClassification(result)).toBe(true)
  })

  it('passes repository Topics into the source relevance decision', () => {
    const result = classifySourceSnapshot({
      sourceSha: 'd'.repeat(40),
      topics: ['DSH-Community'],
      files: {},
    })

    expect(result).toMatchObject({
      dshRelevance: 'recognized',
      relevanceSignals: ['topic:dsh-community'],
      projectType: 'plugin',
    })
    expect(shouldExcludeSourceClassification(result)).toBe(false)
  })

  it('marks high-confidence applications, infrastructure, and directories as excluded', () => {
    expect(shouldExcludeSourceClassification({
      sourceSha: 'b'.repeat(40),
      classifierVersion: '0.1.0',
      dshRelevance: 'unrecognized',
      relevanceSignals: [],
      projectType: 'application',
      category: 'development',
      categories: ['development'],
      matchedSignals: ['package.json:application'],
      typeConfidence: 'high',
      categoryConfidence: 'high',
      confidence: 'high',
    })).toBe(true)
  })
})
