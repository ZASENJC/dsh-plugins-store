export const LOCAL_INSTALL_PARAM = 'dsh-plugin-install'

const REPOSITORY_FULL_NAME = /^[A-Za-z0-9](?:[A-Za-z0-9_.-]{0,99})\/[A-Za-z0-9](?:[A-Za-z0-9_.-]{0,99})$/

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
  let fullName

  if (fragment.has(LOCAL_INSTALL_PARAM)) {
    fullName = fragment.get(LOCAL_INSTALL_PARAM) ?? ''
    fragment.delete(LOCAL_INSTALL_PARAM)
    url.hash = fragment.toString()
  } else if (url.searchParams.has(LOCAL_INSTALL_PARAM)) {
    fullName = url.searchParams.get(LOCAL_INSTALL_PARAM) ?? ''
    url.searchParams.delete(LOCAL_INSTALL_PARAM)
  } else {
    return null
  }

  replaceState?.(historyState, '', `${url.pathname}${url.search}${url.hash}`)

  return REPOSITORY_FULL_NAME.test(fullName) ? fullName : null
}
