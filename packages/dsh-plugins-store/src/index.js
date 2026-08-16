import { runNativeCommand } from '@deepseek-ai/dsh-native-command'
import { createInstallHandler, installPlan } from './installer.js'
import { createInventoryHandler, createRemoveHandler, listInstalledPlugins, removeInstalledPlugin } from './plugin-manager.js'
import { loadBundledStoreSkill } from './store-skill.js'
import { createStoreApprovalGate, createStoreTools } from './store-search.js'

export const name = 'dsh-plugins-store'
export const inject = ['commands', 'webServer', 'tools', 'skills']

const INSTALL_PATH = '/api/dsh-plugins-store/install'
const INVENTORY_PATH = '/api/dsh-plugins-store/plugins'
const REMOVE_PATH = '/api/dsh-plugins-store/remove'

function runnerOptions(signal = new AbortController().signal) {
  return {
    runner: runNativeCommand,
    execPath: process.execPath,
    cliPath: process.argv[1],
    signal,
  }
}

function storeToolOptions() {
  return {
    listInstalled: (signal) => listInstalledPlugins(runnerOptions(signal)),
    install: (plan, signal) => installPlan(plan, runnerOptions(signal)),
    remove: (packageName, installed, signal) => removeInstalledPlugin(packageName, {
      ...runnerOptions(signal),
      installed,
    }),
  }
}

export function apply(ctx) {
  const storeSkill = loadBundledStoreSkill()

  ctx.commands.register({
    name: 'store',
    description: 'Browse the DSH plugin store',
    handler: ({ rawInput }) => rawInput.trim() === ''
      ? { kind: 'success' }
      : { kind: 'error', text: 'Usage: /store' },
  })

  for (const tool of createStoreTools(storeToolOptions())) ctx.tools.register(tool)
  ctx.on('tools/pre-execute', createStoreApprovalGate())
  ctx.skills.register(storeSkill)

  ctx.webServer.register({
    kind: 'exact',
    path: INSTALL_PATH,
    handler: createInstallHandler({
      install: (plan) => installPlan(plan, {
        ...runnerOptions(),
      }),
    }),
  })

  ctx.webServer.register({
    kind: 'exact',
    path: INVENTORY_PATH,
    handler: createInventoryHandler({
      list: () => listInstalledPlugins(runnerOptions()),
    }),
  })

  ctx.webServer.register({
    kind: 'exact',
    path: REMOVE_PATH,
    handler: createRemoveHandler({
      remove: async (name) => removeInstalledPlugin(name, {
        ...runnerOptions(),
        installed: await listInstalledPlugins(runnerOptions()),
      }),
    }),
  })
}
