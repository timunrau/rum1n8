import { test, expect, type Page } from '@playwright/test'
import { clearAppStorage, getStoredVerses, seedAppSettings } from '../helpers/storage'
import { gotoApp } from '../helpers/navigation'

test.use({ timezoneId: 'America/Winnipeg' })
const start = new Date('2026-05-01T17:00:00Z')
const reference = 'John 3:16'
const content = 'For God so loved the world that he gave his'
const correctKeys = 'fgsltwthgh'
type Verse = {
  id: string
  memorizationStatus: string
  srsVersion: number
  easeFactor: number
  interval: number
  reviewCount: number
  lastGrade?: number
  nextReviewDate: string | null
  lastReviewed: string | null
  reviewHistory: Array<{ grade: number; accuracy: number }>
}
const stored = async (page: Page) => (await getStoredVerses(page) as Verse[])[0]
const daysAfter = (date: Date, days: number) => {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

async function createAndMaster(page: Page) {
  await page.getByTestId('fab-trigger').click()
  await page.getByTestId('fab-new-verse').click()
  await page.getByLabel('Reference').fill(reference)
  await page.getByLabel('Verse text', { exact: true }).fill(content)
  await page.getByRole('button', { name: 'Add Verse', exact: true }).click()
  expect(await stored(page)).toMatchObject({ memorizationStatus: 'unmemorized', easeFactor: 1.5,
    interval: 0, reviewCount: 0, srsVersion: 2, nextReviewDate: null, reviewHistory: [] })

  await page.getByText(reference, { exact: true }).first().click()
  for (const [button, status] of [
    [/Continue to Memorize/i, 'learned'], [/Continue to Master/i, 'memorized'], [/^Done$/, 'mastered'],
  ] as const) {
    await page.locator('#letter-input-memorize').focus()
    await page.keyboard.type(correctKeys, { delay: 15 })
    await page.getByRole('button', { name: button }).click()
    expect((await stored(page)).memorizationStatus).toBe(status)
    expect((await stored(page)).reviewCount).toBe(0)
  }
  const verse = await stored(page)
  expect(verse).toMatchObject({ easeFactor: 1.5, interval: 0, lastReviewed: null, reviewHistory: [] })
  expect(verse.nextReviewDate).toBe(daysAfter(start, 1).toISOString())
  return verse
}

// Exercise real typing, the first-attempt save, retries, Done, storage, and reload.
// Only the clock is advanced; no verse or scheduling fields are seeded or edited.
async function review(page: Page, at: Date, mistakes = 0) {
  await page.clock.setFixedTime(at)
  await gotoApp(page, '?view=review-list')
  await page.getByText(reference, { exact: true }).click()
  await page.locator('#letter-input-review').focus()
  // A digit cannot be accepted as an adjacent-key fuzzy match for these words.
  await page.keyboard.type('0'.repeat(mistakes) + correctKeys.slice(mistakes), { delay: 15 })
  const grade = mistakes === 0 ? 5 : mistakes === 1 ? 4 : mistakes === 2 ? 3 : 0
  await expect.poll(async () => (await stored(page)).lastGrade).toBe(grade)
  const firstAttempt = await stored(page)
  if (mistakes > 1) {
    await page.getByRole('button', { name: 'Try Again', exact: true }).click()
    await page.locator('#letter-input-review').focus()
    await page.keyboard.type(correctKeys, { delay: 15 })
  }
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await page.reload()
  const result = await stored(page)
  expect(result).toEqual(firstAttempt)
  return result
}

for (const mode of ['classic', 'rotation']) {
  test(`${mode}: a newly created verse advances, regresses after mistakes, and recovers`, async ({ page }) => {
    test.setTimeout(60_000)
    await gotoApp(page)
    await clearAppStorage(page)
    await page.clock.setFixedTime(start)
    await seedAppSettings(page, { reviewMode: mode, requireReferenceTyping: false })
    await gotoApp(page, '?view=collections')
    let verse = await createAndMaster(page)

    // Explicit expected progression catches regressions in initialization, ease,
    // fractional intervals, daily counting, and the removal of the old ladder.
    const expectedIntervals = [1, 1.7, 3.06, 5.814, 11.628, 24.4188]
    for (const [index, interval] of expectedIntervals.entries()) {
      const at = new Date(verse.nextReviewDate!)
      verse = await review(page, at)
      expect(verse.interval).toBeCloseTo(interval)
      expect(verse.easeFactor).toBeCloseTo(1.6 + index * 0.1)
      expect(verse.reviewCount).toBe(index + 1)
      expect(verse.reviewHistory).toHaveLength(index + 1)
      expect(verse.nextReviewDate).toBe(daysAfter(at, Math.floor(interval)).toISOString())
    }

    // An 80% first attempt four days into a long interval halves existing spacing,
    // rather than collapsing to two days. A perfect retry cannot erase the lapse.
    const weakAt = daysAfter(new Date(verse.lastReviewed!), 4)
    verse = await review(page, weakAt, 2)
    expect(verse.interval).toBeCloseTo(12.2094)
    expect(verse.easeFactor).toBeCloseTo(1.96)
    expect(verse.reviewHistory.at(-1)).toMatchObject({ grade: 3, accuracy: 80 })
    expect(verse.reviewCount).toBe(7)

    const repeated = await review(page, weakAt)
    expect(repeated.interval).toBe(verse.interval)
    expect(repeated.easeFactor).toBe(verse.easeFactor)
    expect(repeated.nextReviewDate).toBe(verse.nextReviewDate)
    expect(repeated.reviewCount).toBe(7)

    // Complete failure returns to a daily review and the ease floor.
    verse = await review(page, new Date(verse.nextReviewDate!), 10)
    expect(verse.interval).toBe(1)
    expect(verse.easeFactor).toBe(1.3)
    expect(verse.reviewCount).toBe(8)
    expect(verse.reviewHistory.at(-1)).toMatchObject({ grade: 0, accuracy: 0 })

    // Recovery still works from the floor, including a 90% review that leaves ease
    // unchanged. Retained fractions let the date eventually move beyond one day.
    for (const [mistakes, interval, ease] of [[0, 1.4, 1.4], [1, 1.96, 1.4], [0, 2.94, 1.5]]) {
      verse = await review(page, new Date(verse.nextReviewDate!), mistakes)
      expect(verse.interval).toBeCloseTo(interval)
      expect(verse.easeFactor).toBeCloseTo(ease)
    }
    expect(verse.reviewCount).toBe(11)
    expect(verse.memorizationStatus).toBe('mastered')
    expect(verse.srsVersion).toBe(2)
  })
}
