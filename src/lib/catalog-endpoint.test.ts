import { describe, expect, it } from 'vitest'

import { GET } from '../pages/catalog.json'

describe('public catalog endpoint', () => {
  it('publishes the same classified catalog for browser plugins without credentials', async () => {
    const response = GET()
    const catalog = await response.json()
    const serializedCatalog = JSON.stringify(catalog)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(response.headers.get('access-control-allow-origin')).toBe('*')
    expect(catalog).toMatchObject({
      schemaVersion: 1,
      source: { topic: 'dsh-plugin' },
    })
    expect(catalog.repositories.length).toBeGreaterThan(0)
    expect(catalog.repositories[0].validation).toMatchObject({
      overall: expect.any(String),
      label: expect.any(String),
      stages: expect.any(Object),
    })
    expect(catalog.stats.validationStatuses).toEqual(expect.any(Object))
    expect(serializedCatalog).not.toMatch(/\b(?:github_pat|gh[pousr])_[A-Za-z0-9_]{20,}\b/i)
  })
})
