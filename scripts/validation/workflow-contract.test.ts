import { readFile } from 'node:fs/promises'

import { describe, expect, it } from 'vitest'

import { CURRENT_VALIDATION_TARGET } from '../../src/lib/validation'

describe('decoupled incremental validation workflows', () => {
  it('keeps classification as an independent upstream workflow', async () => {
    const classificationWorkflow = await readFile('.github/workflows/classify-plugins.yml', 'utf8')

    expect(classificationWorkflow).toContain('name: Classify plugins')
    expect(classificationWorkflow).toContain("cron: '10 * * * *'")
    expect(classificationWorkflow).toMatch(/force_full:[\s\S]*type: boolean/)
    expect(classificationWorkflow).toContain('validate:classify')
    expect(classificationWorkflow).toContain('--mode plan')
    expect(classificationWorkflow).toContain('--mode run')
    expect(classificationWorkflow).toContain('--mode aggregate')
    expect(classificationWorkflow).toContain('plugin-classification-state')
    expect(classificationWorkflow).toContain('validation-catalog.json')
    expect(classificationWorkflow).toContain('validation-state/discovery.json')
    expect(classificationWorkflow).toContain('gh run list --workflow sync-catalog.yml')
    expect(classificationWorkflow).toContain('plugin-discovery-snapshot')
    expect(classificationWorkflow).toMatch(/classify:[\s\S]*?env:\s*\n\s+GH_TOKEN: \$\{\{ secrets\.GITHUB_TOKEN \}\}/)
    expect(classificationWorkflow).not.toContain('validate:candidates')
    expect(classificationWorkflow).not.toContain('DEPLOY_SSH_KEY')
    expect(classificationWorkflow).not.toMatch(/\bssh\b/)
  })

  it('refreshes catalog after any completed validation without depending on validation internals', async () => {
    const syncWorkflow = await readFile('.github/workflows/sync-catalog.yml', 'utf8')

    expect(syncWorkflow).toContain('workflow_run:')
    expect(syncWorkflow).toContain('workflows: [Validate plugins]')
    expect(syncWorkflow).toContain("github.event.workflow_run.conclusion != ''")
    expect(syncWorkflow).not.toContain("github.event.workflow_run.conclusion == 'success'")
    expect(syncWorkflow).toContain('plugin-catalog-snapshot')
    expect(syncWorkflow).toContain('plugin-discovery-snapshot')
    expect(syncWorkflow).toContain('plugin-classification-state')
    expect(syncWorkflow).toContain('CLASSIFICATION_ARCHIVE_PATH')
    expect(syncWorkflow).toContain('plugin-validation-state')
    expect(syncWorkflow).toContain('gh run view "$run_id"')
    expect(syncWorkflow).toContain('metadata.conclusion === "success"')
    expect(syncWorkflow).toContain('Retry archive download')
    expect(syncWorkflow).toContain('sleep 10')
    expect(syncWorkflow).toContain('dist/catalog.json')
    expect(syncWorkflow).toContain('validationStatuses')
    expect(syncWorkflow).toContain('Persist source classification archive')
    expect(syncWorkflow).toContain('contents: write')
    expect(syncWorkflow).toContain('git worktree add --detach')
    expect(syncWorkflow).toContain("commit -m 'chore: persist source classification archive'")
    expect(syncWorkflow).toContain('push origin "HEAD:$BRANCH"')
    expect(syncWorkflow).not.toContain('contents/src/data/source-classification.json')
    expect(syncWorkflow).toMatch(/Persist source classification archive[\s\S]*Sync GitHub Topic/)
    expect(syncWorkflow).toContain('git show "origin/$VALIDATION_BRANCH:src/data/source-classification.json"')
    expect(syncWorkflow).toContain('archive_is_newer_or_equal')
    expect(syncWorkflow).not.toContain('rm -f src/data/source-classification.json')
    expect(syncWorkflow).not.toContain('Restore last successful validation feed')
    expect(syncWorkflow).not.toContain('validation-restore')
    expect(syncWorkflow).not.toContain('npm run validate:artifact')
    expect(syncWorkflow).not.toContain('src/data/validation.json')
    expect(syncWorkflow).toContain('src/data/catalog.json')
    expect(syncWorkflow).not.toContain('validate:candidates')
    expect(syncWorkflow).not.toMatch(/needs:\s+.*validat/)
    expect(syncWorkflow).toContain('DEPLOY_SSH_KEY')
    expect(syncWorkflow).toContain('--workflow classify-plugins.yml')
  })

  it('runs chained validation from the classified catalog without deployment credentials', async () => {
    const workflow = await readFile('.github/workflows/validate-plugins.yml', 'utf8')

    expect(workflow).toContain('workflow_run:')
    expect(workflow).toContain('workflows: [Classify plugins]')
    expect(workflow).toContain("github.event.workflow_run.conclusion != 'success'")
    expect(workflow).toMatch(/force_full:[\s\S]*type: boolean/)
    expect(workflow).toContain('FORCE_FULL')
    expect(workflow).toMatch(/test "\$FORCE_FULL" != "true"[\s\S]*--previous/)
    expect(workflow).toMatch(/classification_mode=.*source-classification\.json[\s\S]*test "\$FORCE_FULL" != "true" && test "\$classification_mode" != "full"[\s\S]*--previous/)
    expect(workflow).toContain('classify-plugins.yml')
    expect(workflow).toContain('plugin-classification-state')
    expect(workflow).toContain('validation-catalog.json')
    expect(workflow).toContain('validate:select')
    expect(workflow).toContain('source-classification.json')
    expect(workflow).toContain('validate:input')
    expect(workflow).toContain('/tmp/dsh-validation-history')
    expect(workflow).toContain('--validation-history-directory /tmp/dsh-validation-history')
    expect(workflow).toContain('test -f "$artifact_dir/source-classification.json"')
    expect(workflow).toContain('validation-input/discovery.json')
    expect(workflow).toContain('if: always()')
    expect(workflow).toContain('validate:shadow')
    expect(workflow).toContain('validate:candidates')
    expect(workflow).toContain('validate:archive')
    expect(workflow).toContain('validation-archive:')
    expect(workflow).toContain('--discovery validation-input/discovery.json')
    expect(workflow).toContain('--summary validation-state/validation-summary.json')
    expect(workflow).toContain('--selection')
    expect(workflow).toMatch(/validate:select --[\s\S]*--previous-feed validation-input\/previous-validation\.json[\s\S]*--output validation-input\/selection\.json/)
    expect(workflow).toContain('upload-artifact')
    expect(workflow).toContain('plugin-validation-state')
    expect(workflow).toContain('contents: read')
    expect(workflow).toContain('max-parallel: 6')
    expect(workflow).toContain('VALIDATION_STRUCTURE_CONCURRENCY: 2')
    expect(workflow).toContain('VALIDATION_CANDIDATE_CONCURRENCY: 2')
    expect(workflow).toContain('group: plugin-validation-publication')
    expect(workflow).toContain('fromJSON(needs.select.outputs.shards)')
    expect(workflow).toContain("needs.select.outputs.first_run == 'true'")
    expect(workflow).toContain('result.reportsWritten !== result.discovered')
    expect(workflow).toContain('tee /tmp/shadow-summary.json')
    expect(workflow).toContain('npm run validate:promote --')
    expect(workflow).toContain('--gate-reports')
    expect(workflow).toContain('--previous-feed')
    expect(workflow).toContain('--publish')
    expect(workflow).toMatch(/- name: Upload current canary reports\s+if: always\(\)\s+uses: actions\/upload-artifact@v6/)
    expect(workflow).not.toMatch(/issues:\s*write/)
    expect(workflow).not.toMatch(/git\s+(add|commit|push)/)
    expect(workflow).not.toContain('DEPLOY_SSH_KEY')
    expect(workflow).not.toMatch(/\bssh\b/)
    expect(workflow).not.toContain('validate:classify')
    expect(workflow).not.toMatch(/^  (classify|classification-archive):/m)
  })

  it('defines the three pipeline workflow entrypoints', async () => {
    const workflowNames = [
      '.github/workflows/classify-plugins.yml',
      '.github/workflows/validate-plugins.yml',
      '.github/workflows/sync-catalog.yml',
    ]
    const workflows = await Promise.all(workflowNames.map((path) => readFile(path, 'utf8')))
    expect(workflows.map((workflow) => workflow.match(/^name: (.+)$/m)?.[1])).toEqual([
      'Classify plugins',
      'Validate plugins',
      'Sync catalog',
    ])
  })

  it('keeps the automatic workflow and baseline on the current validator binding', async () => {
    const [workflow, baseline] = await Promise.all([
      readFile('.github/workflows/validate-plugins.yml', 'utf8'),
      readFile('validation/baseline.json', 'utf8').then(JSON.parse),
    ])

    expect(CURRENT_VALIDATION_TARGET.validatorVersion).toBe('0.1.2')
    expect(baseline).toMatchObject(CURRENT_VALIDATION_TARGET)
    expect(workflow).toContain(`DSH_VALIDATION_VERSION: ${CURRENT_VALIDATION_TARGET.dshVersion}`)
    expect(workflow).toContain(`VALIDATOR_VERSION: ${CURRENT_VALIDATION_TARGET.validatorVersion}`)
  })
})
