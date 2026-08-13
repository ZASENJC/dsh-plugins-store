import { defineConfig } from 'astro/config'

export default defineConfig({
  base: process.env.SITE_BASE || '/',
  output: 'static',
  trailingSlash: 'never',
})
