import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const readSource = (relativePath: string) => readFileSync(
  fileURLToPath(new URL(relativePath, import.meta.url)),
  'utf8',
)

const layoutSource = readSource('../layouts/BaseLayout.astro')
const homepageSource = readSource('../pages/index.astro')
const cardSource = readSource('../components/ProjectCard.astro')
const detailSource = readSource('../pages/plugins/[id].astro')
const topicSource = readSource('../pages/topics/[topic].astro')

describe('site language controls', () => {
  it('places plain-text language buttons in the footer and removes the Topic button', () => {
    const headerSource = layoutSource.match(/<header[\s\S]*?<\/header>/)?.[0] ?? ''
    const footerSource = layoutSource.match(/<footer[\s\S]*?<\/footer>/)?.[0] ?? ''

    expect(headerSource).not.toContain('language-switcher')
    expect(footerSource).toContain('class="site-footer__language language-switcher"')
    expect(footerSource).toMatch(/data-locale="zh-CN"[^>]*>中文<\/button>/)
    expect(footerSource).toMatch(/data-locale="en"[^>]*>English<\/button>/)
    expect(footerSource).toMatch(/data-locale="ja"[^>]*>日本語<\/button>/)
    expect(layoutSource).not.toContain('language-option__glyph')
    expect(layoutSource).toMatch(/\.language-option \{[^}]*border: 0;[^}]*background: transparent;/s)
    expect(layoutSource).not.toContain('<select id="site-language"')
    expect(layoutSource).not.toContain('https://github.com/topics/dsh-plugin')
  })

  it('persists language choice and exposes one translator to dynamic page scripts', () => {
    expect(layoutSource).toContain("localStorage.setItem(LOCALE_STORAGE_KEY")
    expect(layoutSource).toContain('window.dshI18n')
    expect(homepageSource).toContain('window.dshI18n')
    expect(detailSource).toContain('window.dshI18n')
  })

  it('marks every user-facing page surface for translation', () => {
    for (const source of [layoutSource, homepageSource, cardSource, detailSource, topicSource]) {
      expect(source).toContain('data-i18n')
    }
  })

  it('keeps catalog update values on one line across locales', () => {
    expect(homepageSource).toMatch(/\.catalog-stats dd \{[^}]*white-space: nowrap/s)
  })
})
