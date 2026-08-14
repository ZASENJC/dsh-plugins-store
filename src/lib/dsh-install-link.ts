const REPOSITORY_FULL_NAME = /^[A-Za-z0-9](?:[A-Za-z0-9_.-]{0,99})\/[A-Za-z0-9](?:[A-Za-z0-9_.-]{0,99})$/

export const DEFAULT_LOCAL_DSH_ORIGIN = 'http://127.0.0.1:3080'
export const DSH_PLUGIN_INSTALL_PARAM = 'dsh-plugin-install'

export function buildLocalDshInstallUrl(
  fullName: string,
  origin = DEFAULT_LOCAL_DSH_ORIGIN,
): string {
  if (!REPOSITORY_FULL_NAME.test(fullName)) throw new Error('仓库名称无效')

  const url = new URL('/', origin)
  const fragment = new URLSearchParams()
  fragment.set(DSH_PLUGIN_INSTALL_PARAM, fullName)
  url.hash = fragment.toString()
  return url.toString()
}
