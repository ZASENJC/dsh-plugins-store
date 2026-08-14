import sitemap from '@astrojs/sitemap'
import { defineConfig } from 'astro/config'

import { SITE_URL } from './src/lib/seo.ts'

export default defineConfig({
  base: process.env.SITE_BASE || '/',
  site: SITE_URL,
  output: 'static',
  trailingSlash: 'never',
  integrations: [sitemap()],
})
