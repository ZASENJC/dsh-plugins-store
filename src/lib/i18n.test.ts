import { describe, expect, it } from 'vitest'

import {
  DEFAULT_LOCALE,
  dictionaries,
  formatMessage,
  getTranslation,
  resolveLocale,
  SUPPORTED_LOCALES,
} from './i18n'

describe('site internationalization', () => {
  it('supports Chinese, English, and Japanese with Chinese as the fallback', () => {
    expect(SUPPORTED_LOCALES).toEqual(['zh-CN', 'en', 'ja'])
    expect(DEFAULT_LOCALE).toBe('zh-CN')
    expect(resolveLocale('en-US')).toBe('en')
    expect(resolveLocale('ja-JP')).toBe('ja')
    expect(resolveLocale('fr-FR')).toBe('zh-CN')
  })

  it('keeps every locale on the same complete translation contract', () => {
    const expectedKeys = Object.keys(dictionaries['zh-CN']).sort()

    expect(Object.keys(dictionaries.en).sort()).toEqual(expectedKeys)
    expect(Object.keys(dictionaries.ja).sort()).toEqual(expectedKeys)
  })

  it('translates the site brand while preserving Store in English', () => {
    expect(getTranslation('zh-CN', 'site.brand')).toBe('DeepSeek-Harness 插件市场')
    expect(getTranslation('en', 'site.brand')).toBe('DeepSeek-Harness Plugin Store')
    expect(getTranslation('ja', 'site.brand')).toBe('DeepSeek-Harness プラグインストア')
  })

  it('keeps synchronization and validation in the homepage message across locales', () => {
    expect(getTranslation('zh-CN', 'home.heroLine1')).toBe('每 30 分钟自动同步并验证 GitHub 社区项目。')
    expect(getTranslation('en', 'home.heroLine1')).toContain('synchronized and validated')
    expect(getTranslation('ja', 'home.heroLine1')).toContain('自動同期・検証')
  })

  it('formats dynamic project names and counts without changing repository data', () => {
    expect(formatMessage('View {name} details', { name: 'dsh-tui' })).toBe('View dsh-tui details')
    expect(formatMessage('{count} projects', { count: 24 })).toBe('24 projects')
  })
})
