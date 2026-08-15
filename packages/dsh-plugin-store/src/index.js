import { runNativeCommand } from '@deepseek-ai/dsh-native-command'
import { createInstallHandler, installPlan } from './installer.js'

export const name = 'dsh-plugin-store'
export const inject = ['commands', 'webServer']

const INSTALL_PATH = '/api/dsh-plugin-store/install'

export function apply(ctx) {
  ctx.commands.register({
    name: 'store',
    description: 'Browse the DSH plugin store',
    handler: ({ rawInput }) => rawInput.trim() === ''
      ? { kind: 'success' }
      : { kind: 'error', text: 'Usage: /store' },
  })

  ctx.webServer.register({
    kind: 'exact',
    path: INSTALL_PATH,
    handler: createInstallHandler({
      install: (plan) => installPlan(plan, {
        runner: runNativeCommand,
        execPath: process.execPath,
        cliPath: process.argv[1],
        signal: new AbortController().signal,
      }),
    }),
  })
}
