import { mkdir, rm, writeFile } from 'node:fs/promises'
import { build } from 'esbuild'

const pluginId = 'dsh-plugin-store'
const root = new URL('./', import.meta.url)
const outDir = new URL('./lib/', root)

await rm(outDir, { recursive: true, force: true })
await mkdir(outDir, { recursive: true })

await build({
  entryPoints: [new URL('./src/index.js', root).pathname],
  outfile: new URL('./index.js', outDir).pathname,
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  external: ['@deepseek-ai/dsh-native-command'],
  minify: true,
})

const client = await build({
  entryPoints: [new URL('./src/client.jsx', root).pathname],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: ['chrome120'],
  external: [
    'react',
    '@deepseek-ai/dsh-client-ui-primitives',
  ],
  jsxFactory: 'React.createElement',
  jsxFragment: 'React.Fragment',
  minify: true,
  write: false,
})

if (client.outputFiles?.length !== 1) {
  throw new Error('Expected one DSH browser bundle')
}

const code = client.outputFiles[0].text
const allowedModules = new Set([
  'react',
  '@deepseek-ai/dsh-client-ui-primitives',
])
const externalModules = [...code.matchAll(/\brequire\("([^"]+)"\)/g)].map((match) => match[1])
const unsupported = externalModules.filter((moduleId) => !allowedModules.has(moduleId))
if (unsupported.length > 0) {
  throw new Error(`Unsupported DSH client modules: ${[...new Set(unsupported)].join(', ')}`)
}

const wrapped = [
  `window.__ModuleLoader__.load({ id: ${JSON.stringify(pluginId)}, factory: (require) => {`,
  'var module = { exports: {} }; var exports = module.exports;',
  code,
  'return module.exports; } });',
  '',
].join('\n')

await writeFile(new URL('./client.js', outDir), wrapped)
