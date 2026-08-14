import { cp, lstat, mkdir, readdir, rm } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'

const source = resolve(process.argv[2] ?? '')
const destination = resolve(process.argv[3] ?? '')
if (!source || !destination.startsWith('/validation/workspace/')) throw new Error('Invalid copy boundary')

async function rejectLinks(path) {
  for (const name of await readdir(path)) {
    const child = join(path, name)
    const stat = await lstat(child)
    if (stat.isSymbolicLink()) throw new Error(`Symbolic links are not allowed: ${name}`)
    if (stat.isDirectory()) await rejectLinks(child)
  }
}

await rejectLinks(source)
await rm(destination, { recursive: true, force: true })
await mkdir(dirname(destination), { recursive: true })
await cp(source, destination, { recursive: true, force: false, errorOnExist: true })
