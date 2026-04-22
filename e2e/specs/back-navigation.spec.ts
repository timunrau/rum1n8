/**
 * Browser back-button and in-app back-button behavior.
 *
 * Core rule: back always goes up a level, it never cycles through previously
 * viewed verses or previously visited top-level tabs.
 */

import { test, expect } from '@playwright/test'
import { clearAppStorage, seedStorage } from '../helpers/storage'
import { gotoApp } from '../helpers/navigation'

const yesterday = () => new Date(Date.now() - 86400000).toISOString()

function masteredVerse(overrides: Record<string, unknown> = {}) {
  return {
    id: 'v1',
    reference: 'Psalm 1:1',
    content: 'Blessed is',
    bibleVersion: 'BSB',
    createdAt: new Date().toISOString(),
    lastModified: new Date().toISOString(),
    memorizationStatus: 'mastered',
    reviewCount: 1,
    lastReviewed: yesterday(),
    nextReviewDate: yesterday(),
    easeFactor: 2.5,
    interval: 1,
    reviewHistory: [],
    collectionIds: [],
    ...overrides,
  }
}

test.beforeEach(async ({ page }) => {
  await gotoApp(page)
  await clearAppStorage(page)
  await page.reload()
})

test.describe('Top-level tab switches', () => {
  test('switching between tabs does not stack history entries', async ({ page }) => {
    await page.getByTestId('nav-review').click()
    await expect(page).toHaveURL(/\?view=review-list/)

    await page.getByTestId('nav-stats').click()
    await expect(page).toHaveURL(/\?view=stats/)

    await page.getByTestId('nav-collections').click()
    await expect(page).toHaveURL(/\?view=collections/)

    // Each tab replaces rather than pushes, so the history only holds the
    // current entry plus whatever was before the app loaded. Browser-back
    // from here should NOT return to Stats.
    await page.goBack()
    await expect(page).not.toHaveURL(/\?view=stats/)
    await expect(page).not.toHaveURL(/\?view=review-list/)
  })
})

test.describe('Collection navigation', () => {
  test('back button inside a collection goes up to top level, not back into the collection', async ({
    page,
  }) => {
    const collection = {
      id: 'col-1',
      name: 'My Collection',
      description: '',
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
    }
    await seedStorage(page, [masteredVerse({ collectionIds: ['col-1'] })], [collection])
    await page.reload()
    await gotoApp(page, '?view=collections')

    await page.getByText('My Collection').click()
    await expect(page).toHaveURL(/\?view=collection&collection=col-1/)

    // In-app back (chevron in collection header)
    await page.locator('header button').first().click()
    await expect(page).not.toHaveURL(/collection=col-1/)

    // Browser-back from top level should not re-enter the collection.
    await page.goBack()
    await expect(page).not.toHaveURL(/collection=col-1/)
  })
})

test.describe('Review screen back behavior', () => {
  test('browser back from review returns to review list (not to a prior verse)', async ({
    page,
  }) => {
    const due1 = masteredVerse({
      id: 'r1',
      reference: 'Psalm 1:1',
      content: 'Blessed is',
      nextReviewDate: new Date(Date.now() - 2 * 86400000).toISOString(),
    })
    const due2 = masteredVerse({
      id: 'r2',
      reference: 'Psalm 2:1',
      content: 'Why the',
      nextReviewDate: yesterday(),
    })
    await seedStorage(page, [due1, due2], [])
    await page.reload()
    await gotoApp(page, '?view=review-list')

    await page.getByText('Psalm 1:1').click()
    await expect(page.locator('#letter-input-review')).toBeAttached()
    await page.locator('#letter-input-review').focus()
    await page.keyboard.type('bi', { delay: 50 })

    // Advance to the next verse — sequential navigation replaces history.
    await page.getByRole('button', { name: 'Next Verse' }).click()
    await expect(page.locator('h1')).toContainText('Psalm 2:1')

    // Browser back: must NOT return to Psalm 1:1 review. Must exit to review list.
    await page.goBack()
    await expect(page.locator('#letter-input-review')).not.toBeVisible()
    await expect(page.getByText('Psalm 1:1')).toBeVisible()
    await expect(page.getByText('Psalm 2:1')).toBeVisible()
  })

  test('in-app back from review does not leave a review entry in history', async ({ page }) => {
    const verse = masteredVerse({ id: 'r3', reference: 'Psalm 3:1', content: 'O Lord how' })
    await seedStorage(page, [verse], [])
    await page.reload()
    await gotoApp(page, '?view=review-list')

    await page.getByText('Psalm 3:1').click()
    await expect(page.locator('#letter-input-review')).toBeAttached()

    // Tap in-app back (chevron in review header)
    await page.locator('header button').first().click()
    await expect(page.locator('#letter-input-review')).not.toBeVisible()
    await expect(page).toHaveURL(/\?view=review-list/)

    // Browser back must NOT re-enter the review session.
    await page.goBack()
    await expect(page.locator('#letter-input-review')).not.toBeVisible()
  })
})

test.describe('Memorization screen back behavior', () => {
  test('browser back from memorization exits to source screen, does not cycle modes', async ({
    page,
  }) => {
    const verse = masteredVerse({
      id: 'm1',
      reference: 'Psalm 4:1',
      content: 'Answer me',
      memorizationStatus: 'unmemorized',
      nextReviewDate: null,
      interval: 0,
      reviewCount: 0,
      lastReviewed: null,
    })
    const collection = {
      id: 'c-mem',
      name: 'Test Mem',
      description: '',
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
    }
    await seedStorage(page, [verse], [collection])
    await page.reload()
    await gotoApp(page, '?view=collections')

    // Enter memorization (starts in "learn" mode)
    await expect(page.getByText('All Verses')).toBeVisible({ timeout: 5000 })
    await page.getByText('All Verses').click()
    await page.waitForTimeout(500)
    await page.getByText('Psalm 4:1').first().click()
    await expect(page.locator('#letter-input-memorize')).toBeAttached()
    await expect(page).toHaveURL(/view=memorization/)

    // Browser back: must go up to Collections, not into a prior mode or another verse
    await page.goBack()
    await expect(page.locator('#letter-input-memorize')).not.toBeVisible()
    await expect(page).not.toHaveURL(/view=memorization/)
  })
})

test.describe('Modals + browser back', () => {
  test('browser back closes Add Verse modal instead of leaving the screen', async ({ page }) => {
    await page.getByTestId('nav-collections').click()
    await page.getByTestId('fab-trigger').click()
    await page.getByTestId('fab-new-verse').click()

    await expect(page.getByTestId('modal-add-verse')).toBeVisible()

    await page.goBack()
    await expect(page.getByTestId('modal-add-verse')).not.toBeVisible()
    await expect(page.getByTestId('nav-collections')).toHaveClass(/tab-btn--active/)
  })

  test('browser back closes Create Collection modal', async ({ page }) => {
    await page.getByTestId('nav-collections').click()
    await page.getByTestId('fab-trigger').click()
    await page.getByTestId('fab-new-collection').click()

    await expect(page.getByTestId('modal-add-collection')).toBeVisible()

    await page.goBack()
    await expect(page.getByTestId('modal-add-collection')).not.toBeVisible()
    await expect(page.getByTestId('nav-collections')).toHaveClass(/tab-btn--active/)
  })

  test('browser back closes Import CSV modal', async ({ page }) => {
    await page.getByTestId('nav-collections').click()
    await page.getByTestId('fab-trigger').click()
    await page.getByTestId('fab-import-csv').click()

    await expect(page.getByTestId('modal-import-csv')).toBeVisible()

    await page.goBack()
    await expect(page.getByTestId('modal-import-csv')).not.toBeVisible()
  })

  test('browser back closes Edit Verse modal', async ({ page }) => {
    const verse = masteredVerse({ id: 'e1', reference: 'Psalm 5:1', content: 'Give ear' })
    await seedStorage(page, [verse], [])
    await page.reload()
    await gotoApp(page, '?view=collections')

    await page.getByTestId('search-bar').click()
    await page.getByPlaceholder(/Search verses/i).fill('Psalm')
    await page.waitForTimeout(500)
    await page.getByRole('button', { name: 'Edit verse' }).first().click()
    await expect(page.getByTestId('modal-edit-verse')).toBeVisible()

    await page.goBack()
    await expect(page.getByTestId('modal-edit-verse')).not.toBeVisible()
  })

  test('in-app close (X) does not leave a stale modal history entry', async ({ page }) => {
    await page.getByTestId('nav-collections').click()
    await page.getByTestId('fab-trigger').click()
    await page.getByTestId('fab-new-verse').click()

    await expect(page.getByTestId('modal-add-verse')).toBeVisible()

    // Close via Cancel/close button inside the modal (ModalSheet emits @close)
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('modal-add-verse')).not.toBeVisible()

    // Browser back must NOT reopen the modal. It should instead exit the app
    // (or at least not re-show the modal); verify the modal stays closed.
    await page.goBack().catch(() => {
      /* may exit the page; that's fine */
    })
    await expect(page.getByTestId('modal-add-verse')).not.toBeVisible()
  })
})

test.describe('Search', () => {
  test('browser back from search returns to Collections', async ({ page }) => {
    await page.getByTestId('nav-review').click()
    await expect(page).toHaveURL(/\?view=review-list/)

    // Search bar is only shown at the top level; tap Collections first then search.
    await page.getByTestId('nav-collections').click()
    await page.getByTestId('search-bar').click()
    await expect(page.getByTestId('search-screen')).toBeVisible()

    await page.goBack()
    await expect(page.getByTestId('search-screen')).not.toBeVisible()
    await expect(page.getByTestId('nav-collections')).toHaveClass(/tab-btn--active/)
  })

  test('in-app close (chevron) in search returns to Collections', async ({ page }) => {
    await page.getByTestId('nav-collections').click()
    await page.getByTestId('search-bar').click()
    await expect(page.getByTestId('search-screen')).toBeVisible()

    // Chevron-left in the search header
    await page.locator('[data-testid="search-screen"] header button').first().click()
    await expect(page.getByTestId('search-screen')).not.toBeVisible()
    await expect(page.getByTestId('nav-collections')).toHaveClass(/tab-btn--active/)
  })
})

test.describe('Deep link to practice verse', () => {
  test('deep-link to review seeds a parent history entry; back goes up one level', async ({
    page,
  }) => {
    const verse = masteredVerse({ id: 'dl1', reference: 'Psalm 6:1', content: 'Lord not in' })
    await seedStorage(page, [verse], [])
    await page.reload()

    // Go directly to review URL (as if pasted / shared / PWA resumed).
    await gotoApp(page, `?view=review&verse=dl1`)

    // Review UI renders after verses load.
    await expect(page.locator('#letter-input-review')).toBeAttached({ timeout: 5000 })

    // Browser back should return to a parent level — not exit immediately, not
    // throw us to a different verse.
    await page.goBack()
    await expect(page.locator('#letter-input-review')).not.toBeVisible()
  })
})
