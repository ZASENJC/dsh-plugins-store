import { describe, expect, it } from 'vitest'

import {
  classifyRepository,
  getCategory,
  getProjectTypeLabel,
  normalizeTopic,
} from './classification'

describe('classifyRepository', () => {
  it('uses repository topics to classify a messaging channel', () => {
    const result = classifyRepository({
      fullName: 'example/dsh-lark-bot',
      name: 'dsh-lark-bot',
      description: 'A DSH bridge bot',
      topics: ['dsh-plugin', 'feishu', 'lark', 'bot', 'bridge'],
    })

    expect(result.projectType).toBe('channel')
    expect(result.category).toBe('communication')
    expect(result.matchedTopics).toEqual(expect.arrayContaining(['feishu', 'lark']))
    expect(result.confidence).toBe('high')
  })

  it('classifies skill packs separately from runtime plugins', () => {
    const result = classifyRepository({
      fullName: 'example/security-skills',
      name: 'security-skills',
      description: 'Security skill pack',
      topics: ['dsh-plugin', 'agent-skills', 'skill-pack', 'security-audit'],
    })

    expect(result.projectType).toBe('skill')
    expect(result.category).toBe('security')
  })

  it('does not mislabel the DSH host application as a plugin', () => {
    const result = classifyRepository({
      fullName: 'deepseek-ai/deepseek-harness',
      name: 'deepseek-harness',
      description: 'Everything is a Plugin.',
      topics: ['cordis', 'dsh', 'dsh-plugin'],
    })

    expect(result.projectType).toBe('application')
  })

  it('keeps projects without meaningful topics explicitly unclassified', () => {
    const result = classifyRepository({
      fullName: 'example/untitled',
      name: 'untitled',
      description: '',
      topics: ['dsh-plugin'],
    })

    expect(result.projectType).toBe('unknown')
    expect(result.category).toBe('other')
    expect(result.confidence).toBe('low')
  })

  it('uses topic scores and stable priority when several categories match', () => {
    const result = classifyRepository({
      fullName: 'example/vision-ui',
      name: 'vision-ui',
      description: 'Vision tools with a browser interface',
      topics: ['dsh-plugin', 'vision', 'ocr', 'image-to-text', 'web-ui'],
    })

    expect(result.category).toBe('data')
    expect(result.categories).toEqual(expect.arrayContaining(['data', 'ui']))
  })

  it('normalizes topic spelling before matching', () => {
    const result = classifyRepository({
      fullName: 'example/mcp-client',
      name: 'mcp-client',
      description: '',
      topics: ['DSH_Plugin', 'MCP Server', 'Model-Provider'],
    })

    expect(result.category).toBe('model-mcp')
    expect(result.matchedTopics).toEqual(expect.arrayContaining(['mcp-server', 'model-provider']))
  })

  it('exposes stable display metadata for the catalog UI', () => {
    expect(normalizeTopic('  Agent__Memory  ')).toBe('agent-memory')
    expect(getProjectTypeLabel('collection')).toBe('插件合集')
    expect(getCategory('communication')).toMatchObject({
      label: '消息通讯',
      color: '#ffc285',
    })
  })

  it('falls back safely when runtime data contains an unknown display id', () => {
    expect(getProjectTypeLabel('future-type' as never)).toBe('future-type')
    expect(getCategory('future-category' as never).id).toBe('other')
  })

  it.each([
    [['sidebar', 'webview2'], 'ui'],
    [['agent-orchestration', 'context-engineering'], 'agent-session'],
    [['code-indexing', 'static-analysis'], 'development'],
    [['cross-session-messaging', 'wechat-notify'], 'communication'],
    [['pdf-parser', 'knowledge-graph'], 'data'],
    [['llm-gateway', 'model-routing'], 'model-mcp'],
    [['secret-scanning', 'container-security'], 'security'],
    [['runtime-health-check', 'github-actions'], 'operations'],
    [['mini-games', 'desktop-pet'], 'lifestyle'],
    [['theorem-proving', 'literature-search'], 'research'],
  ])('maps ecosystem topic variants %j to %s', (topics, category) => {
    const result = classifyRepository({
      fullName: `example/${category}`,
      name: category,
      description: '',
      topics: ['dsh-plugin', ...topics],
    })

    expect(result.category).toBe(category)
    expect(result.matchedTopics).toEqual(expect.arrayContaining(topics))
  })

  it('recognizes common collection and directory topic variants', () => {
    expect(classifyRepository({
      fullName: 'example/toolkit',
      name: 'toolkit',
      description: '',
      topics: ['dsh-plugin', 'collection', 'toolkit'],
    }).projectType).toBe('collection')

    expect(classifyRepository({
      fullName: 'example/catalog',
      name: 'catalog',
      description: '',
      topics: ['dsh-plugin', 'catalog', 'plugin-discovery'],
    }).projectType).toBe('directory')
  })
})
