import { readFile, realpath } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

const pluginRoot = resolve(process.argv[2] ?? '')
const smokeMode = process.argv[3] ?? 'loader'
if (!pluginRoot.startsWith('/validation/workspace/')
  || smokeMode !== 'loader') throw new Error('Invalid smoke boundary')

const sourceManifest = JSON.parse(await readFile(resolve(pluginRoot, 'package.json'), 'utf8'))
const packageName = sourceManifest.name
if (typeof packageName !== 'string' || packageName.length === 0) {
  throw new Error('Plugin has no package name')
}

const dshHome = resolve(process.env.DSH_HOME ?? '')
const profileRoot = resolve(dshHome, 'profiles', 'validation')
if (!dshHome.startsWith('/validation/') || !profileRoot.startsWith(`${dshHome}${sep}`)) {
  throw new Error('Invalid DSH profile boundary')
}
const profileManifest = JSON.parse(await readFile(resolve(profileRoot, 'package.json'), 'utf8'))
if (!profileManifest.dependencies
  || !Object.hasOwn(profileManifest.dependencies, packageName)
  || !profileManifest.dsh?.profile?.bundles?.includes(packageName)) {
  throw new Error('Plugin is not activated in the DSH profile')
}

const nodeModulesRoot = resolve(profileRoot, 'node_modules')
const installedRoot = resolve(nodeModulesRoot, packageName)
if (!installedRoot.startsWith(`${nodeModulesRoot}${sep}`)) throw new Error('Invalid installed plugin boundary')
const manifest = JSON.parse(await readFile(resolve(installedRoot, 'package.json'), 'utf8'))
if (manifest.name !== packageName) throw new Error('Installed plugin identity mismatch')
const exported = manifest.exports?.['.']
const entrypoint = typeof manifest.main === 'string'
  ? manifest.main
  : typeof exported === 'string'
    ? exported
    : exported?.default
if (typeof entrypoint !== 'string') throw new Error('Plugin has no importable entrypoint')

const nodeModulesRootReal = await realpath(nodeModulesRoot)
const installedRootReal = await realpath(installedRoot)
if (!installedRootReal.startsWith(`${nodeModulesRootReal}${sep}`)) {
  throw new Error('Installed plugin escapes node_modules boundary')
}
const entrypointPath = resolve(installedRootReal, entrypoint)
const entrypointReal = await realpath(entrypointPath)
if (!entrypointReal.startsWith(`${installedRootReal}${sep}`)) {
  throw new Error('Plugin entrypoint escapes installed plugin boundary')
}

const module = await import(pathToFileURL(entrypointReal).href)
const apply = typeof module.apply === 'function'
  ? module.apply
  : typeof module.default?.apply === 'function'
    ? module.default.apply
    : typeof module.default === 'function'
      ? module.default
      : null
if (!apply) throw new Error('Plugin does not export an apply function')

// Execute the installed entrypoint with a side-effect-free capability stub. The
// real DSH profile has already proved installation and activation above; this
// call catches plugins that cannot initialize against the host plugin contract
// without exposing host files, credentials, or a Docker socket.
const noop = (..._args) => noop
const context = new Proxy(noop, {
  get: (_target, property) => property === 'logger' ? noop : noop,
  apply: () => noop,
})
await Promise.race([
  Promise.resolve(apply(context, {})),
  new Promise((_, reject) => setTimeout(() => reject(new Error('Plugin apply timed out')), 30_000)),
])

process.stdout.write(`${JSON.stringify({ smokeMode, packageName, entrypoint, apply: true, invoked: true })}\n`)
