interface DshI18nApi {
  readonly locale: 'zh-CN' | 'en' | 'ja'
  t: (key: string, params?: Record<string, string | number>) => string
  translate: (root?: ParentNode) => void
  relativeDate: (value: string) => string
  absoluteDate: (value: string, includeTime?: boolean) => string
  setLocale: (locale: string, persist?: boolean) => void
}

interface Window {
  dshI18n?: DshI18nApi
}
