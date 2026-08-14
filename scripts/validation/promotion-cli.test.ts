import { access, mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { parsePromotionOptions, writePromotionOutput } from './promotion-cli'

const emptyFeed = {
  schemaVersion: 1 as const,
  generatedAt: '2026-08-14T14:00:00.000Z',
  records: [],
}

describe('P4 promotion CLI', () => {
  it('defaults to observation-only mode and requires an explicit publish flag', () => {
    expect(parsePromotionOptions([])).toMatchObject({ publish: false })
    expect(parsePromotionOptions(['--publish'])).toMatchObject({ publish: true })
  })

  it('does not write public state without publish or when the quality gate is blocked', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-promotion-'))
    const outputPath = join(root, 'validation.json')

    expect(await writePromotionOutput({ outputPath, feed: emptyFeed, publish: false, eligible: true })).toEqual({
      published: false,
    })
    await expect(access(outputPath)).rejects.toThrow()
    await expect(writePromotionOutput({ outputPath, feed: emptyFeed, publish: true, eligible: false }))
      .rejects.toThrow('质量门禁')
    await expect(access(outputPath)).rejects.toThrow()

    await expect(writePromotionOutput({ outputPath, feed: emptyFeed, publish: true, eligible: true }))
      .resolves.toEqual({ published: true })
    expect(JSON.parse(await readFile(outputPath, 'utf8'))).toEqual(emptyFeed)
  })
})
