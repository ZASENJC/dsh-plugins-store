import { describe, expect, it } from 'vitest'

import {
  extractInstallReference,
  resolveCatalogInstallReference,
} from './install-reference'

describe('README install reference extraction', () => {
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

  it('does not select a shell pipeline or silently choose between multiple commands', () => {
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
        expect.objectContaining({ target: 'first-package' }),
        expect.objectContaining({ target: 'second-package' }),
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
