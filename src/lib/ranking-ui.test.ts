import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const pageSource = readFileSync(fileURLToPath(new URL('../pages/index.astro', import.meta.url)), 'utf8')
const rowSource = readFileSync(fileURLToPath(new URL('../components/RankingListItem.astro', import.meta.url)), 'utf8')
const rankingSource = readFileSync(fileURLToPath(new URL('./ranking.ts', import.meta.url)), 'utf8')

describe('ranking page UI', () => {
  it('adds four ranking controls below the shared classification filters', () => {
    expect(pageSource).toMatch(/data-filter-group="category"[\s\S]*\{isRankingPage && \([\s\S]*data-filter-group="ranking"/)
    expect(pageSource).toContain('data-ranking-mode={mode.id}')
    expect(pageSource).toContain("[data-filter-group='ranking'] .filter-group__options")
    expect(rankingSource).toContain("id: 'starsToday'")
    expect(rankingSource).toContain("id: 'stars'")
    expect(rankingSource).toContain("id: 'newest'")
    expect(rankingSource).toContain("id: 'updated'")
  })

  it('renders rankings as a list with signed daily growth and a sparkline', () => {
    expect(pageSource).toContain('<ol class="ranking-list" id="ranking-list"')
    expect(pageSource).toContain('<RankingListItem')
    expect(pageSource).toContain('每 30 分钟刷新 · 每日 00:00（北京时间）重新计数')
    expect(pageSource).toContain('const changeToday = repository.starTrend.changeToday')
    expect(pageSource).toContain("`${changeToday >= 0 ? '+' : ''}${compactNumber(changeToday)}`")
    expect(rowSource).toContain('data-ranking-row')
    expect(rowSource).toContain("data-field={mode === 'starsToday' ? 'star-change' : 'metric-value'}")
    expect(rowSource).toContain("'ranking.metric.starsToday'")
    expect(rowSource).toContain("`${starChange >= 0 ? '+' : ''}${formatCompactNumber(starChange)}`")
    expect(rowSource).toContain('class="ranking-sparkline"')
    expect(rowSource).toContain('<polyline')
  })

  it('keeps ranking mode and page origin in URL-backed detail navigation', () => {
    expect(pageSource).toContain("params.set('from', 'ranking')")
    expect(pageSource).toContain("params.set('rank', selectedRankingMode)")
    expect(pageSource).toContain("const rankingModeIds = new Set(['starsToday', 'stars', 'newest', 'updated'])")
  })
})
