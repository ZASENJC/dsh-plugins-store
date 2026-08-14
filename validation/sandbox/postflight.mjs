import { readFile, readdir } from 'node:fs/promises'

async function listeningSockets(path) {
  const rows = (await readFile(path, 'utf8')).trim().split('\n').slice(1)
  return rows.filter((row) => row.trim().split(/\s+/)[3] === '0A')
}

const listeners = [
  ...await listeningSockets('/proc/net/tcp'),
  ...await listeningSockets('/proc/net/tcp6'),
]
if (listeners.length > 0) throw new Error('Unexpected listening socket remains')

const profilesRoot = '/validation/dsh-home/profiles'
const profiles = (await readdir(profilesRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory() && entry.name !== 'node_modules')
  .map((entry) => entry.name)
if (profiles.some((name) => name !== 'validation')) throw new Error('Unexpected DSH profile residue')
await readFile('/validation/dsh-home/profiles/validation/package.json', 'utf8')
process.stdout.write(`${JSON.stringify({ listeners: 0, profiles })}\n`)
