const SCRIPT_URL = import.meta.env?.VITE_UMAMI_SCRIPT_URL || ''
const WEBSITE_ID = import.meta.env?.VITE_UMAMI_MARKETING_WEBSITE_ID || ''
const OPT_OUT_KEY = 'rum1n8-marketing-analytics-opt-out'

let optedOut = readOptOut()

function readOptOut() {
  try {
    return localStorage.getItem(OPT_OUT_KEY) === 'true'
  } catch {
    return false
  }
}

function writeOptOut(value) {
  optedOut = !!value
  try {
    localStorage.setItem(OPT_OUT_KEY, String(optedOut))
  } catch {
    // Storage availability must never affect the page.
  }
}

export function initMarketingAnalytics() {
  if (optedOut || !SCRIPT_URL || !WEBSITE_ID || typeof document === 'undefined') return

  const script = document.createElement('script')
  script.async = true
  script.defer = true
  script.src = SCRIPT_URL
  script.dataset.websiteId = WEBSITE_ID
  script.dataset.autoTrack = 'true'
  document.head.appendChild(script)
}

export function initMarketingAnalyticsPreference() {
  const control = document.querySelector('[data-marketing-analytics-opt-out]')
  if (!control) return

  control.checked = optedOut
  control.addEventListener('change', () => {
    writeOptOut(control.checked)
    window.location.reload()
  })
}

export function trackMarketingEvent(name, data) {
  if (optedOut || !name) return

  try {
    window.umami?.track?.(name, data)
  } catch {
    // Analytics must never interrupt rendering or navigation.
  }
}
