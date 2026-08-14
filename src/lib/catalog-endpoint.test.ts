import { describe, expect, it } from 'vitest'

import { GET } from '../pages/catalog.json'

describe('public catalog endpoint', () => {
  it('publishes the same classified catalog for browser plugins without credentials', async () => {
    const response = GET()
    const catalog = await response.json()

    expect(response.headers.get('content-type')).toContain('application/json')
    expect(response.headers.get('access-control-allow-origin')).toBe('*')
    expect(catalog).toMatchObject({
      schemaVersion: 1,
      source: { topic: 'dsh-plugin' },
    })
    expect(catalog.repositories.length).toBeGreaterThan(0)
    expect(JSON.stringify(catalog)).not.toMatch(/github_token|gh_token/i)
  })
})
