export const LOCAL_INSTALL_REPOSITORY_ID_PARAM = 'dsh-plugin-id'

const CATALOG_ID = /^[A-Za-z0-9][A-Za-z0-9:_./-]{0,127}$/

export function consumeLocalInstallRequest({
  href = globalThis.location?.href,
  historyState = globalThis.history?.state,
  replaceState = globalThis.history?.replaceState?.bind(globalThis.history),
} = {}) {
  if (typeof href !== 'string') return null

  let url
  try {
    url = new URL(href)
  } catch {
    return null
  }

  const fragment = new URLSearchParams(url.hash.slice(1))
  let repositoryId

  if (fragment.has(LOCAL_INSTALL_REPOSITORY_ID_PARAM)) {
    repositoryId = fragment.get(LOCAL_INSTALL_REPOSITORY_ID_PARAM) ?? ''
    fragment.delete(LOCAL_INSTALL_REPOSITORY_ID_PARAM)
    url.hash = fragment.toString()
  } else if (url.searchParams.has(LOCAL_INSTALL_REPOSITORY_ID_PARAM)) {
    repositoryId = url.searchParams.get(LOCAL_INSTALL_REPOSITORY_ID_PARAM) ?? ''
    url.searchParams.delete(LOCAL_INSTALL_REPOSITORY_ID_PARAM)
  } else {
    return null
  }

  replaceState?.(historyState, '', `${url.pathname}${url.search}${url.hash}`)

  return CATALOG_ID.test(repositoryId) ? { repositoryId } : null
}
