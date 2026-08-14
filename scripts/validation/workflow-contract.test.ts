import { readFile } from 'node:fs/promises'

import { describe, expect, it } from 'vitest'

describe('decoupled incremental validation workflows', () => {
  it('refreshes catalog every 30 minutes and restores validation state without depending on validation success', async () => {
    const syncWorkflow = await readFile('.github/workflows/sync-catalog.yml', 'utf8')

    expect(syncWorkflow).toContain("cron: '*/30 * * * *'")
    expect(syncWorkflow).toContain('plugin-catalog-snapshot')
    expect(syncWorkflow).toContain('plugin-validation-state')
    expect(syncWorkflow).toMatch(/Restore last successful validation feed[\s\S]*continue-on-error: true/)
    expect(syncWorkflow).toContain('src/data/catalog.json')
    expect(syncWorkflow).not.toContain('validate:candidates')
    expect(syncWorkflow).not.toMatch(/needs:\s+.*validat/)
    expect(syncWorkflow).toContain('DEPLOY_SSH_KEY')
  })

  it('runs hourly full-then-incremental validation without deployment credentials', async () => {
    const workflow = await readFile('.github/workflows/validate-plugins.yml', 'utf8')

    expect(workflow).toContain("cron: '17 * * * *'")
    expect(workflow).not.toContain('workflow_run')
    expect(workflow).toContain('validate:select')
    expect(workflow).toContain('validate:shadow')
    expect(workflow).toContain('validate:candidates')
    expect(workflow).toContain('--selection')
    expect(workflow).toMatch(/validate:select --[\s\S]*--previous-feed validation-input\/previous-validation\.json[\s\S]*--output validation-input\/selection\.json/)
    expect(workflow).toContain('upload-artifact')
    expect(workflow).toContain('plugin-validation-state')
    expect(workflow).toContain('contents: read')
    expect(workflow).toContain('max-parallel: 4')
    expect(workflow).toContain('group: plugin-validation-publication')
    expect(workflow).toContain('fromJSON(needs.prepare.outputs.shards)')
    expect(workflow).toContain("needs.prepare.outputs.first_run == 'true'")
    expect(workflow).toContain('result.reportsWritten !== result.discovered')
    expect(workflow).toContain('tee /tmp/shadow-summary.json')
    expect(workflow).toContain('npm run validate:promote --')
    expect(workflow).toContain('--gate-reports')
    expect(workflow).toContain('--previous-feed')
    expect(workflow).toContain('--publish')
    expect(workflow).toMatch(/- name: Upload current canary reports\s+if: always\(\)\s+uses: actions\/upload-artifact@v4/)
    expect(workflow).not.toMatch(/issues:\s*write/)
    expect(workflow).not.toMatch(/git\s+(add|commit|push)/)
    expect(workflow).not.toContain('DEPLOY_SSH_KEY')
    expect(workflow).not.toMatch(/\bssh\b/)
  })
})
