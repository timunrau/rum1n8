const SCRIPT_URL = import.meta.env?.VITE_UMAMI_SCRIPT_URL || ''
const WEBSITE_ID = import.meta.env?.VITE_UMAMI_WEBSITE_ID || ''

let optedOut = false
let scriptInjected = false
let flushTimer = null

const queuedEvents = []
const MAX_QUEUED_EVENTS = 20
const FLUSH_RETRY_LIMIT = 20

export function isAnalyticsConfigured() {
  return Boolean(SCRIPT_URL && WEBSITE_ID)
}

export function setAnalyticsOptOut(value) {
  optedOut = !!value
  if (optedOut) {
    queuedEvents.length = 0
  }
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
  script.addEventListener('load', () => scheduleFlushQueuedEvents())
  document.head.appendChild(script)
  scriptInjected = true
  scheduleFlushQueuedEvents()
}

function sendEvent(name, data) {
  const umami = typeof window !== 'undefined' ? window.umami : null
  if (!umami) return false

  try {
    if (typeof umami.track === 'function') {
      data ? umami.track(name, data) : umami.track(name)
      return true
    } else if (typeof umami === 'function') {
      data ? umami(name, data) : umami(name)
      return true
    }
  } catch {
    // Analytics must never break the app
  }
  return false
}

function scheduleFlushQueuedEvents(attempt = 0) {
  if (!analyticsEnabled() || flushTimer) return

  flushTimer = globalThis.setTimeout(() => {
    flushTimer = null
    if (!queuedEvents.length) return

    const sent = flushQueuedEvents()
    if (!sent && attempt < FLUSH_RETRY_LIMIT) {
      scheduleFlushQueuedEvents(attempt + 1)
    }
  }, 250)
}

function flushQueuedEvents() {
  if (!queuedEvents.length) return true
  const next = queuedEvents[0]
  if (!sendEvent(next.name, next.data)) return false

  queuedEvents.shift()
  while (queuedEvents.length) {
    const event = queuedEvents[0]
    if (!sendEvent(event.name, event.data)) return false
    queuedEvents.shift()
  }
  return true
}

export function trackEvent(name, data) {
  if (!analyticsEnabled() || !name) return
  if (sendEvent(name, data)) return

  queuedEvents.push({ name, data })
  if (queuedEvents.length > MAX_QUEUED_EVENTS) {
    queuedEvents.shift()
  }
  scheduleFlushQueuedEvents()
}
