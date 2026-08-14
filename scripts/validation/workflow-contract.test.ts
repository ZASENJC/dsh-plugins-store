import { readFile } from 'node:fs/promises'

import { describe, expect, it } from 'vitest'

describe('P1 validation workflow safety contract', () => {
  it('runs sharded shadow validation and uploads reports without publishing or opening Issues', async () => {
    const workflow = await readFile('.github/workflows/validate-plugins.yml', 'utf8')

    expect(workflow).toContain('validate:shadow')
    expect(workflow).toContain('upload-artifact')
    expect(workflow).toContain('contents: read')
    expect(workflow).toContain('max-parallel: 4')
    expect(workflow).not.toMatch(/issues:\s*write/)
    expect(workflow).not.toMatch(/git\s+(add|commit|push)/)
    expect(workflow).not.toContain('src/data/validation.json')
  })
})
