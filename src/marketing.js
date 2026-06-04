import './marketing.css'
import bibleMemoryBookmarkletUrl from '../scripts/biblememory-migration/bookmarklet.min.js?raw'
import { initAnalytics, trackEvent } from './analytics.js'
import { getAppSettings } from './app-settings.js'
import {
  APP_ROOT_PATH,
  BIBLEMEMORY_IMPORT_PATH,
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

function initBibleMemoryImportPage() {
  const bookmarkletUrl = bibleMemoryBookmarkletUrl.trim()

  document.querySelectorAll('[data-biblememory-bookmarklet]').forEach((link) => {
    link.setAttribute('href', bookmarkletUrl)
  })

  document.querySelectorAll('[data-biblememory-bookmarklet-code]').forEach((node) => {
    node.textContent = bookmarkletUrl
  })

  document.querySelectorAll('[data-copy-bookmarklet]').forEach((button) => {
    button.addEventListener('click', async () => {
      const codeNode = document.querySelector('[data-biblememory-bookmarklet-code]')
      if (!codeNode) return

      try {
        await navigator.clipboard.writeText(codeNode.textContent)
      } catch (err) {
        // Fallback for older browsers
        const textarea = document.createElement('textarea')
        textarea.value = codeNode.textContent
        textarea.style.position = 'fixed'
        textarea.style.left = '-9999px'
        document.body.appendChild(textarea)
        textarea.select()
        try {
          document.execCommand('copy')
        } catch (copyErr) {
          console.error('Failed to copy text: ', copyErr)
        }
        document.body.removeChild(textarea)
      }

      button.classList.add('copied')
      const originalSvg = button.innerHTML
      button.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      `
      
      setTimeout(() => {
        button.classList.remove('copied')
        button.innerHTML = originalSvg
      }, 2000)
    })
  })
}

function initMarketingPage() {
  const pathname = window.location.pathname
  document.documentElement.dataset.page =
    pathname.startsWith(BIBLEMEMORY_IMPORT_PATH)
      ? 'biblememory-import'
      : pathname.startsWith(TIPS_PATH)
        ? 'tips'
        : 'home'

  const uiState = getUiState()
  const explicitReturnTarget = getReturnTarget()
  const appTarget = explicitReturnTarget || getPreferredAppUrl()
  const isReturning = shouldBypassMarketing() || !!explicitReturnTarget || !!uiState.lastAppUrl
  const appLabel = isReturning ? 'Open app' : 'Start memorizing'
  const shouldShowReturnLink =
    !!explicitReturnTarget ||
    ((pathname.startsWith(TIPS_PATH) || pathname.startsWith(BIBLEMEMORY_IMPORT_PATH)) && isReturning)

  updateAppLinks(appTarget || APP_ROOT_PATH, appLabel)
  updateReturnLink(appTarget || APP_ROOT_PATH, shouldShowReturnLink)

  if (pathname.startsWith(BIBLEMEMORY_IMPORT_PATH)) {
    initBibleMemoryImportPage()
  }
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
