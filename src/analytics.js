const SCRIPT_URL = import.meta.env?.VITE_UMAMI_SCRIPT_URL || ''
const WEBSITE_ID = import.meta.env?.VITE_UMAMI_WEBSITE_ID || ''

let optedOut = false
let scriptInjected = false

export function isAnalyticsConfigured() {
  return Boolean(SCRIPT_URL && WEBSITE_ID)
}

export function setAnalyticsOptOut(value) {
  optedOut = !!value
}

function analyticsEnabled() {
  return isAnalyticsConfigured() && !optedOut && typeof document !== 'undefined'
}

export function initAnalytics({ optOut = false } = {}) {
  setAnalyticsOptOut(optOut)
  if (!analyticsEnabled() || scriptInjected) return

  const script = document.createElement('script')
  script.async = true
  script.defer = true
  script.src = SCRIPT_URL
  script.setAttribute('data-website-id', WEBSITE_ID)
  script.setAttribute('data-auto-track', 'true')
  document.head.appendChild(script)
  scriptInjected = true
}

export function trackEvent(name, data) {
  if (!analyticsEnabled() || !name) return
  const umami = typeof window !== 'undefined' ? window.umami : null
  if (!umami) return

  try {
    if (typeof umami.track === 'function') {
      data ? umami.track(name, data) : umami.track(name)
    } else if (typeof umami === 'function') {
      data ? umami(name, data) : umami(name)
    }
  } catch {
    // Analytics must never break the app
  }
}
