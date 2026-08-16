import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import { parsePromotionOptions, readReports, runPromotionCli, writePromotionOutput } from './promotion-cli'

const emptyFeed = {
  schemaVersion: 1 as const,
  generatedAt: '2026-08-14T14:00:00.000Z',
  records: [],
}

describe('P4 promotion CLI', () => {
  it('defaults to observation-only mode and requires an explicit publish flag', () => {
    expect(parsePromotionOptions([])).toMatchObject({ publish: false })
    expect(parsePromotionOptions([
      '--publish', '--gate-reports', 'canary', '--previous-feed', 'previous.json',
    ])).toMatchObject({
      publish: true,
      gateReportsPath: expect.stringContaining('canary'),
      previousFeedPath: expect.stringContaining('previous.json'),
    })
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

  it('treats a missing report directory as zero observations instead of an infrastructure crash', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-promotion-empty-'))
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

    await expect(runPromotionCli([
      '--reports', join(root, 'missing-reports'),
      '--output', join(root, 'validation.json'),
    ])).resolves.toBeUndefined()
    expect(stdout).toHaveBeenCalledWith(expect.stringContaining('BASELINE_COVERAGE_INSUFFICIENT'))
    stdout.mockRestore()
  })

  it('ignores shard summaries when loading individual validation reports', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-promotion-summary-'))
    const reportDirectory = join(root, 'reports')
    await mkdir(reportDirectory, { recursive: true })
    await writeFile(join(reportDirectory, 'shadow-summary-0.json'), JSON.stringify({
      mode: 'shadow',
      discovered: 1,
      reportsWritten: 0,
      loadFailures: [{ repositoryId: 1, code: 'SNAPSHOT_LOAD_FAILED' }],
    }))

    await expect(readReports(reportDirectory)).resolves.toEqual([])
  })
})
