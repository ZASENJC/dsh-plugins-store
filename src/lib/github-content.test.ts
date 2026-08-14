import { describe, expect, it } from 'vitest'

import {
  extractAwesomeRepositoryNames,
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
})
