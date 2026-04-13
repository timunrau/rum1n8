import './marketing.css'
import {
  APP_ROOT_PATH,
  ABOUT_PATH,
  getPreferredAppUrl,
  getUiState,
  normalizeAppUrl,
  shouldBypassMarketing,
} from './ui-state.js'

function getReturnTarget() {
  const params = new URLSearchParams(window.location.search)
  return normalizeAppUrl(params.get('returnTo'))
}

function updateAppLinks(target, label) {
  document.querySelectorAll('[data-app-link]').forEach((link) => {
    link.setAttribute('href', target)
  })

  document.querySelectorAll('[data-app-link-label]').forEach((node) => {
    node.textContent = label
  })
}

function updateReturnLink(target) {
  const banner = document.querySelector('[data-return-banner]')
  if (!banner) return

  if (!window.location.pathname.startsWith(ABOUT_PATH)) {
    banner.hidden = true
    return
  }

  banner.hidden = false
  banner.querySelectorAll('[data-return-link]').forEach((link) => {
    link.setAttribute('href', target)
  })
}

function initMarketingPage() {
  document.documentElement.dataset.page =
    window.location.pathname.startsWith(ABOUT_PATH) ? 'about' : 'home'

  const uiState = getUiState()
  const explicitReturnTarget = getReturnTarget()
  const appTarget = explicitReturnTarget || getPreferredAppUrl()
  const isReturning = shouldBypassMarketing() || !!explicitReturnTarget || !!uiState.lastAppUrl
  const appLabel = isReturning ? 'Open app' : 'Start memorizing'

  updateAppLinks(appTarget || APP_ROOT_PATH, appLabel)
  updateReturnLink(appTarget || APP_ROOT_PATH)
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMarketingPage, { once: true })
} else {
  initMarketingPage()
}
