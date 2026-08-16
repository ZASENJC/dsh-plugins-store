const MAX_ERROR_LENGTH = 3200
const ANALYSIS_TIMEOUT_MS = 5000

function sanitizeError(value) {
  return String(value ?? '未知安装错误')
    .replace(/authorization\s*:\s*bearer\s+[^\s\n]+/gi, 'Authorization: Bearer [已隐藏]')
    .replace(/(access[_-]?token|refresh[_-]?token|api[_-]?key|password)\s*[:=]\s*[^\s\n]+/gi, '$1=[已隐藏]')
    .slice(-MAX_ERROR_LENGTH)
}

export function buildAgentAnalysisPrompt({ fullName, install, error }) {
  const command = typeof install?.command === 'string' ? install.command : '未知安装参考'
  const source = install?.source === 'npm' ? 'npm 包' : install?.source === 'github' ? 'GitHub 仓库' : 'README 命令'
  return [
    '插件一键安装失败，请作为 AGENT 分析原因并给出可执行的解决方案。',
    `仓库：${fullName}`,
    `安装来源：${source}`,
    `安装参考：${command}`,
    `错误信息：${sanitizeError(error)}`,
    '请先判断是 DSH 环境、网络、依赖还是插件本身的问题；不要直接执行第三方代码。',
  ].join('\n')
}

function currentSessionId(sessions) {
  return sessions?.list?.getSnapshot?.().current
}

function waitForCurrentSession(sessions, previousId) {
  const current = currentSessionId(sessions)
  if (current && current !== previousId) return Promise.resolve(current)
  if (typeof sessions?.list?.subscribe !== 'function') {
    return Promise.reject(new Error('无法确认新建的 DSH 会话'))
  }

  return new Promise((resolve, reject) => {
    let settled = false
    let unsubscribe = () => {}
    let timer
    const finish = (callback, value) => {
      if (settled) return
      settled = true
      unsubscribe()
      clearTimeout(timer)
      callback(value)
    }
    unsubscribe = sessions.list.subscribe(() => {
      const next = currentSessionId(sessions)
      if (next && next !== previousId) finish(resolve, next)
    })
    timer = setTimeout(() => finish(reject, new Error('新建 DSH 会话超时')), ANALYSIS_TIMEOUT_MS)
  })
}

async function resolveNewSession(sessions, workspaces) {
  const previousId = currentSessionId(sessions)
  if (typeof sessions?.create === 'function') {
    const id = await sessions.create({})
    sessions.open?.(id)
    return id
  }
  if (typeof workspaces?.startSession !== 'function') {
    throw new Error('当前 DSH 未提供新建会话能力')
  }
  const started = await workspaces.startSession()
  const startedId = typeof started === 'string' ? started : started?.id
  if (typeof startedId === 'string' && startedId.length > 0) {
    sessions.open?.(startedId)
    return startedId
  }
  const id = await waitForCurrentSession(sessions, previousId)
  sessions.open?.(id)
  return id
}

export async function sendInstallFailureToAgent({
  sessions,
  workspaces,
  fullName,
  install,
  error,
}) {
  const sessionId = await resolveNewSession(sessions, workspaces)
  const session = sessions?.binding?.(sessionId)?.session
  if (typeof session?.prompt !== 'function') {
    throw new Error('新建会话尚未准备好接收消息')
  }
  const result = await session.prompt([
    { type: 'text', text: buildAgentAnalysisPrompt({ fullName, install, error }) },
  ], 'queue')
  if (result?.ok === false) {
    throw new Error(result.error?.message ?? 'AGENT 消息发送失败')
  }
  return sessionId
}
