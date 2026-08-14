import { describe, expect, it } from 'vitest'

import {
  extractAwesomeRepositoryNames,
  extractVerifiedRepositoryNames,
  prepareReadmeHtml,
} from './github-content'

describe('awesome-dsh-plugins catalog matching', () => {
  it('keeps cataloged plugin states and excludes non-plugin lifecycle states', () => {
    const html = `
      <table>
        <tbody>
          <tr><td><a href="https://github.com/dsh-external/dsh-live-stats">Live</a></td><td>插件</td><td>关注</td><td>Stats</td></tr>
          <tr><td><a href="https://github.com/Owner/Compatible">Compatible</a></td><td>插件</td><td>兼容</td><td>Ready</td></tr>
          <tr><td><a href="https://github.com/Owner/Needs-Work">Needs work</a></td><td>插件</td><td>需适配</td><td>Patch</td></tr>
          <tr><td><a href="https://github.com/Owner/Research-Me">Research</a></td><td>插件</td><td>待调研</td><td>Research</td></tr>
          <tr><td><a href="https://github.com/Owner/Placeholder">Placeholder</a></td><td>插件</td><td>占位</td><td>Reserved</td></tr>
          <tr><td><a href="https://github.com/Owner/Not-Applicable">N/A</a></td><td>插件</td><td>不适用</td><td>Skip</td></tr>
          <tr><td><a href="https://github.com/Owner/Removed">Removed</a></td><td>插件</td><td>已删除</td><td>Gone</td></tr>
        </tbody>
      </table>
      <table><tbody><tr><td><a href="https://github.com/Owner/No-Status">Other table</a></td><td>Link</td></tr></tbody></table>
    `

    expect([...extractAwesomeRepositoryNames(html)].sort()).toEqual([
      'compatible',
      'dsh-live-stats',
      'needs-work',
      'research-me',
    ])
  })

  it('ignores invalid, non-GitHub, and non-repository links in accepted rows', () => {
    const html = `
      <table><tbody>
        <tr><td><a href="not a url">Invalid</a></td><td>插件</td><td>兼容</td></tr>
        <tr><td><a href="https://example.com/Owner/Plugin">External</a></td><td>插件</td><td>关注</td></tr>
        <tr><td><a href="https://github.com/Owner/Plugin/issues">Issue</a></td><td>插件</td><td>需适配</td></tr>
        <tr><td>No link</td><td>插件</td><td>待调研</td></tr>
      </tbody></table>
    `

    expect([...extractAwesomeRepositoryNames(html)]).toEqual([])
  })
})

describe('dsh-plugin-verify catalog matching', () => {
  it('keeps only verified rows from plugin status tables and returns full repository names', () => {
    const html = `
      <table>
        <thead><tr><th>插件</th><th>状态</th><th>说明</th><th>验证日期</th><th>报告</th></tr></thead>
        <tbody>
          <tr><td><a href="https://github.com/Owner/Verified-Plugin">Verified</a></td><td>✅</td><td>Ready</td><td>2026-08-14</td><td>view</td></tr>
          <tr><td><a href="https://github.com/Owner/Pending-Plugin">Pending</a></td><td>⏳</td><td>Pending</td><td>-</td><td>-</td></tr>
          <tr><td><a href="https://github.com/Owner/Failed-Plugin">Failed</a></td><td>❌</td><td>Failed</td><td>2026-08-14</td><td>view</td></tr>
        </tbody>
      </table>
      <table>
        <thead><tr><th>项目</th><th>状态</th></tr></thead>
        <tbody><tr><td><a href="https://github.com/Owner/Other-Table">Other</a></td><td>✅</td></tr></tbody>
      </table>
    `

    expect([...extractVerifiedRepositoryNames(html)]).toEqual(['owner/verified-plugin'])
  })
})

describe('GitHub README rendering', () => {
  it('returns the rendered body and resolves relative repository links and media', () => {
    const html = `
      <div id="readme" data-path="docs/README.md">
        <article class="markdown-body">
          <h1>Plugin</h1>
          <a href="../CHANGELOG.md">Changelog</a>
          <a href="#install">Install</a>
          <a href="https://example.com/docs">External docs</a>
          <img src="../assets/demo.png" alt="Demo">
        </article>
      </div>
    `

    const rendered = prepareReadmeHtml(html, {
      fullName: 'Owner/Plugin',
      defaultBranch: 'main',
    })

    expect(rendered).toContain('<h1>Plugin</h1>')
    expect(rendered).toContain('href="https://github.com/Owner/Plugin/blob/main/CHANGELOG.md"')
    expect(rendered).toContain('href="#install"')
    expect(rendered).toContain('href="https://example.com/docs"')
    expect(rendered).toContain('src="https://raw.githubusercontent.com/Owner/Plugin/main/assets/demo.png"')
    expect(rendered).not.toContain('id="readme"')
  })

  it('returns an empty string when GitHub does not return a README article', () => {
    expect(prepareReadmeHtml('<p>Not found</p>', {
      fullName: 'Owner/Plugin',
      defaultBranch: 'main',
    })).toBe('')
  })

  it('keeps external media and resolves GitHub-root and query-bearing references', () => {
    const rendered = prepareReadmeHtml(`
      <div id="readme">
        <article class="markdown-body">
          <a href="/Owner/Plugin/issues">Issues</a>
          <a href="guide.md?plain=1#usage">Guide</a>
          <a href="?plain=1">Current document</a>
          <img src="/assets/github.png" alt="GitHub asset">
          <img src="https://example.com/logo.png" alt="External asset">
        </article>
      </div>
    `, {
      fullName: 'Owner/Plugin',
      defaultBranch: 'main',
    })

    expect(rendered).toContain('href="https://github.com/Owner/Plugin/issues"')
    expect(rendered).toContain('href="https://github.com/Owner/Plugin/blob/main/guide.md?plain=1#usage"')
    expect(rendered).toContain('href="?plain=1"')
    expect(rendered).toContain('src="https://github.com/assets/github.png"')
    expect(rendered).toContain('src="https://example.com/logo.png"')
  })
})
