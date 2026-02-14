import { test, expect } from '@playwright/test'
import {
  clearBibleMemoryStorage,
  seedStorage,
  getStoredVerses,
  seedWebDAVSettings,
} from '../helpers/storage'
import { mockWebDAVWithStaleRemoteWithFutureTimestamp } from '../helpers/mocks'

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

test('Luke 11:9-13 regression: WebDAV merge with future remote timestamp does not overwrite local', async ({
  page,
}) => {
  const verseId = '1769044954411-nie7rnrn9'
  const yesterday = new Date(Date.now() - 86400000).toISOString()
  const lukeVerse = {
    id: verseId,
    reference: 'Luke 11:9-13',
    content: 'So I tell',
    bibleVersion: 'BSB',
    createdAt: new Date().toISOString(),
    lastModified: new Date().toISOString(),
    memorizationStatus: 'mastered',
    reviewCount: 3,
    lastReviewed: yesterday,
    nextReviewDate: yesterday,
    easeFactor: 2.5,
    interval: 14,
    reviewHistory: [],
    collectionIds: [],
  }

  // Mock WebDAV to return stale remote data with FUTURE lastReviewed (the actual bug scenario).
  // Without the fix, merge preferred remote and overwrote local's correct nextReviewDate/interval.
  await mockWebDAVWithStaleRemoteWithFutureTimestamp(page, lukeVerse)

  await seedWebDAVSettings(page, {
    url: 'https://example.com/remote.php/webdav/',
    username: 'test',
    password: 'test',
    useProxy: true,
    proxyUrl: 'http://localhost:3001',
  })
  await seedStorage(page, [lukeVerse], [])
  await page.reload()
  await page.goto('/?view=review-list')

  await page.getByText('Luke 11:9-13').click()
  await expect(page.locator('#letter-input-review')).toBeAttached()
  await page.locator('#letter-input-review').focus()
  await page.keyboard.type('sit', { delay: 50 })

  const nextButton = page.getByRole('button', { name: 'Next Verse' })
  await expect(nextButton).toBeVisible({ timeout: 5000 })
  await nextButton.click()

  await page.waitForTimeout(500)
  const verses = (await getStoredVerses(page)) as Array<{
    id: string
    interval: number
    nextReviewDate: string
  }>
  const verse = verses.find((v) => v.id === verseId)
  expect(verse).toBeDefined()
  expect(verse!.interval).toBeGreaterThanOrEqual(20)
  const nextReview = new Date(verse!.nextReviewDate)
  const now = new Date()
  expect(nextReview.getTime()).toBeGreaterThan(now.getTime())
})

test('established interval preserved on review (no regression to 3 days)', async ({ page }) => {
  const verseId = 'regression-test-1'
  const yesterday = new Date(Date.now() - 86400000).toISOString()
  const masteredVerse = {
    id: verseId,
    reference: 'Psalm 1:1',
    content: 'Blessed is',
    bibleVersion: 'BSB',
    createdAt: new Date().toISOString(),
    lastModified: new Date().toISOString(),
    memorizationStatus: 'mastered',
    reviewCount: 3,
    lastReviewed: yesterday,
    nextReviewDate: yesterday,
    easeFactor: 2.5,
    interval: 14,
    reviewHistory: [],
    collectionIds: [],
  }
  await seedStorage(page, [masteredVerse], [])
  await page.reload()
  await page.goto('/?view=review-list')

  await page.getByText('Psalm 1:1').click()
  await expect(page.locator('#letter-input-review')).toBeAttached()
  await page.locator('#letter-input-review').focus()
  await page.keyboard.type('bi', { delay: 50 })

  const nextButton = page.getByRole('button', { name: 'Next Verse' })
  await expect(nextButton).toBeVisible({ timeout: 5000 })
  await nextButton.click()

  await page.waitForTimeout(200)
  const verses = (await getStoredVerses(page)) as Array<{ id: string; interval: number; nextReviewDate: string }>
  const verse = verses.find((v) => v.id === verseId)
  expect(verse).toBeDefined()
  expect(verse!.interval).toBeGreaterThanOrEqual(20)
  const nextReview = new Date(verse!.nextReviewDate)
  const now = new Date()
  expect(nextReview.getTime()).toBeGreaterThan(now.getTime())
})

test('review mode: verse with dash (no spaces) treats parts as separate words', async ({ page }) => {
  const masteredVerseWithDash = {
    id: 'dash-review',
    reference: 'Genesis 17:8',
    content: 'One—two',
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
  await seedStorage(page, [masteredVerseWithDash], [])
  await page.reload()
  await page.goto('/?view=review-list')
  await page.getByText('Genesis 17:8').click()

  await expect(page.locator('#letter-input-review')).toBeAttached()
  await page.locator('#letter-input-review').focus()
  await page.keyboard.type('o', { delay: 50 })
  await page.waitForTimeout(100)
  await expect(page.getByText('Great job!')).toHaveCount(0)

  await page.keyboard.type('t', { delay: 50 })
  await page.waitForTimeout(200)
  await expect(page.getByText('Great job!').first()).toBeVisible({ timeout: 3000 })
})
