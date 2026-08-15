import { describe, expect, it } from 'vitest'

import {
  buildHomepageStructuredData,
  getCanonicalUrl,
  HOME_DESCRIPTION,
  HOME_TITLE,
  serializeJsonLd,
} from './seo'

describe('canonical URLs', () => {
  it('uses the production origin and removes query strings and fragments', () => {
    expect(
      getCanonicalUrl(new URL('http://localhost:4321/plugins/1333111893?sort=stars#readme')),
    ).toBe('https://dsh.aitreez.com/plugins/1333111893')
  })

  it('keeps the root slash while removing trailing slashes from content pages', () => {
    expect(getCanonicalUrl(new URL('http://localhost:4321/'))).toBe('https://dsh.aitreez.com/')
    expect(getCanonicalUrl(new URL('http://localhost:4321/topics/dsh-plugin/'))).toBe(
      'https://dsh.aitreez.com/topics/dsh-plugin',
    )
  })
})

describe('homepage search intent', () => {
  it('uses the requested DSH plugin market name as the homepage title', () => {
    expect(HOME_TITLE).toBe('DSH 插件市场 - DSH-Plugin Store')
    expect(HOME_DESCRIPTION).toContain('DSH 插件市场')
    expect(HOME_DESCRIPTION).toContain('DeepSeek Harness 插件市场')
  })

  it('describes the homepage as a searchable plugin collection without overstating verification', () => {
    const data = buildHomepageStructuredData(830)
    const graph = data['@graph']

    expect(graph).toEqual(expect.arrayContaining([
      expect.objectContaining({
        '@type': 'WebSite',
        name: 'DSH 插件市场',
        alternateName: expect.arrayContaining([
          'DSH 市场',
          'DeepSeek Harness 插件市场',
          'DeepSeekHarness 插件市场',
        ]),
      }),
      expect.objectContaining({
        '@type': 'CollectionPage',
        mainEntity: expect.objectContaining({
          '@type': 'ItemList',
          numberOfItems: 830,
        }),
      }),
    ]))
  })

  it('serializes JSON-LD without allowing script-tag injection', () => {
    expect(serializeJsonLd({ description: '</script><script>alert(1)</script>' }))
      .not.toContain('</script>')
  })
})
