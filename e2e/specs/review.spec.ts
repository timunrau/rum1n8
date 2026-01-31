import { test, expect } from '@playwright/test'
import { clearBibleMemoryStorage, seedStorage } from '../helpers/storage'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await clearBibleMemoryStorage(page)
  await page.reload()
})

test('navigate to Review tab; verses due appear when seeded with mastered verses', async ({
  page,
}) => {
  const masteredVerse = {
    id: 'review-1',
    reference: 'Psalm 23:1',
    content: 'The LORD is my shepherd',
    bibleVersion: 'BSB',
    createdAt: new Date().toISOString(),
    lastModified: new Date().toISOString(),
    memorizationStatus: 'mastered',
    reviewCount: 1,
    lastReviewed: new Date().toISOString(),
    nextReviewDate: new Date(Date.now() - 86400000).toISOString(),
    easeFactor: 2.5,
    interval: 1,
    reviewHistory: [],
    collectionIds: ['master-list'],
  }
  await seedStorage(page, [masteredVerse], [])
  await page.reload()
  await page.goto('/?view=review-list')

  await expect(page.getByText('Psalm 23:1')).toBeVisible({ timeout: 10000 })
})

test('click verse -> enters review screen', async ({ page }) => {
  const masteredVerse = {
    id: 'review-1',
    reference: 'Psalm 1:1',
    content: 'Blessed is',
    bibleVersion: 'BSB',
    createdAt: new Date().toISOString(),
    lastModified: new Date().toISOString(),
    memorizationStatus: 'mastered',
    reviewCount: 1,
    lastReviewed: new Date().toISOString(),
    nextReviewDate: new Date(Date.now() - 86400000).toISOString(),
    easeFactor: 2.5,
    interval: 1,
    reviewHistory: [],
    collectionIds: [],
  }
  await seedStorage(page, [masteredVerse], [])
  await page.reload()
  await page.goto('/?view=review-list')
  await page.getByText('Psalm 1:1').click()

  await expect(page.locator('h1')).toContainText('Psalm 1:1')
  await expect(page.locator('#letter-input-review')).toBeAttached()
})

test('empty state: no verses due shows appropriate message', async ({ page }) => {
  await page.goto('/?view=review-list')
  await expect(page.getByText(/No verses|all caught up|Review/i).first()).toBeVisible({ timeout: 5000 })
})
