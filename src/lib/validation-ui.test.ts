import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const cardSource = readFileSync(fileURLToPath(new URL('../components/ProjectCard.astro', import.meta.url)), 'utf8')
const indexSource = readFileSync(fileURLToPath(new URL('../pages/index.astro', import.meta.url)), 'utf8')
const detailSource = readFileSync(fileURLToPath(new URL('../pages/plugins/[id].astro', import.meta.url)), 'utf8')

describe('validation ladder presentation', () => {
  it('renders the current validation marker on every catalog card', () => {
    expect(cardSource).toContain('data-validation-status')
    expect(cardSource).toContain('data-field="validation-label"')
    expect(cardSource).toContain('repository.validation.label')
  })

  it('offers a validation status filter and updates cloned cards from catalog data', () => {
    expect(indexSource).toContain('id="validation-filter"')
    expect(indexSource).toContain('serializedValidationStatuses')
    expect(indexSource).toContain("repository.validation.overall")
    expect(indexSource).toContain("'[data-field=\"validation-label\"]'")
  })

  it('shows all four evidence stages and links reports or issues on the detail page', () => {
    expect(detailSource).toContain('validation-ladder')
    expect(detailSource).toContain('VALIDATION_STAGE_DEFINITIONS')
    expect(detailSource).toContain('repository.validation.reportUrl')
    expect(detailSource).toContain('repository.validation.issueUrl')
  })

  it('renders a distinct quarantined stage instead of the failed-stage treatment', () => {
    expect(cardSource).toContain("data-status='quarantined'")
    expect(detailSource).toContain("data-status='quarantined'")
    expect(detailSource).toContain("quarantined: '安全复核'")
  })
})
