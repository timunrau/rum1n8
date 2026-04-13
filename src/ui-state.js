export const UI_STATE_KEY = 'rum1n8-ui-state'
export const APP_ROOT_PATH = '/app/'
export const ABOUT_PATH = '/about/'

const DEFAULT_UI_STATE = Object.freeze({
  hasOpenedApp: false,
  lastAppUrl: null,
})

const LEGACY_APP_PRESENCE_KEYS = [
  'rum1n8-verses',
  'rum1n8-collections',
  'rum1n8-app-settings',
  'rum1n8-webdav-settings',
  'rum1n8-gdrive-settings',
  'rum1n8-sync-provider',
  'rum1n8-sync-state',
  'rum1n8-last-backup',
  'bible-memory-verses',
  'bible-memory-collections',
  'bible-memory-webdav-settings',
  'bible-memory-sync-state',
  'bible-memory-last-backup',
]

function getBaseOrigin() {
  return typeof window === 'undefined' ? 'https://rum1n8.local' : window.location.origin
}

export function normalizeAppUrl(value) {
  if (!value || typeof value !== 'string') return null

  try {
    const url = new URL(value, getBaseOrigin())

    if (url.pathname === '/app' || url.pathname === '/app/index.html') {
      url.pathname = APP_ROOT_PATH
    }

    if (!url.pathname.startsWith(APP_ROOT_PATH)) {
      return null
    }

    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return null
  }
}

export function normalizeUiState(state = {}) {
  return {
    ...DEFAULT_UI_STATE,
    ...(state && typeof state === 'object' && !Array.isArray(state) ? state : {}),
    hasOpenedApp: !!state?.hasOpenedApp,
    lastAppUrl: normalizeAppUrl(state?.lastAppUrl),
  }
}

export function getUiState() {
  if (typeof window === 'undefined') {
    return normalizeUiState()
  }

  const stored = localStorage.getItem(UI_STATE_KEY)
  if (!stored) {
    return normalizeUiState()
  }

  try {
    return normalizeUiState(JSON.parse(stored))
  } catch {
    return normalizeUiState()
  }
}

export function saveUiState(state) {
  if (typeof window === 'undefined') {
    return normalizeUiState(state)
  }

  const normalized = normalizeUiState(state)
  localStorage.setItem(UI_STATE_KEY, JSON.stringify(normalized))
  return normalized
}

export function updateUiState(patch) {
  const current = getUiState()
  return saveUiState({
    ...current,
    ...patch,
  })
}

export function getCurrentAppUrl() {
  if (typeof window === 'undefined') return APP_ROOT_PATH
  return normalizeAppUrl(
    `${window.location.pathname}${window.location.search}${window.location.hash}`
  ) || APP_ROOT_PATH
}

export function rememberAppUrl(url = getCurrentAppUrl()) {
  const normalizedUrl = normalizeAppUrl(url)
  if (!normalizedUrl) {
    return getUiState()
  }

  return updateUiState({
    hasOpenedApp: true,
    lastAppUrl: normalizedUrl,
  })
}

export function markAppOpened(url = getCurrentAppUrl()) {
  return rememberAppUrl(url)
}

export function getPreferredAppUrl(explicitUrl = null) {
  const normalizedExplicitUrl = normalizeAppUrl(explicitUrl)
  if (normalizedExplicitUrl) return normalizedExplicitUrl

  const state = getUiState()
  return state.lastAppUrl || APP_ROOT_PATH
}

export function isStandaloneAppLaunch() {
  if (typeof window === 'undefined') return false

  return (
    window.navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  )
}

export function hasLegacyAppPresence() {
  if (typeof window === 'undefined') return false

  return LEGACY_APP_PRESENCE_KEYS.some((key) => localStorage.getItem(key) !== null)
}

export function shouldBypassMarketing() {
  const state = getUiState()
  return state.hasOpenedApp || hasLegacyAppPresence() || isStandaloneAppLaunch()
}

export function buildAboutUrl(returnTo = getCurrentAppUrl()) {
  const url = new URL(ABOUT_PATH, getBaseOrigin())
  const normalizedReturnTo = normalizeAppUrl(returnTo)

  if (normalizedReturnTo) {
    url.searchParams.set('returnTo', normalizedReturnTo)
  }

  return `${url.pathname}${url.search}${url.hash}`
}
