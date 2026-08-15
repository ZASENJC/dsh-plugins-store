export const SITE_URL = 'https://dsh.aitreez.com'
export const HOME_TITLE = 'DSH 插件市场 - DSH-Plugin Store'
export const HOME_DESCRIPTION = '在 DSH 插件市场中搜索和浏览 DSH 插件。本站作为 DeepSeek Harness 插件市场目录，自动收录和分类 GitHub dsh-plugin Topic 项目，并展示 DeepSeek Harness 插件的验证状态与安装参考。'

export function getCanonicalUrl(currentUrl: URL): string {
  const pathname = currentUrl.pathname === '/' ? '/' : currentUrl.pathname.replace(/\/+$/, '')
  return new URL(pathname, SITE_URL).toString()
}

export function buildHomepageStructuredData(numberOfItems: number) {
  const websiteId = `${SITE_URL}/#website`
  const webpageId = `${SITE_URL}/#webpage`

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': websiteId,
        url: `${SITE_URL}/`,
        name: 'DSH 插件市场',
        alternateName: [
          'DSH 市场',
          'DeepSeek Harness 插件市场',
          'DeepSeekHarness 插件市场',
        ],
        description: HOME_DESCRIPTION,
        inLanguage: 'zh-CN',
      },
      {
        '@type': 'CollectionPage',
        '@id': webpageId,
        url: `${SITE_URL}/`,
        name: HOME_TITLE,
        description: HOME_DESCRIPTION,
        inLanguage: 'zh-CN',
        isPartOf: { '@id': websiteId },
        about: {
          '@type': 'SoftwareApplication',
          name: 'DeepSeek Harness',
          applicationCategory: 'DeveloperApplication',
        },
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems,
          itemListOrder: 'https://schema.org/ItemListOrderDescending',
        },
      },
    ],
  }
}

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}
