import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { measurePublishTree } from './verify-dist-budget'

describe('verify dist budget', () => {
  it('measures files and uncompressed bytes in a publish tree', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-publish-budget-'))
    await mkdir(join(root, 'plugins'), { recursive: true })
    await writeFile(join(root, 'index.html'), 'home')
    await writeFile(join(root, 'plugins', '1.html'), 'plugin')

    expect(await measurePublishTree(root)).toEqual({
      files: 2,
      uncompressedBytes: 4 + 6,
    })
  })
})
