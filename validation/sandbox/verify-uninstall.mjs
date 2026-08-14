import { readFile } from 'node:fs/promises'

const packageName = process.argv[2]
if (!packageName) throw new Error('Package name is required')
const manifest = JSON.parse(await readFile('/validation/dsh-home/profiles/web/package.json', 'utf8'))
const dependencies = manifest.dependencies ?? {}
const bundles = manifest.dsh?.profile?.bundles ?? []
const bundlePath = 'dsh.profile.bundles'
if (packageName in dependencies || bundles.includes(packageName)) {
  throw new Error(`Plugin remains in dependencies or ${bundlePath}`)
}
process.stdout.write(`${JSON.stringify({ packageName, removed: true })}\n`)
