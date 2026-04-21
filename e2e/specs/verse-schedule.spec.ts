import { test, expect } from '@playwright/test'
import { clearAppStorage, seedVerses, getStoredVerses } from '../helpers/storage'
import { gotoApp } from '../helpers/navigation'

const futureIso = (daysFromNow: number) => {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  return d.toISOString()
}

const masteredVerse = {
  id: 'verse-mastered',
  reference: 'Psalm 23:1',
  content: 'The LORD is my shepherd; I shall not want.',
  bibleVersion: 'BSB',
  createdAt: '2024-01-01T00:00:00.000Z',
  lastModified: '2024-01-01T00:00:00.000Z',
  masteredAt: '2024-01-05T00:00:00.000Z',
  memorizationStatus: 'mastered',
  reviewCount: 3,
  lastReviewed: '2024-01-10T00:00:00.000Z',
  nextReviewDate: futureIso(3),
  easeFactor: 2.5,
  interval: 3,
  reviewHistory: [],
  collectionIds: [],
}

const unmemorizedVerse = {
  id: 'verse-new',
  reference: 'John 3:16',
  content: 'For God so loved the world.',
  bibleVersion: 'BSB',
  createdAt: '2024-01-01T00:00:00.000Z',
  lastModified: '2024-01-01T00:00:00.000Z',
  memorizationStatus: 'unmemorized',
  reviewCount: 0,
  lastReviewed: null,
  nextReviewDate: null,
  easeFactor: 2.5,
  interval: 0,
  reviewHistory: [],
  collectionIds: [],
}

test.beforeEach(async ({ page }) => {
  await gotoApp(page)
  await clearAppStorage(page)
})

test('schedule row is hidden for unmemorized verses', async ({ page }) => {
  await seedVerses(page, [unmemorizedVerse])
  await gotoApp(page, '?view=collections')

  await page.getByRole('button', { name: 'Edit verse' }).first().click()
  await expect(page.getByTestId('modal-edit-verse')).toBeVisible()
  await expect(page.getByTestId('verse-schedule-row')).toHaveCount(0)
})

test('schedule row shows next-review metadata for mastered verses', async ({ page }) => {
  await seedVerses(page, [masteredVerse])
  await gotoApp(page, '?view=collections')

  await page.getByRole('button', { name: 'Edit verse' }).first().click()
  const row = page.getByTestId('verse-schedule-row')
  await expect(row).toBeVisible()
  await expect(row).toContainText(/Next review/)
  await expect(row).toContainText('3d')
  await expect(page.getByTestId('verse-schedule-change')).toBeVisible()
  await expect(page.getByTestId('verse-schedule-reset')).toBeVisible()
})

test('change popover updates nextReviewDate and shows undo toast', async ({ page }) => {
  await seedVerses(page, [masteredVerse])
  await gotoApp(page, '?view=collections')

  await page.getByRole('button', { name: 'Edit verse' }).first().click()
  await expect(page.getByTestId('verse-schedule-popover')).toHaveCount(0)

  await page.getByTestId('verse-schedule-change').click()
  const popover = page.getByTestId('verse-schedule-popover')
  await expect(popover).toBeVisible()

  await popover.getByRole('button', { name: '+1w' }).click()
  await expect(popover).toHaveCount(0)

  // Toast with Undo is shown
  await expect(page.getByTestId('toast-action')).toBeVisible()

  // Verse data was updated to ~7 days out
  const verses = (await getStoredVerses(page)) as Array<{ nextReviewDate: string }>
  const diffDays = Math.round(
    (new Date(verses[0].nextReviewDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  )
  expect(diffDays).toBeGreaterThanOrEqual(6)
  expect(diffDays).toBeLessThanOrEqual(7)

  // Modal still open and the row reflects the new interval (~7d)
  await expect(page.getByTestId('verse-schedule-row')).toContainText(/6d|7d/)
})

test('clicking outside the change popover closes it', async ({ page }) => {
  await seedVerses(page, [masteredVerse])
  await gotoApp(page, '?view=collections')
  await page.getByRole('button', { name: 'Edit verse' }).first().click()

  await page.getByTestId('verse-schedule-change').click()
  await expect(page.getByTestId('verse-schedule-popover')).toBeVisible()
  // Directive attaches its document click listener after a 50ms delay
  await page.waitForTimeout(120)

  await page.getByLabel(/Verse Reference/i).click()
  await expect(page.getByTestId('verse-schedule-popover')).toHaveCount(0)
})

test('undo restores the prior nextReviewDate', async ({ page }) => {
  await seedVerses(page, [masteredVerse])
  await gotoApp(page, '?view=collections')
  await page.getByRole('button', { name: 'Edit verse' }).first().click()

  await page.getByTestId('verse-schedule-change').click()
  await page
    .getByTestId('verse-schedule-popover')
    .getByRole('button', { name: '+1mo' })
    .click()

  await page.getByTestId('toast-action').click()

  const verses = (await getStoredVerses(page)) as Array<{ nextReviewDate: string }>
  const diffDays = Math.round(
    (new Date(verses[0].nextReviewDate).getTime() -
      new Date(masteredVerse.nextReviewDate).getTime()) /
      (1000 * 60 * 60 * 24)
  )
  expect(diffDays).toBe(0)
})

test('reset clears progress, closes modal, and shows undo toast', async ({ page }) => {
  await seedVerses(page, [masteredVerse])
  await gotoApp(page, '?view=collections')
  await page.getByRole('button', { name: 'Edit verse' }).first().click()

  await page.getByTestId('verse-schedule-reset').click()

  await expect(page.getByTestId('modal-edit-verse')).not.toBeVisible()
  await expect(page.getByTestId('toast-action')).toBeVisible()

  const verses = (await getStoredVerses(page)) as Array<{
    memorizationStatus: string
    nextReviewDate: string | null
    interval: number
    reviewCount: number
    masteredAt: string | null
  }>
  expect(verses[0].memorizationStatus).toBe('unmemorized')
  expect(verses[0].nextReviewDate).toBeNull()
  expect(verses[0].interval).toBe(0)
  expect(verses[0].reviewCount).toBe(0)
  expect(verses[0].masteredAt).toBeNull()
})

test('undo after reset restores mastered state', async ({ page }) => {
  await seedVerses(page, [masteredVerse])
  await gotoApp(page, '?view=collections')
  await page.getByRole('button', { name: 'Edit verse' }).first().click()

  await page.getByTestId('verse-schedule-reset').click()
  await page.getByTestId('toast-action').click()

  const verses = (await getStoredVerses(page)) as Array<{
    memorizationStatus: string
    nextReviewDate: string | null
    interval: number
    reviewCount: number
    masteredAt: string | null
  }>
  expect(verses[0].memorizationStatus).toBe('mastered')
  expect(verses[0].nextReviewDate).toBe(masteredVerse.nextReviewDate)
  expect(verses[0].interval).toBe(masteredVerse.interval)
  expect(verses[0].reviewCount).toBe(masteredVerse.reviewCount)
  expect(verses[0].masteredAt).toBe(masteredVerse.masteredAt)
})
