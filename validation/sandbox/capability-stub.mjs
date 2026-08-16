export function createCapabilityStub() {
  let capability
  const target = () => capability
  capability = new Proxy(target, {
    // Keep arbitrary capability chains callable without turning the stub into a thenable.
    get: (_target, property) => property === 'then' ? undefined : capability,
    apply: () => capability,
  })
  return capability
}

export function resolvePluginConfig(pluginModule) {
  const config = typeof pluginModule.Config === 'function' ? pluginModule.Config({}) : {}
  if (config !== null
    && typeof config === 'object'
    && !Array.isArray(config)
    && Object.hasOwn(config, 'checkOnStart')
    && typeof config.checkOnStart === 'boolean') {
    // Registration smoke must not require an external companion binary in the sandbox.
    return { ...config, checkOnStart: false }
  }
  return config
}

export async function awaitWithTimeout(value, timeoutMs) {
  let timeout
  try {
    return await Promise.race([
      Promise.resolve(value),
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error('Plugin apply timed out')), timeoutMs)
      }),
    ])
  } finally {
    clearTimeout(timeout)
  }
}
