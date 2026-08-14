import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { WebSocketServer } = require('/validator/node_modules/ws')
const contract = JSON.parse(Buffer.from(process.argv[2] ?? '', 'base64url').toString('utf8'))
let hits = 0

function waitForExit(child, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error('Channel smoke deadline exceeded'))
    }, timeoutMs)
    child.once('error', reject)
    child.once('exit', (code) => {
      clearTimeout(timeout)
      code === 0 ? resolve() : reject(new Error(`Channel smoke exited ${code}`))
    })
  })
}

let closeMock
let endpoint
if (contract.protocol === 'http') {
  const server = createServer((request, response) => {
    if (request.method !== contract.request.method || request.url !== contract.request.path) {
      response.writeHead(404).end()
      return
    }
    hits += 1
    response.writeHead(contract.response.status, { 'content-type': 'application/json' })
    response.end(JSON.stringify(contract.response.body))
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  endpoint = `http://127.0.0.1:${address.port}`
  closeMock = () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
} else {
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0 })
  await new Promise((resolve) => server.once('listening', resolve))
  server.on('connection', (socket) => {
    socket.on('message', () => {
      hits += 1
      socket.send(JSON.stringify(contract.response.body))
    })
  })
  const address = server.address()
  endpoint = `ws://127.0.0.1:${address.port}`
  closeMock = () => new Promise((resolve) => server.close(resolve))
}

try {
  const child = spawn(contract.smokeCommand[0], contract.smokeCommand.slice(1), {
    cwd: '/validation/workspace/plugin',
    env: { ...process.env, [contract.endpointEnv]: endpoint },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  })
  await waitForExit(child, 60_000)
  if (hits === 0) throw new Error('Channel smoke did not reach the local mock')
  process.stdout.write(`${JSON.stringify({ protocol: contract.protocol, hits })}\n`)
} finally {
  await closeMock()
}
