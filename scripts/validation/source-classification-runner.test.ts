import { describe, expect, it } from 'vitest'

import {
  classifySourceSnapshot,
  shouldExcludeSourceClassification,
} from './source-classification-runner'

describe('source classification runner', () => {
  it('classifies from structural files without requiring scanner or runtime output', () => {
    const result = classifySourceSnapshot({
      sourceSha: 'a'.repeat(40),
      files: {
        'package.json': JSON.stringify({ dsh: { bundle: { patch: './src/index.ts' } } }),
        'src/index.ts': '',
      },
    })

    expect(result.projectType).toBe('plugin')
    expect(result.confidence).toBe('high')
    expect(result.matchedSignals).toContain('package.json:dsh.bundle.patch')
    expect(shouldExcludeSourceClassification(result)).toBe(false)
  })

  it('marks high-confidence applications, infrastructure, and directories as excluded', () => {
    expect(shouldExcludeSourceClassification({
      sourceSha: 'b'.repeat(40),
      classifierVersion: '0.1.0',
      projectType: 'application',
      category: 'development',
      categories: ['development'],
      matchedSignals: ['package.json:application'],
      confidence: 'high',
    })).toBe(true)
  })
})
