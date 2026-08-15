const CATALOG_ID = /^[A-Za-z0-9][A-Za-z0-9:_./-]{0,127}$/

export const DEFAULT_LOCAL_DSH_ORIGIN = 'http://127.0.0.1:3080'
export const DSH_PLUGIN_INSTALL_PARAM = 'dsh-plugin-id'

export function buildLocalDshInstallUrl(
  repositoryId: string,
  origin = DEFAULT_LOCAL_DSH_ORIGIN,
): string {
  if (!CATALOG_ID.test(repositoryId)) throw new Error('目录项目 ID 无效')

  const url = new URL('/', origin)
  const fragment = new URLSearchParams()
  fragment.set(DSH_PLUGIN_INSTALL_PARAM, repositoryId)
  url.hash = fragment.toString()
  return url.toString()
}
