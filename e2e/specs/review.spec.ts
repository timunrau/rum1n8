import { test, expect } from '@playwright/test'
import {
  clearAppStorage,
  seedStorage,
  getStoredVerses,
  seedWebDAVSettings,
} from '../helpers/storage'
import { mockWebDAVWithStaleRemoteWithFutureTimestamp } from '../helpers/mocks'
import { gotoApp } from '../helpers/navigation'

test.beforeEach(async ({ page }) => {
  await gotoApp(page)
  await clearAppStorage(page)
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
  await gotoApp(page, '?view=review-list')

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
  await gotoApp(page, '?view=review-list')
  await page.getByText('Psalm 1:1').click()

  await expect(page.locator('h1')).toContainText('Psalm 1:1')
  await expect(page.locator('#letter-input-review')).toBeAttached()
  await expect(page.locator('#letter-input-review')).toBeFocused()
})

test('legacy ref quiz fields do not block review flow', async ({ page }) => {
  const masteredVerse = {
    id: 'review-legacy-ref-fields',
    reference: 'Romans 12:2',
    content: 'Do not conform to the pattern of this world',
    bibleVersion: 'BSB',
    createdAt: new Date().toISOString(),
    lastModified: new Date().toISOString(),
    memorizationStatus: 'mastered',
    reviewCount: 2,
    lastReviewed: new Date().toISOString(),
    nextReviewDate: new Date(Date.now() - 86400000).toISOString(),
    easeFactor: 2.5,
    interval: 2,
    reviewHistory: [],
    collectionIds: [],
    refEaseFactor: 2.5,
    refInterval: 0,
    refNextReviewDate: new Date(Date.now() - 86400000).toISOString(),
    refLastReviewed: null,
    refReviewCount: 0,
    refReviewHistory: [],
  }

  await seedStorage(page, [masteredVerse], [])
  await page.reload()

  const stored = (await getStoredVerses(page)) as Array<Record<string, unknown>>
  expect(stored[0]).toHaveProperty('refNextReviewDate')

  await gotoApp(page, '?view=review-list')
  await page.getByText('Romans 12:2').click()

  await expect(page.locator('h1')).toContainText('Romans 12:2')
  await expect(page.locator('#letter-input-review')).toBeAttached()
  await expect(page.locator('#letter-input-review')).toBeFocused()
})

test('empty state: no verses due shows appropriate message', async ({ page }) => {
  await gotoApp(page, '?view=review-list')
  await expect(page.getByText(/No verses|all caught up|Review/i).first()).toBeVisible({ timeout: 5000 })
})

test('start review CTA: hidden when review list is empty', async ({ page }) => {
  await gotoApp(page, '?view=review-list')
  await expect(page.getByTestId('start-review-cta')).toBeHidden()
})

test('start review CTA: shows due count when verses are due', async ({ page }) => {
  const base = {
    bibleVersion: 'BSB',
    createdAt: new Date().toISOString(),
    lastModified: new Date().toISOString(),
    memorizationStatus: 'mastered' as const,
    reviewCount: 1,
    lastReviewed: new Date().toISOString(),
    easeFactor: 2.5,
    interval: 1,
    reviewHistory: [],
    collectionIds: [],
  }
  const dueVerses = [
    { ...base, id: 'due-1', reference: 'Psalm 1:1', content: 'Blessed is', nextReviewDate: new Date(Date.now() - 86400000).toISOString() },
    { ...base, id: 'due-2', reference: 'Psalm 2:1', content: 'Why do the nations rage', nextReviewDate: new Date(Date.now() - 172800000).toISOString() },
    { ...base, id: 'not-due', reference: 'Psalm 3:1', content: 'O Lord how many', nextReviewDate: new Date(Date.now() + 86400000).toISOString() },
  ]
  await seedStorage(page, dueVerses, [])
  await page.reload()
  await gotoApp(page, '?view=review-list')

  const cta = page.getByTestId('start-review-cta')
  await expect(cta).toBeVisible()
  await expect(cta).toContainText('Start review')
  await expect(cta).toContainText('2 due')
})

test('start review CTA: omits due count when no verses are due', async ({ page }) => {
  const notDueVerse = {
    id: 'not-due-1',
    reference: 'Psalm 5:1',
    content: 'Give ear to my words',
    bibleVersion: 'BSB',
    createdAt: new Date().toISOString(),
    lastModified: new Date().toISOString(),
    memorizationStatus: 'mastered',
    reviewCount: 1,
    lastReviewed: new Date().toISOString(),
    nextReviewDate: new Date(Date.now() + 86400000).toISOString(),
    easeFactor: 2.5,
    interval: 1,
    reviewHistory: [],
    collectionIds: [],
  }
  await seedStorage(page, [notDueVerse], [])
  await page.reload()
  await gotoApp(page, '?view=review-list')

  const cta = page.getByTestId('start-review-cta')
  await expect(cta).toBeVisible()
  await expect(cta).toContainText('Start review')
  await expect(cta).not.toContainText('due')
})

test('start review CTA: click starts review of first (most-due) verse', async ({ page }) => {
  const base = {
    bibleVersion: 'BSB',
    createdAt: new Date().toISOString(),
    lastModified: new Date().toISOString(),
    memorizationStatus: 'mastered' as const,
    reviewCount: 1,
    lastReviewed: new Date().toISOString(),
    easeFactor: 2.5,
    interval: 1,
    reviewHistory: [],
    collectionIds: [],
  }
  const verses = [
    { ...base, id: 'older-due', reference: 'Psalm 10:1', content: 'Why O Lord', nextReviewDate: new Date(Date.now() - 172800000).toISOString() },
    { ...base, id: 'newer-due', reference: 'Psalm 20:1', content: 'May the Lord answer', nextReviewDate: new Date(Date.now() - 86400000).toISOString() },
  ]
  await seedStorage(page, verses, [])
  await page.reload()
  await gotoApp(page, '?view=review-list')

  await page.getByTestId('start-review-cta').click()

  await expect(page.locator('h1')).toContainText('Psalm 10:1')
  await expect(page.locator('#letter-input-review')).toBeFocused()
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
  await gotoApp(page, '?view=review-list')

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
  await gotoApp(page, '?view=review-list')

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

test('review: input focused after Next Verse', async ({ page }) => {
  const yesterday = new Date(Date.now() - 86400000).toISOString()
  const twoVerses = [
    {
      id: 'next-v1',
      reference: 'Psalm 1:1',
      content: 'Blessed is',
      bibleVersion: 'BSB',
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      memorizationStatus: 'mastered',
      reviewCount: 1,
      lastReviewed: yesterday,
      nextReviewDate: yesterday,
      easeFactor: 2.5,
      interval: 1,
      reviewHistory: [],
      collectionIds: [],
    },
    {
      id: 'next-v2',
      reference: 'Psalm 2:1',
      content: 'Why the',
      bibleVersion: 'BSB',
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      memorizationStatus: 'mastered',
      reviewCount: 1,
      lastReviewed: yesterday,
      nextReviewDate: yesterday,
      easeFactor: 2.5,
      interval: 1,
      reviewHistory: [],
      collectionIds: [],
    },
  ]
  await seedStorage(page, twoVerses, [])
  await page.reload()
  await gotoApp(page, '?view=review-list')
  await page.getByText('Psalm 1:1').click()

  await expect(page.locator('#letter-input-review')).toBeAttached()
  await page.locator('#letter-input-review').focus()
  await page.keyboard.type('bi', { delay: 50 })

  const nextButton = page.getByRole('button', { name: 'Next Verse' })
  await expect(nextButton).toBeVisible({ timeout: 5000 })
  await nextButton.click()

  await expect(page.locator('#letter-input-review')).toBeAttached()
  await expect(page.locator('#letter-input-review')).toBeFocused()
})

test('same-day review does not advance spaced repetition schedule', async ({ page }) => {
  const verseId = 'same-day-regression'
  const today = new Date().toISOString()
  const pastDue = new Date(Date.now() - 86400000).toISOString()
  const masteredVerse = {
    id: verseId,
    reference: 'Luke 11:9',
    content: 'So I say',
    bibleVersion: 'BSB',
    createdAt: new Date().toISOString(),
    lastModified: new Date().toISOString(),
    memorizationStatus: 'mastered',
    reviewCount: 5,
    lastReviewed: today, // Already reviewed today
    nextReviewDate: pastDue, // But still showing as due
    easeFactor: 2.5,
    interval: 14,
    reviewHistory: [],
    collectionIds: [],
  }
  await seedStorage(page, [masteredVerse], [])
  await page.reload()
  await gotoApp(page, '?view=review-list')

  await page.getByText('Luke 11:9').click()
  await expect(page.locator('#letter-input-review')).toBeAttached()
  await page.locator('#letter-input-review').focus()
  await page.keyboard.type('sisy', { delay: 50 })

  const nextButton = page.getByRole('button', { name: 'Next Verse' })
  await expect(nextButton).toBeVisible({ timeout: 5000 })
  await nextButton.click()

  await page.waitForTimeout(200)
  const verses = (await getStoredVerses(page)) as Array<{
    id: string
    interval: number
    nextReviewDate: string
    reviewCount: number
  }>
  const verse = verses.find((v) => v.id === verseId)
  expect(verse).toBeDefined()
  // Interval and reviewCount should NOT have advanced since it was already reviewed today
  expect(verse!.interval).toBe(14)
  expect(verse!.reviewCount).toBe(5)
})

test('review: input focused after Try Again', async ({ page }) => {
  const masteredVerse = {
    id: 'try-again-review',
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
  await gotoApp(page, '?view=review-list')
  await page.getByText('Psalm 1:1').click()

  await expect(page.locator('#letter-input-review')).toBeAttached()
  await page.locator('#letter-input-review').focus()
  // One wrong letter then correct: 1 mistake in 2 words = 50% -> Try Again modal
  await page.keyboard.type('x', { delay: 50 })
  await page.keyboard.type('bi', { delay: 50 })

  await expect(page.getByText(/Keep practicing/i)).toBeVisible({ timeout: 5000 })
  const tryAgainBtn = page.getByRole('button', { name: 'Try Again' })
  await tryAgainBtn.click()

  await expect(page.locator('#letter-input-review')).toBeAttached()
  await expect(page.locator('#letter-input-review')).toBeFocused()
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
  await gotoApp(page, '?view=review-list')
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

test('review screen shows Learn, Memorize, Master buttons with Master selected', async ({ page }) => {
  const masteredVerse = {
    id: 'review-mode-buttons',
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
  await gotoApp(page, '?view=review-list')
  await page.getByText('Psalm 1:1').click()

  await expect(page.locator('#letter-input-review')).toBeAttached()
  await expect(page.getByText('Learn')).toBeVisible()
  await expect(page.getByText('Memorize')).toBeVisible()
  await expect(page.getByText('Master')).toBeVisible()
  await expect(page.getByText('Master').first()).toHaveClass(/mode-chip--active/)
})

test('review: completing in Learn mode does not advance spaced repetition', async ({ page }) => {
  const verseId = 'learn-no-advance'
  const fixedNextReview = new Date(Date.now() + 86400000 * 7).toISOString()
  const masteredVerse = {
    id: verseId,
    reference: 'Psalm 1:1',
    content: 'Blessed is',
    bibleVersion: 'BSB',
    createdAt: new Date().toISOString(),
    lastModified: new Date().toISOString(),
    memorizationStatus: 'mastered',
    reviewCount: 2,
    lastReviewed: new Date(Date.now() - 86400000).toISOString(),
    nextReviewDate: fixedNextReview,
    easeFactor: 2.5,
    interval: 7,
    reviewHistory: [],
    collectionIds: [],
  }
  await seedStorage(page, [masteredVerse], [])
  await page.reload()
  await gotoApp(page, '?view=review-list')
  await page.getByText('Psalm 1:1').click()

  await expect(page.locator('#letter-input-review')).toBeAttached()
  await page.getByText('Learn').click()
  await page.waitForTimeout(200)
  await page.locator('#letter-input-review').focus()
  await page.keyboard.type('bi', { delay: 50 })

  await expect(page.getByText(/Practice complete|doesn't count as review/i).first()).toBeVisible({ timeout: 5000 })
  const nextButton = page.getByRole('button', { name: 'Next Verse' })
  await expect(nextButton).toBeVisible({ timeout: 3000 })
  await nextButton.click()

  await page.waitForTimeout(300)
  const verses = (await getStoredVerses(page)) as Array<{ id: string; nextReviewDate: string; reviewCount: number; interval: number }>
  const verse = verses.find((v) => v.id === verseId)
  expect(verse).toBeDefined()
  expect(verse!.nextReviewDate).toBe(fixedNextReview)
  expect(verse!.reviewCount).toBe(2)
  expect(verse!.interval).toBe(7)
})

test('review: completing in Master mode advances spaced repetition', async ({ page }) => {
  const verseId = 'master-advances'
  const yesterday = new Date(Date.now() - 86400000).toISOString()
  const masteredVerse = {
    id: verseId,
    reference: 'Psalm 1:1',
    content: 'Blessed is',
    bibleVersion: 'BSB',
    createdAt: new Date().toISOString(),
    lastModified: new Date().toISOString(),
    memorizationStatus: 'mastered',
    reviewCount: 2,
    lastReviewed: yesterday,
    nextReviewDate: yesterday,
    easeFactor: 2.5,
    interval: 7,
    reviewHistory: [],
    collectionIds: [],
  }
  await seedStorage(page, [masteredVerse], [])
  await page.reload()
  await gotoApp(page, '?view=review-list')
  await page.getByText('Psalm 1:1').click()

  await expect(page.locator('#letter-input-review')).toBeAttached()
  await expect(page.getByText('Master').first()).toHaveClass(/mode-chip--active/)
  await page.locator('#letter-input-review').focus()
  await page.keyboard.type('bi', { delay: 50 })

  const nextButton = page.getByRole('button', { name: 'Next Verse' })
  await expect(nextButton).toBeVisible({ timeout: 5000 })
  await nextButton.click()

  await page.waitForTimeout(300)
  const verses = (await getStoredVerses(page)) as Array<{ id: string; nextReviewDate: string; reviewCount: number }>
  const verse = verses.find((v) => v.id === verseId)
  expect(verse).toBeDefined()
  expect(verse!.reviewCount).toBe(3)
  const nextReview = new Date(verse!.nextReviewDate)
  const now = new Date()
  expect(nextReview.getTime()).toBeGreaterThan(now.getTime())
})

test('failed review (<90% accuracy) still updates SRS schedule', async ({ page }) => {
  const verseId = 'failed-review-srs'
  const yesterday = new Date(Date.now() - 86400000).toISOString()
  const masteredVerse = {
    id: verseId,
    reference: 'Psalm 1:1',
    // Wrong letter on first word reveals it incorrectly, then cascades to next word.
    // With 2 words: typing 'x' fails word 1, then 'b' fails word 2 ('is' starts with 'i') -> 0% accuracy, grade 0
    content: 'Blessed is',
    bibleVersion: 'BSB',
    createdAt: new Date().toISOString(),
    lastModified: new Date().toISOString(),
    memorizationStatus: 'mastered',
    reviewCount: 5,
    lastReviewed: yesterday,
    nextReviewDate: yesterday,
    easeFactor: 2.5,
    interval: 14,
    reviewHistory: [],
    collectionIds: [],
  }
  await seedStorage(page, [masteredVerse], [])
  await page.reload()
  await gotoApp(page, '?view=review-list')
  await page.getByText('Psalm 1:1').click()

  await expect(page.locator('#letter-input-review')).toBeAttached()
  await page.locator('#letter-input-review').focus()
  // Type wrong letter: 'x' fails "Blessed", 'b' then fails "is" (expects 'i') -> 2/2 mistakes = 0% = grade 0
  await page.keyboard.type('x', { delay: 50 })
  await page.keyboard.type('bi', { delay: 50 })

  // Should show "Keep practicing" since accuracy < 90%
  await expect(page.getByText(/Keep practicing/i)).toBeVisible({ timeout: 5000 })

  // But SRS should have been updated (interval reduced due to poor performance)
  await page.waitForTimeout(300)
  const verses = (await getStoredVerses(page)) as Array<{
    id: string
    interval: number
    easeFactor: number
    reviewCount: number
    lastGrade: number
  }>
  const verse = verses.find((v) => v.id === verseId)
  expect(verse).toBeDefined()
  // Grade 0 (0% accuracy) reduces interval to minimum (1 day)
  expect(verse!.interval).toBe(1)
  // Ease factor should have decreased from 2.5
  expect(verse!.easeFactor).toBeLessThan(2.5)
  // Review count should have incremented
  expect(verse!.reviewCount).toBe(6)
  // Last grade should reflect the poor performance (grade 0 = complete failure)
  expect(verse!.lastGrade).toBe(0)
})

test('retry after failed review does not overwrite SRS from first attempt', async ({ page }) => {
  const verseId = 'retry-no-overwrite'
  const yesterday = new Date(Date.now() - 86400000).toISOString()
  const masteredVerse = {
    id: verseId,
    reference: 'Psalm 1:1',
    content: 'Blessed is',
    bibleVersion: 'BSB',
    createdAt: new Date().toISOString(),
    lastModified: new Date().toISOString(),
    memorizationStatus: 'mastered',
    reviewCount: 5,
    lastReviewed: yesterday,
    nextReviewDate: yesterday,
    easeFactor: 2.5,
    interval: 14,
    reviewHistory: [],
    collectionIds: [],
  }
  await seedStorage(page, [masteredVerse], [])
  await page.reload()
  await gotoApp(page, '?view=review-list')
  await page.getByText('Psalm 1:1').click()

  await expect(page.locator('#letter-input-review')).toBeAttached()
  await page.locator('#letter-input-review').focus()
  // First attempt: 0% accuracy (x fails "Blessed", b fails "is") -> grade 0
  await page.keyboard.type('x', { delay: 50 })
  await page.keyboard.type('bi', { delay: 50 })

  await expect(page.getByText(/Keep practicing/i)).toBeVisible({ timeout: 5000 })

  // Capture SRS state after first (failed) attempt
  await page.waitForTimeout(300)
  let verses = (await getStoredVerses(page)) as Array<{
    id: string
    interval: number
    easeFactor: number
    reviewCount: number
    lastGrade: number
  }>
  let verse = verses.find((v) => v.id === verseId)
  const intervalAfterFail = verse!.interval
  const efAfterFail = verse!.easeFactor
  const gradeAfterFail = verse!.lastGrade
  expect(gradeAfterFail).toBe(0) // Verify failed grade was saved

  // Now retry and get 100% accuracy
  const tryAgainBtn = page.getByRole('button', { name: 'Try Again' })
  await tryAgainBtn.click()
  await expect(page.locator('#letter-input-review')).toBeAttached()
  await page.locator('#letter-input-review').focus()
  await page.keyboard.type('bi', { delay: 50 })

  // Should now show success
  await expect(page.getByText(/Great job/i)).toBeVisible({ timeout: 5000 })

  // Click Next Verse to trigger any save path
  const nextButton = page.getByRole('button', { name: 'Next Verse' })
  await nextButton.click()
  await page.waitForTimeout(300)

  // Verify SRS was NOT overwritten by the successful retry
  verses = (await getStoredVerses(page)) as Array<{
    id: string
    interval: number
    easeFactor: number
    reviewCount: number
    lastGrade: number
  }>
  verse = verses.find((v) => v.id === verseId)
  expect(verse).toBeDefined()
  expect(verse!.interval).toBe(intervalAfterFail)
  expect(verse!.easeFactor).toBe(efAfterFail)
  expect(verse!.lastGrade).toBe(gradeAfterFail)
  // reviewCount should still be 6 (only incremented once)
  expect(verse!.reviewCount).toBe(6)
})
