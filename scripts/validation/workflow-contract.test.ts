import { readFile } from 'node:fs/promises'

import { describe, expect, it } from 'vitest'

describe('bounded full-chain validation workflow', () => {
  it('keeps catalog discovery separate and passes an immutable snapshot to validation', async () => {
    const syncWorkflow = await readFile('.github/workflows/sync-catalog.yml', 'utf8')

    expect(syncWorkflow).toContain('plugin-catalog-snapshot')
    expect(syncWorkflow).toContain('src/data/catalog.json')
    expect(syncWorkflow).not.toContain('validate:candidates')
  })

  it('runs a serial canary before four-way sharded candidates and isolates deployment credentials', async () => {
    const workflow = await readFile('.github/workflows/validate-plugins.yml', 'utf8')

    expect(workflow).toContain('validate:shadow')
    expect(workflow).toContain('validate:candidates')
    expect(workflow).toContain('workflow_run')
    expect(workflow).toContain('upload-artifact')
    expect(workflow).toContain('contents: read')
    expect(workflow).toContain('max-parallel: 4')
    expect(workflow).toContain('group: plugin-validation-publication')
    expect(workflow).toContain('shard: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]')
    expect(workflow).toContain('result.reportsWritten !== result.discovered')
    expect(workflow).toMatch(/validate:\n\s+needs: baseline/)
    expect(workflow).toContain('npm run validate:promote --')
    expect(workflow).toContain('--gate-reports')
    expect(workflow).toContain('--publish')
    expect(workflow).not.toMatch(/issues:\s*write/)
    expect(workflow).not.toMatch(/git\s+(add|commit|push)/)

    const publishJob = workflow.indexOf('\n  publish:')
    expect(publishJob).toBeGreaterThan(0)
    expect(workflow.slice(0, publishJob)).not.toContain('DEPLOY_SSH_KEY')
    expect(workflow.slice(publishJob)).toContain('DEPLOY_SSH_KEY')
  })
})
