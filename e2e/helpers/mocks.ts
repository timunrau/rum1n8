/**
 * Network mocks for E2E tests.
 * Mocks Bible API and WebDAV to avoid external dependencies.
 */

import type { BrowserContext, Page } from '@playwright/test'

/** Mock verse content returned by Bible API import */
export const MOCK_VERSE_CONTENT = 'For God so loved the world that he gave his one and only Son.'
export const MOCK_PSALM_1_VERSES = Array.from({ length: 6 }, (_, index) => `Psalm 1 verse ${index + 1}.`)
const BIBLE_API_URL_PATTERN = 'https://v1.fetch.bible/**'

/**
 * Serve the fetch.bible manifest and both fixture books. Register before navigation
 * so startup cache checks and interactive imports use the same data.
 */
export async function mockBibleApi(context: BrowserContext) {
  const books = {
    '/bibles/eng_bsb/txt/jhn.json': {
      book: 'jhn',
      name: { normal: 'John', long: 'John', abbrev: 'John' },
      contents: [[], [], [], [...Array.from({ length: 16 }, () => []), [MOCK_VERSE_CONTENT]]],
    },
    '/bibles/eng_bsb/txt/psa.json': {
      book: 'psa',
      name: { normal: 'Psalms', long: 'Psalms', abbrev: 'Psa' },
      contents: [[], [[], ...MOCK_PSALM_1_VERSES.map(verse => [verse])]],
    },
  }

  await context.route(BIBLE_API_URL_PATTERN, async (route) => {
    const { pathname } = new URL(route.request().url())
    if (route.request().method() !== 'GET') {
      await route.fulfill({ status: 405 })
      return
    }
    if (pathname === '/manifest.json') {
      await route.fulfill({
        json: {
          bibles: {
            eng_bsb: {
              name: {
                local: 'Berean Standard Bible',
                local_abbrev: 'BSB',
                english: 'Berean Standard Bible',
                english_abbrev: 'BSB',
              },
              year: 2020,
              books_ot: ['psa'],
              books_nt: ['jhn'],
              copyright: {
                attribution: 'Mock Bible',
                attribution_url: 'https://example.com/mock-bible',
                licenses: [{ license: 'mock-open', url: 'https://example.com/mock-license' }],
              },
              direction: 'ltr',
              tags: ['recommended'],
            },
          },
          glosses: {},
          notes: {},
          languages: {
            eng: {
              local: 'English',
              english: 'English',
              pop: 400000000,
              direction: 'ltr',
            },
          },
          language2to3: {
            en: 'eng',
          },
          languages_most_spoken: ['eng'],
          books_ordered: ['psa', 'jhn'],
          book_names_english: {
            psa: 'Psalms',
            jhn: 'John',
          },
          licenses: {
            'mock-open': {
              name: 'Mock Open License',
              restrictions: {
                forbid_limitless: false,
                forbid_commercial: false,
                forbid_derivatives: false,
                forbid_attributionless: false,
                forbid_other: false,
              },
            },
          },
        },
      })
      return
    }
    const book = books[pathname as keyof typeof books]
    await route.fulfill(book ? { json: book } : { status: 404 })
  })
}

export async function blockBibleApi(context: BrowserContext) {
  // Playwright can fulfill a routed request even when the browser is offline.
  await context.route(BIBLE_API_URL_PATTERN, route => route.abort('internetdisconnected'))
}

/** Serve the connection probe on the direct endpoint or the app's hosted proxy. */
export async function mockWebDAVConnection(context: BrowserContext, serverUrl: string, baseURL?: string) {
  const proxyUrl = baseURL && new URL(`/api/webdav${new URL(serverUrl).pathname}`, baseURL).href
  const corsHeaders = { 'access-control-allow-origin': '*' }

  await context.route(url => url.href === serverUrl || url.href === proxyUrl, async (route) => {
    const method = route.request().method()
    if (method === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          ...corsHeaders,
          'access-control-allow-methods': 'PROPFIND',
          'access-control-allow-headers': 'Authorization, Depth',
        },
      })
      return
    }
    if (method === 'PROPFIND') {
      await route.fulfill({
        status: 207,
        headers: corsHeaders,
        contentType: 'application/xml',
        body: '<?xml version="1.0"?><multistatus xmlns="DAV:"/>',
      })
      return
    }
    await route.fulfill({ status: 405, headers: corsHeaders })
  })
}

/**
 * Mock WebDAV sync to return stale remote data with a FUTURE lastReviewed timestamp.
 * Reproduces the bug: merge incorrectly preferred remote (future date "newer") and
 * overwrote local's freshly updated nextReviewDate/interval.
 */
export async function mockWebDAVWithStaleRemoteWithFutureTimestamp(
  page: Page,
  staleVerse: { id: string; reference: string; [k: string]: unknown }
) {
  const futureDate = new Date(Date.now() + 10 * 86400000).toISOString()
  const verseWithFutureTimestamp = {
    ...staleVerse,
    lastReviewed: futureDate,
    lastModified: futureDate,
    interval: staleVerse.interval ?? 14,
    nextReviewDate: staleVerse.nextReviewDate ?? new Date(Date.now() - 86400000).toISOString(),
  }
  const syncBody = JSON.stringify({
    verses: [verseWithFutureTimestamp],
    collections: [],
    deletedVerses: [],
    deletedCollections: [],
    syncedAt: futureDate,
  })

  await page.route('**/localhost:3001/**', async (route) => {
    const req = route.request()
    const url = req.url()
    const method = req.method()
    if (method === 'PROPFIND' || method === 'OPTIONS') {
      await route.fulfill({ status: 207, body: '<?xml version="1.0"?><multistatus/>' })
      return
    }
    if (method === 'GET' && (url.includes('rum1n8-data') || url.includes('bible-memory-data'))) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: syncBody })
      return
    }
    await route.continue()
  })
}
