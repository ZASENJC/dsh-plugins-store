import { describe, expect, it } from 'vitest'

import { extractVerifiedRepositoryNames } from './github-content'

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
