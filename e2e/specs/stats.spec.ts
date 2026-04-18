import { test, expect } from '@playwright/test'
import { clearAppStorage, seedVerses, seedStorage } from '../helpers/storage'
import { gotoApp } from '../helpers/navigation'

// Use local date strings so streak calculation (which uses local dates) matches
function localDateStr(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}T12:00:00.000Z`
}

function todayISO() {
  return localDateStr(new Date())
}

function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return localDateStr(d)
}

function makeVerse(
  id: string,
  reference: string,
  opts: {
    mastered?: boolean
    masteredAt?: string
    reviewDates?: string[]
    collectionIds?: string[]
  } = {}
) {
  return {
    id,
    reference,
    content: `Content of ${reference}`,
    bibleVersion: 'BSB',
    createdAt: '2024-01-01T00:00:00.000Z',
    lastModified: '2024-01-01T00:00:00.000Z',
    memorizationStatus: opts.mastered ? 'mastered' : 'unmemorized',
    masteredAt: opts.masteredAt ?? null,
    reviewCount: opts.reviewDates?.length ?? 0,
    lastReviewed: opts.reviewDates?.at(-1) ?? null,
    nextReviewDate: null,
    easeFactor: 2.5,
    interval: 7,
    reviewHistory: (opts.reviewDates ?? []).map((date) => ({
      date,
      grade: 4,
      accuracy: 1,
      mistakes: 0,
    })),
    collectionIds: opts.collectionIds ?? [],
  }
}

test.beforeEach(async ({ page }) => {
  await gotoApp(page)
  await clearAppStorage(page)
  await page.reload()
})

test('Stats tab shows empty state when no verses exist', async ({ page }) => {
  await page.getByTestId('nav-stats').click()
  await expect(page.getByTestId('nav-stats')).toHaveClass(/tab-btn--active/)
  await expect(page.getByText('Current Streak')).toBeVisible()
  await expect(page.getByText(/0\s*day/)).toBeVisible()
})

test('Stats tab shows current streak from review history', async ({ page }) => {
  const verses = [
    makeVerse('v1', 'John 3:16', {
      reviewDates: [daysAgo(1), todayISO()],
    }),
  ]
  await seedVerses(page, verses)
  await page.reload()

  await page.getByTestId('nav-stats').click()
  // Should show at least 2 days streak (today + yesterday)
  await expect(page.getByText(/[2-9]\s*days/)).toBeVisible({ timeout: 5000 })
})

test('Stats tab shows Daily Activity card with chart', async ({ page }) => {
  const verses = [
    makeVerse('v1', 'John 3:16', {
      reviewDates: [todayISO()],
    }),
  ]
  await seedVerses(page, verses)
  await page.reload()

  await page.getByTestId('nav-stats').click()
  await expect(page.getByText('Daily Activity')).toBeVisible()
  // Chart legend should be visible
  await expect(page.getByText('Reviews', { exact: true })).toBeVisible()
  await expect(page.getByText('Mastered', { exact: true })).toBeVisible()
  // A canvas element should be rendered (Chart.js)
  await expect(page.locator('canvas').first()).toBeVisible()
})

test('Stats tab shows Verses Mastered card with chart', async ({ page }) => {
  const verses = [
    makeVerse('v1', 'Psalm 23:1', {
      mastered: true,
      masteredAt: daysAgo(5),
      reviewDates: [daysAgo(5)],
    }),
    makeVerse('v2', 'John 3:16', {
      mastered: true,
      masteredAt: daysAgo(2),
      reviewDates: [daysAgo(2)],
    }),
  ]
  await seedVerses(page, verses)
  await page.reload()

  await page.getByTestId('nav-stats').click()
  await expect(page.getByText('Verses Mastered')).toBeVisible()
  // Should have chart canvases
  const canvases = page.locator('canvas')
  await expect(canvases.first()).toBeVisible()
})

test('Stats counts verse ranges correctly in collections', async ({ page }) => {
  const verses = [
    makeVerse('v1', 'Psalm 1:1-3', {
      mastered: true,
      masteredAt: daysAgo(1),
      reviewDates: [daysAgo(1)],
      collectionIds: ['col-1'],
    }),
  ]
  const collections = [
    { id: 'col-1', name: 'Test Collection', createdAt: '2024-01-01T00:00:00.000Z', lastModified: '2024-01-01T00:00:00.000Z' },
  ]
  await seedStorage(page, verses, collections)
  await page.reload()

  await page.getByTestId('nav-collections').click()
  // All Verses should show 3 (not 1) since Psalm 1:1-3 is 3 verses
  await expect(page.getByText('3 verses').first()).toBeVisible()
})

test('Stats streak is 0 when no reviews done', async ({ page }) => {
  const verses = [makeVerse('v1', 'John 3:16')]
  await seedVerses(page, verses)
  await page.reload()

  await page.getByTestId('nav-stats').click()
  await expect(page.getByText(/0\s*day/)).toBeVisible()
})
