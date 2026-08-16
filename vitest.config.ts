import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: [
        'src/lib/classification.ts',
        'src/lib/catalog.ts',
        'src/lib/github-content.ts',
        'src/lib/hero-motion.ts',
        'src/lib/readme.ts',
        'src/lib/seo.ts',
        'packages/dsh-plugins-store/src/catalog.js',
        'packages/dsh-plugins-store/src/controller.js',
        'packages/dsh-plugins-store/src/index.js',
        'packages/dsh-plugins-store/src/installer.js',
      ],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  },
})
