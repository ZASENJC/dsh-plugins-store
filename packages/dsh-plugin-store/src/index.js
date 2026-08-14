export const name = 'dsh-plugin-store'
export const inject = ['commands']

export function apply(ctx) {
  ctx.commands.register({
    name: 'store',
    description: 'Browse the DSH plugin store',
    handler: ({ rawInput }) => rawInput.trim() === ''
      ? { kind: 'success' }
      : { kind: 'error', text: 'Usage: /store' },
  })
}
