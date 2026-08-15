import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const pluginRoot = resolve(process.argv[2] ?? '')
const smokeMode = process.argv[3] ?? 'tool-registration'
if (!pluginRoot.startsWith('/validation/workspace/')
  || !['loader', 'tool-registration'].includes(smokeMode)) throw new Error('Invalid smoke boundary')

const manifest = JSON.parse(await readFile(resolve(pluginRoot, 'package.json'), 'utf8'))
const exported = manifest.exports?.['.']
const entrypoint = typeof manifest.main === 'string'
  ? manifest.main
  : typeof exported === 'string'
    ? exported
    : exported?.default
if (typeof entrypoint !== 'string') throw new Error('Plugin has no importable entrypoint')

const module = await import(pathToFileURL(resolve(pluginRoot, entrypoint)).href)
const apply = typeof module.apply === 'function'
  ? module.apply
  : typeof module.default?.apply === 'function'
    ? module.default.apply
    : typeof module.default === 'function'
      ? module.default
      : null
if (!apply) throw new Error('Plugin does not export an apply function')

const registrations = []
const noop = () => undefined
const chain = new Proxy(noop, {
  apply: () => chain,
  get: (_target, property) => property === 'then' ? undefined : chain,
})
const tools = {
  register(definition) {
    registrations.push(definition)
    return noop
  },
}
const context = new Proxy({
  tools,
  logger: () => ({ debug: noop, info: noop, warn: noop, error: noop }),
  on: noop,
  once: noop,
  emit: noop,
  effect: (callback) => callback(),
}, {
  get(target, property) {
    if (property in target) return target[property]
    return chain
  },
})

if (smokeMode === 'tool-registration') {
  await apply(context, {})
  if (registrations.length === 0) throw new Error('Plugin registered no tools')
  if (registrations.some((definition) => typeof definition?.name !== 'string')) {
    throw new Error('Registered tool has no name')
  }
}
process.stdout.write(`${JSON.stringify({ smokeMode, registrations: registrations.length })}\n`)
