import { describe, expect, it } from 'vitest'

import {
  extractAwesomeRepositoryNames,
  extractVerifiedRepositoryNames,
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
