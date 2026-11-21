import './navigation.js'
import {
  initMarketingAnalytics,
  initMarketingAnalyticsPreference,
  trackMarketingEvent,
} from './marketing-analytics.js'

const APP_ROOT_PATH = '/app/'
const APP_URL = document.body.dataset.appUrl

function getReturnTarget() {
  const params = new URLSearchParams(window.location.search)
  const value = params.get('returnTo')
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null

  try {
    const url = new URL(value, 'https://rum1n8.invalid')
    if (url.origin !== 'https://rum1n8.invalid') return null
    if (url.pathname === '/app' || url.pathname === '/app/index.html') url.pathname = APP_ROOT_PATH
    if (!url.pathname.startsWith(APP_ROOT_PATH)) return null
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return null
  }
}

function getAppTarget(returnTarget = null) {
  return returnTarget ? new URL(returnTarget.replace(/^\//, ''), new URL('/', APP_URL)).toString() : APP_URL
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

  banner.querySelector('[data-return-link]').href = target
  banner.hidden = false
}

function preserveReturnTarget(returnTarget) {
  if (!returnTarget) return

  document.querySelectorAll('a[href]').forEach((link) => {
    const href = link.getAttribute('href')
    if (!href || href.startsWith('#')) return

    const url = new URL(href, window.location.href)
    if (url.origin !== window.location.origin || !/^\/(?:[a-z0-9-]+\/)*$/.test(url.pathname)) return

    url.searchParams.set('returnTo', returnTarget)
    link.setAttribute('href', `${url.pathname}${url.search}${url.hash}`)
  })
}

function initBibleMemoryImportPage() {
  document.querySelectorAll('[data-copy-bookmarklet]').forEach((button) => {
    button.hidden = false
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
  const explicitReturnTarget = getReturnTarget()
  const appTarget = getAppTarget(explicitReturnTarget)
  const appLabel = explicitReturnTarget ? 'Open app' : 'Start memorizing'

  updateAppLinks(appTarget, appLabel)
  updateReturnLink(appTarget, !!explicitReturnTarget)
  preserveReturnTarget(explicitReturnTarget)

  initBibleMemoryImportPage()
}

function initTrackedMarketingLinks() {
  document.querySelectorAll('[data-marketing-track]').forEach((link) => {
    link.addEventListener('click', () => {
      trackMarketingEvent(link.getAttribute('data-marketing-track'), {
        href: link.getAttribute('href') || '',
        page: window.location.pathname,
      })
    })
  })
}

initMarketingAnalytics()

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initMarketingPage()
    initTrackedMarketingLinks()
    initMarketingAnalyticsPreference()
  }, { once: true })
} else {
  initMarketingPage()
  initTrackedMarketingLinks()
  initMarketingAnalyticsPreference()
}
