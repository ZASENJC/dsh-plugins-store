import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require('/validator/node_modules/playwright')

const packageName = process.argv[2]
const expectedSelector = process.argv[3]
if (!packageName || !expectedSelector) throw new Error('Web smoke contract is missing')

const port = 3080
const server = spawn('dsh', ['web', '--host', '127.0.0.1', '--port', String(port)], {
  env: process.env,
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: false,
})
let serverError = ''
server.stderr.on('data', (chunk) => { serverError += String(chunk).slice(0, 4096) })

async function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error('DSH Web exited before becoming ready')
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error('DSH Web readiness deadline exceeded')
}

let browser
try {
  const url = `http://127.0.0.1:${port}/`
  await waitForServer(url, 30_000)
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const context = await browser.newContext()
  await context.tracing.start({ screenshots: true, snapshots: true })
  const page = await context.newPage()
  const consoleErrors = []
  const pageErrors = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 500))
  })
  page.on('pageerror', (error) => pageErrors.push(error.message.slice(0, 500)))
  const response = await page.goto(url, { waitUntil: 'domcontentloaded' })
  if (!response?.ok()) throw new Error(`DSH Web returned ${response?.status() ?? 'no response'}`)
  await page.waitForLoadState('domcontentloaded')
  await page.locator('body').waitFor({ state: 'visible' })
  await page.locator(expectedSelector).waitFor({ state: 'attached', timeout: 15_000 })
  await page.screenshot({ path: '/validation/artifacts/web-smoke.png', fullPage: true })
  await context.tracing.stop({ path: '/validation/artifacts/web-trace.zip' })
  if (consoleErrors.length > 0 || pageErrors.length > 0) {
    throw new Error(`Browser errors: ${consoleErrors.length + pageErrors.length}`)
  }
  process.stdout.write(`${JSON.stringify({ packageName, loaded: true, consoleErrors: 0, pageErrors: 0 })}\n`)
} catch (error) {
  if (serverError) process.stderr.write('DSH Web did not pass browser validation\n')
  throw error
} finally {
  await browser?.close()
  server.kill('SIGTERM')
}
