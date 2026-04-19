import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  APP_ROOT_PATH,
  UI_STATE_KEY,
  buildAboutUrl,
  getOnboardingUiState,
  getPreferredAppUrl,
  normalizeAppUrl,
  rememberAppUrl,
  shouldBypassMarketing,
} from './ui-state.js'

function setupBrowserEnv({
  url = 'https://example.test/app/',
  standalone = false,
} = {}) {
  const parsedUrl = new URL(url)
  const store = {}

  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key) => store[key] ?? null),
    setItem: vi.fn((key, value) => {
      store[key] = value
    }),
    removeItem: vi.fn((key) => {
      delete store[key]
    }),
  })

  vi.stubGlobal('window', {
    location: {
      origin: parsedUrl.origin,
      pathname: parsedUrl.pathname,
      search: parsedUrl.search,
      hash: parsedUrl.hash,
    },
    navigator: {
      standalone,
    },
    matchMedia: vi.fn(() => ({ matches: standalone })),
  })

  return store
}

describe('ui-state', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('normalizes app URLs and rejects non-app paths', () => {
    expect(normalizeAppUrl('/app')).toBe(APP_ROOT_PATH)
    expect(normalizeAppUrl('/app/index.html?view=stats')).toBe('/app/?view=stats')
    expect(normalizeAppUrl('https://example.test/app/?view=review-list#top')).toBe(
      '/app/?view=review-list#top'
    )
    expect(normalizeAppUrl('/about/')).toBeNull()
    expect(normalizeAppUrl('/')).toBeNull()
  })

  it('remembers the current app URL and marks the app as opened', () => {
    const store = setupBrowserEnv({ url: 'https://example.test/app/?view=stats' })

    const result = rememberAppUrl()

    expect(result).toEqual({
      hasOpenedApp: true,
      lastAppUrl: '/app/?view=stats',
    })
    expect(JSON.parse(store[UI_STATE_KEY])).toEqual(result)
  })

  it('prefers an explicit app URL and otherwise falls back to saved state', () => {
    const store = setupBrowserEnv()
    store[UI_STATE_KEY] = JSON.stringify({
      hasOpenedApp: true,
      lastAppUrl: '/app/?view=review-list',
    })

    expect(getPreferredAppUrl('/app/?view=stats')).toBe('/app/?view=stats')
    expect(getPreferredAppUrl()).toBe('/app/?view=review-list')
  })

  it('bypasses marketing when app data already exists or launch is standalone', () => {
    let store = setupBrowserEnv()
    expect(shouldBypassMarketing()).toBe(false)

    store['rum1n8-verses'] = '[]'
    expect(shouldBypassMarketing()).toBe(true)

    store = setupBrowserEnv({ standalone: true })
    expect(store[UI_STATE_KEY]).toBeUndefined()
    expect(shouldBypassMarketing()).toBe(true)
  })

  it('builds about URLs with a normalized return target', () => {
    setupBrowserEnv({ url: 'https://example.test/app/?view=stats' })

    expect(buildAboutUrl('/app/?view=review-list')).toBe('/about/?returnTo=%2Fapp%2F%3Fview%3Dreview-list')
    expect(buildAboutUrl('/')).toBe('/about/')
    expect(buildAboutUrl()).toBe('/about/?returnTo=%2Fapp%2F%3Fview%3Dstats')
  })

  it('normalizes legacy onboarding state into the current review CTA flow', () => {
    const store = setupBrowserEnv()
    store[UI_STATE_KEY] = JSON.stringify({
      guidedOnboardingStep: 'review-tab',
      guidedOnboardingVerseId: 'verse-1',
      practiceModesHintSeen: true,
    })

    expect(getOnboardingUiState()).toEqual({
      onboardingDismissed: false,
      practiceModeHintsSeen: {
        learn: true,
        memorize: true,
        master: true,
      },
      practiceModesHintSeen: true,
      guidedOnboardingStep: 'review-cta',
      guidedOnboardingVerseId: 'verse-1',
    })
  })
})
