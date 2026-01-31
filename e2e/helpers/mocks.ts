/**
 * Network mocks for E2E tests.
 * Mocks Bible API and WebDAV to avoid external dependencies.
 */

import type { Page } from '@playwright/test'

/** Mock verse content returned by Bible API import */
export const MOCK_VERSE_CONTENT = 'For God so loved the world that he gave his one and only Son.'

/**
 * Setup Bible API mock for importVerseContent.
 * Intercepts fetch.bible requests and returns mock book/verse data.
 */
export async function mockBibleApi(page: Page, verseContent = MOCK_VERSE_CONTENT) {
  await page.route(/.*fetch\.bible.*/, async (route) => {
    const url = route.request().url()
    // Return mock manifest or book data based on URL
    if (url.includes('manifest')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          collections: [
            {
              id: 'eng',
              translations: [{ id: 'eng_bsb' }],
            },
          ],
        }),
      })
      return
    }
    if (url.includes('.json') && !url.includes('manifest')) {
      // Book format - return minimal structure with verse content
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          chapters: {
            '3': {
              verses: {
                '16': verseContent,
              },
            },
          },
        }),
      })
      return
    }
    await route.continue()
  })
}

/**
 * Setup WebDAV mock for test connection and sync.
 * Intercepts requests to common WebDAV paths.
 */
export async function mockWebDAV(page: Page, options?: { failSync?: boolean }) {
  await page.route('**/remote.php/webdav/**', async (route) => {
    const method = route.request().method()
    if (method === 'PROPFIND' || method === 'OPTIONS') {
      await route.fulfill({ status: 207, body: '<?xml version="1.0"?><multistatus/>' })
      return
    }
    if (method === 'PUT' && options?.failSync) {
      await route.fulfill({ status: 500 })
      return
    }
    if (method === 'GET' && route.request().url().includes('bible-memory')) {
      await route.fulfill({ status: 404 })
      return
    }
    await route.continue()
  })

  // Also mock requests to localhost proxy (dev)
  await page.route('**/localhost:**/webdav/**', async (route) => {
    const method = route.request().method()
    if (method === 'PROPFIND' || method === 'OPTIONS') {
      await route.fulfill({ status: 207, body: '<?xml version="1.0"?><multistatus/>' })
      return
    }
    await route.continue()
  })
}
