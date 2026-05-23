import './marketing.css'
import { initAnalytics, trackEvent } from './analytics.js'
import { getAppSettings } from './app-settings.js'
import {
  APP_ROOT_PATH,
  TIPS_PATH,
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

function updateReturnLink(target, isVisible) {
  const banner = document.querySelector('[data-return-banner]')
  if (!banner) return

  if (!isVisible) {
    banner.hidden = true
    return
  }

  banner.hidden = false
  banner.querySelectorAll('[data-return-link]').forEach((link) => {
    link.setAttribute('href', target)
  })
}

function initMarketingPage() {
  const pathname = window.location.pathname
  document.documentElement.dataset.page =
    pathname.startsWith(TIPS_PATH) ? 'tips' : 'home'

  const uiState = getUiState()
  const explicitReturnTarget = getReturnTarget()
  const appTarget = explicitReturnTarget || getPreferredAppUrl()
  const isReturning = shouldBypassMarketing() || !!explicitReturnTarget || !!uiState.lastAppUrl
  const appLabel = isReturning ? 'Open app' : 'Start memorizing'
  const shouldShowReturnLink =
    !!explicitReturnTarget || (pathname.startsWith(TIPS_PATH) && isReturning)

  updateAppLinks(appTarget || APP_ROOT_PATH, appLabel)
  updateReturnLink(appTarget || APP_ROOT_PATH, shouldShowReturnLink)
}

function initTrackedMarketingLinks() {
  document.querySelectorAll('[data-marketing-track]').forEach((link) => {
    link.addEventListener('click', () => {
      trackEvent(link.getAttribute('data-marketing-track'), {
        href: link.getAttribute('href') || '',
        page: window.location.pathname,
      })
    })
  })
}

initAnalytics({ optOut: getAppSettings().analyticsOptOut })

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initMarketingPage()
    initTrackedMarketingLinks()
  }, { once: true })
} else {
  initMarketingPage()
  initTrackedMarketingLinks()
}
