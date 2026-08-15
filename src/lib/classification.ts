export const PROJECT_TYPES = [
  { id: 'plugin', label: '插件' },
  { id: 'skill', label: '技能' },
  { id: 'collection', label: '插件合集' },
  { id: 'channel', label: '渠道适配' },
  { id: 'application', label: '完整应用' },
  { id: 'infrastructure', label: '基础设施' },
  { id: 'directory', label: '索引目录' },
  { id: 'unknown', label: '待识别' },
] as const

export const CATEGORIES = [
  { id: 'ui', label: '界面增强', color: '#a0c3ec' },
  { id: 'agent-session', label: 'Agent 与会话', color: '#c4b5fd' },
  { id: 'development', label: '开发工具', color: '#ffffff' },
  { id: 'communication', label: '消息通讯', color: '#ffc285' },
  { id: 'data', label: '文件与数据', color: '#8ed6c4' },
  { id: 'model-mcp', label: '模型与 MCP', color: '#9bb7ff' },
  { id: 'security', label: '安全与治理', color: '#ff9c8c' },
  { id: 'operations', label: '部署运维', color: '#d0d3d8' },
  { id: 'lifestyle', label: '生活娱乐', color: '#ffb3d1' },
  { id: 'research', label: '学习研究', color: '#b7d987' },
  { id: 'other', label: '其他', color: '#7d8187' },
] as const

export type ProjectType = (typeof PROJECT_TYPES)[number]['id']
export type Category = (typeof CATEGORIES)[number]['id']
export type Confidence = 'high' | 'medium' | 'low'

interface RepositorySignals {
  fullName: string
  name: string
  description: string
  topics: string[]
}

export interface ClassificationResult {
  projectType: ProjectType
  category: Category
  categories: Category[]
  matchedTopics: string[]
  confidence: Confidence
}

type TopicRule<T extends string> = Partial<Record<T, number>>

interface TopicPatternRule<T extends string> {
  pattern: RegExp
  weights: TopicRule<T>
}

const IGNORED_TOPICS = new Set([
  'ai',
  'agent',
  'deepseek',
  'deepseek-harness',
  'dsh',
  'dsh-plugin',
  'dsh-plugins',
  'javascript',
  'llm',
  'plugin',
  'python',
  'typescript',
])

const TYPE_RULES: Record<string, TopicRule<ProjectType>> = {
  'agent-skills': { skill: 4 },
  'skill': { skill: 4 },
  'skills': { skill: 4 },
  'skill-pack': { skill: 5, collection: 1 },
  'meta-skill': { skill: 3 },
  'bot': { channel: 2 },
  'bridge': { channel: 1 },
  'chatbot': { channel: 2 },
  'feishu': { channel: 4 },
  'lark': { channel: 4 },
  'telegram': { channel: 4 },
  'wechat': { channel: 4 },
  'wecom': { channel: 4 },
  'qq': { channel: 4 },
  'discord': { channel: 4 },
  'slack': { channel: 4 },
  'marketplace': { directory: 5 },
  'awesome-list': { directory: 5 },
  'plugin-directory': { directory: 5 },
  'plugin-registry': { infrastructure: 4 },
  'plugin-manager': { infrastructure: 3 },
  'plugin-collection': { collection: 5 },
  'plugin-pack': { collection: 5 },
  'monorepo': { collection: 2 },
  'web-app': { application: 3 },
  'desktop-app': { application: 4 },
  'mobile-app': { application: 4 },
  'coding-agent': { application: 2 },
  'infrastructure': { infrastructure: 4 },
  'deployment': { infrastructure: 2 },
  'observability': { infrastructure: 2 },
  'collection': { collection: 4 },
  'toolkit': { collection: 2 },
  'curated-list': { directory: 5 },
  'catalog': { directory: 5 },
  'plugin-discovery': { directory: 4 },
}

const TYPE_PATTERN_RULES: TopicPatternRule<ProjectType>[] = [
  { pattern: /(^|-)skills?($|-)/, weights: { skill: 3 } },
  { pattern: /(^|-)bots?($|-)|messaging|notification/, weights: { channel: 2 } },
  { pattern: /awesome|catalog|directory|marketplace|plugin-discovery|curated-list|package-index/, weights: { directory: 4 } },
  { pattern: /collection|toolkit|plugin-pack|skill-pack/, weights: { collection: 3 } },
  { pattern: /desktop-app|desktop-application|mobile-app|web-app|agent-platform|ai-workbench/, weights: { application: 3 } },
  { pattern: /infrastructure|plugin-registry|plugin-manager|plugin-runtime|distribution/, weights: { infrastructure: 3 } },
]

const CATEGORY_RULES: Record<string, TopicRule<Category>> = {
  'web-ui': { ui: 5 },
  'ui': { ui: 4 },
  'frontend': { ui: 3 },
  'theme': { ui: 4 },
  'skin': { ui: 4 },
  'tui': { ui: 3, development: 1 },
  'visual-editor': { ui: 3, development: 1 },
  'agent-memory': { 'agent-session': 5 },
  'memory': { 'agent-session': 4 },
  'session-management': { 'agent-session': 5 },
  'session': { 'agent-session': 3 },
  'subagent': { 'agent-session': 4 },
  'multi-agent': { 'agent-session': 4 },
  'context-management': { 'agent-session': 4 },
  'workflow': { 'agent-session': 3 },
  'planning': { 'agent-session': 3 },
  'automation': { 'agent-session': 2, operations: 1 },
  'git': { development: 4 },
  'github': { development: 4 },
  'coding': { development: 3 },
  'code-review': { development: 4 },
  'developer-tools': { development: 4 },
  'terminal': { development: 3 },
  'cli': { development: 2 },
  'lsp': { development: 4 },
  'vscode': { development: 4 },
  'feishu': { communication: 5 },
  'lark': { communication: 5 },
  'telegram': { communication: 5 },
  'wechat': { communication: 5 },
  'wecom': { communication: 5 },
  'qq': { communication: 5 },
  'discord': { communication: 5 },
  'slack': { communication: 5 },
  'messaging': { communication: 4 },
  'notification': { communication: 3 },
  'webhook': { communication: 4 },
  'chat': { communication: 3 },
  'email': { communication: 4 },
  'database': { data: 4 },
  'file-management': { data: 4 },
  'filesystem': { data: 4 },
  'document': { data: 3 },
  'rag': { data: 3, research: 1 },
  'ocr': { data: 4 },
  'vision': { data: 3 },
  'image-to-text': { data: 4 },
  'multimodal': { data: 2, 'model-mcp': 1 },
  'mcp': { 'model-mcp': 5 },
  'mcp-server': { 'model-mcp': 5 },
  'mcp-client': { 'model-mcp': 5 },
  'model-provider': { 'model-mcp': 5 },
  'llm-provider': { 'model-mcp': 5 },
  'embedding': { 'model-mcp': 4 },
  'inference': { 'model-mcp': 4 },
  'ollama': { 'model-mcp': 4 },
  'openai': { 'model-mcp': 3 },
  'anthropic': { 'model-mcp': 3 },
  'oauth': { 'model-mcp': 2, security: 1 },
  'authentication': { security: 4 },
  'authorization': { security: 4 },
  'credential': { security: 4 },
  'prompt-injection': { security: 5 },
  'security': { security: 5 },
  'security-audit': { security: 5 },
  'supply-chain-security': { security: 5 },
  'sandbox': { security: 4 },
  'permission': { security: 4 },
  'approval': { security: 3 },
  'policy': { security: 3 },
  'docker': { operations: 4 },
  'kubernetes': { operations: 4 },
  'k8s': { operations: 4 },
  'helm': { operations: 4 },
  'terraform': { operations: 4 },
  'ansible': { operations: 4 },
  'deployment': { operations: 4 },
  'devops': { operations: 4 },
  'monitoring': { operations: 4 },
  'observability': { operations: 4 },
  'telemetry': { operations: 4 },
  'diagnostic': { operations: 3 },
  'doctor': { operations: 3 },
  'runtime-health-check': { operations: 5 },
  'health-check': { operations: 4 },
  'github-actions': { operations: 2, development: 1 },
  'scheduler': { operations: 4 },
  'cron': { operations: 4 },
  'productivity': { lifestyle: 2 },
  'music': { lifestyle: 4 },
  'game': { lifestyle: 4 },
  'companion-ai': { lifestyle: 4 },
  'social-media': { lifestyle: 3 },
  'content-discovery': { lifestyle: 3 },
  'education': { research: 4 },
  'learning': { research: 4 },
  'research': { research: 4 },
  'knowledge': { research: 3 },
  'paper': { research: 3 },
}

const CATEGORY_PATTERN_RULES: TopicPatternRule<Category>[] = [
  {
    pattern: /(^|-)ui($|-)|frontend|sidebar|theme|skin|widget|webview|visual|colorscheme|status-line|task-board|drag-and-drop/,
    weights: { ui: 3 },
  },
  {
    pattern: /agent-(orchestration|workflow|memory|team)|multi-agent|subagents?|session|context|memory|workflow|prompt|persona|conversation|checkpoint|rewind|handoff/,
    weights: { 'agent-session': 3 },
  },
  {
    pattern: /(^|-)code($|-)|coding|developer|devtools?|git|github|terminal|command-line|(^|-)cli($|-)|lsp|language-server|vscode|editor|debug|testing|test-runner|lint|static-analysis|review|software-engineering|build/,
    weights: { development: 3 },
  },
  {
    pattern: /messag|notif|chat|webhook|(^|-)bots?($|-)|wechat|wecom|weixin|qq-bot|telegram|feishu|lark|email|imap|cross-session-messaging|interconnect/,
    weights: { communication: 3 },
  },
  {
    pattern: /(^|-)data($|-)|file|document|markdown|pdf|json|csv|sql|database|sqlite|postgres|rag|knowledge-graph|search|vision|image|ocr|attachment|zotero|encoding|hash|storage|webdav/,
    weights: { data: 3 },
  },
  {
    pattern: /mcp|model-(provider|routing|pool)|llm-(provider|routing|gateway)|ai-sdk-provider|openai-compatible|embedding|inference|transformers|ollama|openai|anthropic/,
    weights: { 'model-mcp': 4 },
  },
  {
    pattern: /security|safety|audit|approval|permission|sandbox|guard|secret|policy|credential|auth(?:entication|orization)?|redact|privacy|sast|scanning|workspace-safety/,
    weights: { security: 4 },
  },
  {
    pattern: /deploy|docker|kubernetes|k8s|helm|terraform|ansible|(^|-)ops($|-)|monitor|observability|telemetry|diagnostic|doctor|health-check|runtime-health|performance|cost|token-(usage|cost|budget|tracking)|billing|quota|scheduler|cron|backup|migration|restart|self-heal|tracing/,
    weights: { operations: 3 },
  },
  {
    pattern: /games?|pet|companion|music|voice|video|social-media|bilibili|douyin|youtube|xiaohongshu|zhihu|roleplay|stock-market|trading|productivity/,
    weights: { lifestyle: 3 },
  },
  {
    pattern: /research|learn|education|academic|papers?|literature|theorem|proof|math|statistics|benchmark|tutorial|guide|documentation|knowledge-distillation|methodology|tutor/,
    weights: { research: 3 },
  },
]

const TYPE_PRIORITY: ProjectType[] = [
  'directory',
  'collection',
  'skill',
  'channel',
  'application',
  'infrastructure',
  'plugin',
  'unknown',
]

const CATEGORY_PRIORITY: Category[] = CATEGORIES.map(({ id }) => id)

const TYPE_OVERRIDES: Record<string, ProjectType> = {
  'deepseek-ai/deepseek-harness': 'application',
}

export function normalizeTopic(topic: string): string {
  return topic
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/-+/g, '-')
}

function scoreTopics<T extends string>(
  topics: string[],
  rules: Record<string, TopicRule<T>>,
  patternRules: TopicPatternRule<T>[],
) {
  const scores = new Map<T, number>()
  const matchedTopics = new Set<string>()

  for (const topic of topics) {
    const matches = [
      ...(rules[topic] ? [rules[topic]] : []),
      ...patternRules.filter(({ pattern }) => pattern.test(topic)).map(({ weights }) => weights),
    ]
    if (matches.length === 0) continue
    matchedTopics.add(topic)
    for (const weights of matches) {
      for (const [key, weight] of Object.entries(weights) as [T, number][]) {
        scores.set(key, (scores.get(key) ?? 0) + weight)
      }
    }
  }

  return { scores, matchedTopics }
}

function rankScores<T extends string>(scores: Map<T, number>, priority: T[]): T[] {
  return [...scores.entries()]
    .sort(([leftKey, leftScore], [rightKey, rightScore]) => {
      return rightScore - leftScore || priority.indexOf(leftKey) - priority.indexOf(rightKey)
    })
    .map(([key]) => key)
}

export function classifyRepository(repository: RepositorySignals): ClassificationResult {
  const topics = [...new Set(repository.topics.map(normalizeTopic).filter(Boolean))]
  const meaningfulTopics = topics.filter((topic) => !IGNORED_TOPICS.has(topic))
  const typeResult = scoreTopics(topics, TYPE_RULES, TYPE_PATTERN_RULES)
  const categoryResult = scoreTopics(topics, CATEGORY_RULES, CATEGORY_PATTERN_RULES)
  const rankedTypes = rankScores(typeResult.scores, TYPE_PRIORITY)
  const rankedCategories = rankScores(categoryResult.scores, CATEGORY_PRIORITY)
  const override = TYPE_OVERRIDES[repository.fullName.toLowerCase()]

  let projectType: ProjectType = override ?? rankedTypes[0] ?? 'unknown'
  if (!override && projectType === 'unknown' && meaningfulTopics.length > 0) {
    projectType = 'plugin'
  }

  const category = rankedCategories[0] ?? 'other'
  const matchedTopics = [...new Set([
    ...typeResult.matchedTopics,
    ...categoryResult.matchedTopics,
  ])]
  const winningScore = Math.max(
    typeResult.scores.get(projectType) ?? 0,
    categoryResult.scores.get(category) ?? 0,
  )
  const confidence: Confidence = override || winningScore >= 4
    ? 'high'
    : winningScore >= 2
      ? 'medium'
      : 'low'

  return {
    projectType,
    category,
    categories: rankedCategories.length > 0 ? rankedCategories : ['other'],
    matchedTopics,
    confidence,
  }
}

export function getProjectTypeLabel(projectType: ProjectType): string {
  return PROJECT_TYPES.find(({ id }) => id === projectType)?.label ?? projectType
}

export function getCategory(category: Category) {
  return CATEGORIES.find(({ id }) => id === category) ?? CATEGORIES.at(-1)!
}
