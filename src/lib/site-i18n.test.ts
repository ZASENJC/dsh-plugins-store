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
  it('places a three-part language capsule beside GitHub and removes the Topic button', () => {
    expect(layoutSource).toContain('class="language-switcher"')
    expect(layoutSource).toContain('class="language-option__glyph"')
    expect(layoutSource).toContain('>中</span>')
    expect(layoutSource).toContain('>A</span>')
    expect(layoutSource).toContain('>あ</span>')
    expect(layoutSource).toContain('data-locale="zh-CN"')
    expect(layoutSource).toContain('data-locale="en"')
    expect(layoutSource).toContain('data-locale="ja"')
    expect(layoutSource).toContain('aria-pressed="true"')
    expect(layoutSource).toMatch(/\.language-switcher \{[^}]*height: 40px/s)
    expect(layoutSource).toMatch(/@media \(max-width: 767px\)[\s\S]*\.language-switcher \{[^}]*height: 44px/)
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
