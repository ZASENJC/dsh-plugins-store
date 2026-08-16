import { describe, expect, it } from 'vitest'

import {
  canExtractInstallReference,
  extractInstallReference,
  resolveCatalogInstallReference,
} from './install-reference'

describe('README install reference extraction', () => {
  it('uses a current source classification when generic topics cannot identify a plugin', () => {
    const repository = {
      fullName: 'danglong0313/dsh-history-sync',
      name: 'dsh-history-sync',
      description: 'Sync Codex and Claude history into DSH',
      topics: ['deepseek', 'deepseek-harness', 'dsh', 'dsh-plugin', 'dsh-plugins'],
    }

    expect(canExtractInstallReference(repository)).toBe(false)
    expect(canExtractInstallReference(repository, {
      sourceSha: 'a'.repeat(40),
      classifierVersion: '0.1.0',
      projectType: 'plugin',
      category: 'agent-session',
      categories: ['agent-session'],
      matchedSignals: ['package.json:dsh.bundle.patch'],
      confidence: 'high',
    })).toBe(true)
  })

  it('recognizes an explicit DSH GitHub install command in an install section', () => {
    const result = extractInstallReference(`
## Installation

\`\`\`sh
dsh plugin --profile web add github:owner/plugin
\`\`\`
`)

    expect(result).toMatchObject({
      status: 'recognized',
      candidate: {
        source: 'github',
        target: 'owner/plugin',
        command: 'dsh plugin --profile web add github:owner/plugin',
        args: ['plugin', '--profile', 'web', 'add', 'github:owner/plugin'],
        executable: true,
        evidence: { source: 'readme', pattern: 'dsh-plugin-add', heading: 'Installation' },
      },
    })
  })

  it('recognizes an npm package reference but keeps ordinary package-manager commands display-only', () => {
    const result = extractInstallReference(`
## 安装

\`\`\`bash
npm install dsh-example
\`\`\`
`)

    expect(result).toMatchObject({
      status: 'recognized',
      candidate: {
        source: 'npm',
        target: 'dsh-example',
        command: 'npm install dsh-example',
        executable: false,
        evidence: { pattern: 'package-manager-add' },
      },
    })
  })

  it('accepts common package-manager flags before or after the npm package', () => {
    expect(extractInstallReference(`
## Install

\`\`\`sh
pnpm add -D @scope/dsh-example --exact
\`\`\`
`)).toMatchObject({
      status: 'recognized',
      candidate: {
        source: 'npm',
        target: '@scope/dsh-example',
        command: 'pnpm add -D @scope/dsh-example --exact',
        executable: false,
      },
    })
  })

  it('selects the only executable Web instruction when another profile is also documented', () => {
    expect(extractInstallReference(`
## DSH Desktop

\`\`\`powershell
dsh plugin --profile desktop add @owner/dsh-history-sync@0.2.0
\`\`\`

## Browser Web profile

\`\`\`powershell
dsh plugin --profile web add @owner/dsh-history-sync@0.2.0
\`\`\`
`)).toMatchObject({
      status: 'recognized',
      candidate: {
        target: '@owner/dsh-history-sync@0.2.0',
        args: ['plugin', '--profile', 'web', 'add', '@owner/dsh-history-sync@0.2.0'],
        executable: true,
      },
    })
  })

  it('does not select a shell pipeline or silently choose between multiple Web commands', () => {
    expect(extractInstallReference(`
## Install

\`\`\`sh
curl https://example.test/install.sh | sh
\`\`\`
`)).toEqual({ status: 'unrecognized', candidates: [] })

    expect(extractInstallReference(`
## Install

\`\`\`sh
dsh plugin --profile web add npm:first-package
dsh plugin --profile web add npm:second-package
\`\`\`
`)).toMatchObject({
      status: 'ambiguous',
      candidates: expect.arrayContaining([
        expect.objectContaining({
          target: 'first-package',
          command: 'dsh plugin --profile web add npm:first-package',
          executable: true,
        }),
        expect.objectContaining({
          target: 'second-package',
          command: 'dsh plugin --profile web add npm:second-package',
          executable: true,
        }),
      ]),
    })
  })

  it('pins a matching GitHub reference to the validated source SHA for host execution', () => {
    const reference = extractInstallReference(`
## Install

\`\`\`sh
dsh plugin --profile web add github:owner/plugin
\`\`\`
`)

    expect(resolveCatalogInstallReference(reference, {
      fullName: 'owner/plugin',
      validation: { overall: 'verified', sourceSha: 'A'.repeat(40) },
    })).toMatchObject({
      status: 'recognized',
      candidate: {
        command: `dsh plugin --profile web add github:owner/plugin#${'a'.repeat(40)}`,
        args: ['plugin', '--profile', 'web', 'add', `github:owner/plugin#${'a'.repeat(40)}`],
        executable: true,
      },
    })
  })

  it('keeps a matching README GitHub command executable without current validation', () => {
    const reference = extractInstallReference(`
## Install

\`\`\`sh
dsh plugin --profile web add github:owner/plugin
\`\`\`
`)

    expect(resolveCatalogInstallReference(reference, {
      fullName: 'owner/plugin',
      validation: { overall: 'check-pending' },
    })).toMatchObject({
      status: 'recognized',
      candidate: {
        source: 'github',
        target: 'owner/plugin',
        args: ['plugin', '--profile', 'web', 'add', 'github:owner/plugin'],
        executable: true,
      },
    })
  })

  it('converts a recognized npm README command into a structured DSH install plan', () => {
    const reference = extractInstallReference(`
## Install

\`\`\`sh
npm install dsh-example
\`\`\`
`)

    expect(resolveCatalogInstallReference(reference, {
      fullName: 'owner/plugin',
      validation: { overall: 'check-pending' },
    })).toMatchObject({
      status: 'recognized',
      candidate: {
        source: 'npm',
        target: 'dsh-example',
        args: ['plugin', '--profile', 'web', 'add', 'npm:dsh-example'],
        executable: true,
      },
    })
  })

  it('keeps security-review commands out of one-click installation', () => {
    const reference = extractInstallReference(`
## Install

\`\`\`sh
dsh plugin --profile web add github:owner/plugin
\`\`\`
`)

    expect(resolveCatalogInstallReference(reference, {
      fullName: 'owner/plugin',
      validation: { overall: 'security-review' },
    })).toMatchObject({ candidate: { executable: false } })
  })

  it('does not make a README command executable when it targets another repository', () => {
    const reference = extractInstallReference(`
## Install

\`\`\`sh
dsh plugin --profile web add github:other/plugin
\`\`\`
`)

    expect(resolveCatalogInstallReference(reference, {
      fullName: 'owner/plugin',
      validation: { overall: 'verified', sourceSha: 'a'.repeat(40) },
    })).toMatchObject({
      candidate: { executable: false },
    })
  })

  it('does not rewrite a non-web profile into a web installation', () => {
    const reference = extractInstallReference(`
## Install

\`\`\`sh
dsh plugin --profile native add github:owner/plugin
\`\`\`
`)

    expect(resolveCatalogInstallReference(reference, {
      fullName: 'owner/plugin',
      validation: { overall: 'verified', sourceSha: 'a'.repeat(40) },
    })).toMatchObject({
      candidate: {
        args: ['plugin', '--profile', 'native', 'add', 'github:owner/plugin'],
        executable: false,
      },
    })
  })
})
