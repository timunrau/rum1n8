import { test, expect, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { clearAppStorage, seedAppSettings, seedStorage, seedVerses, getStoredVerses } from '../helpers/storage'
import { gotoApp } from '../helpers/navigation'

test.use({ timezoneId: 'America/Winnipeg' })
const now = new Date('2026-08-20T12:00:00Z')
const iso = (days: number) => {
  const date = new Date(now)
  date.setDate(date.getDate() + days)
  return date.toISOString()
}
const makeVerse = (id: string, reference: string, overrides: Record<string, unknown> = {}) => ({
  id, reference, content: 'God is love.', bibleVersion: 'BSB', memorizationStatus: 'mastered',
  createdAt: iso(-100), lastModified: iso(-1), masteredAt: iso(-90), reviewCount: 10,
  interval: 14, easeFactor: 2.5, lastReviewed: iso(-1), nextReviewDate: iso(13), reviewHistory: [], collectionIds: [],
  ...overrides,
})
type StoredVerse = ReturnType<typeof makeVerse> & {
  reviewSchedule?: { earnedInterval: number; anchorDate: string; appliedMaximumDays: number; forceDue: boolean }
}
const storedVerses = async (page: Page) => await getStoredVerses(page) as StoredVerse[]
async function openSettings(page: Page) {
  await gotoApp(page, '?view=collections')
  await page.getByTestId('hamburger-button').click()
  await page.getByTestId('settings-practice').click()
}
async function closeSettings(page: Page) {
  await page.getByTestId('modal-practice-settings').getByRole('button', { name: 'Done', exact: true }).click()
}

test.beforeEach(async ({ page }) => {
  await gotoApp(page)
  await clearAppStorage(page)
  await page.clock.setFixedTime(now)
})

test('new users start in Rotation and keep it after adding verses; explicit Classic persists', async ({ page }) => {
  await gotoApp(page)
  await expect(page.getByTestId('getting-started-card')).toBeVisible()
  await openSettings(page)
  await expect(page.getByTestId('review-mode-rotation')).toHaveAttribute('aria-checked', 'true')
  await closeSettings(page)
  await seedVerses(page, [makeVerse('first', 'Psalm 1:1')])
  await openSettings(page)
  await expect(page.getByTestId('review-mode-rotation')).toHaveAttribute('aria-checked', 'true')
  await page.getByTestId('review-mode-classic').click()
  await closeSettings(page)
  await openSettings(page)
  await expect(page.getByTestId('review-mode-classic')).toHaveAttribute('aria-checked', 'true')
})

for (const legacy of ['library', 'settings']) {
  test(`existing users with legacy ${legacy} retain Classic`, async ({ page }) => {
    if (legacy === 'library') await seedVerses(page, [makeVerse('old', 'Psalm 1:1')])
    else await seedAppSettings(page, { requireReferenceTyping: true })
    await openSettings(page)
    await expect(page.getByTestId('review-mode-classic')).toHaveAttribute('aria-checked', 'true')
    if (legacy === 'settings') {
      await expect(page.getByRole('switch', { name: /Require typing the reference/ })).toHaveAttribute('aria-checked', 'true')
    }
  })
}

test('maximum preview is non-destructive, reversible, persistent, and limits manual choices and undo', async ({ page }) => {
  const original = makeVerse('mature', 'Psalm 1:1', { interval: 90, lastReviewed: iso(-40), nextReviewDate: iso(50) })
  await seedVerses(page, [original])
  await seedAppSettings(page, { reviewMode: 'rotation' })
  await openSettings(page)
  const practice = page.getByRole('region', { name: 'Practice & review', exact: true })
  await expect(practice.getByTestId('master-placeholder-lines-toggle')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Bible', exact: true }).getByLabel('Default translation')).toHaveCount(1)
  const maximum = page.getByTestId('max-review-interval')
  const apply = page.getByTestId('apply-max-review-interval')
  await maximum.fill('0')
  await expect(apply).toBeDisabled()
  await maximum.fill('30')
  await expect(page.getByTestId('review-maximum-preview')).toContainText('1 review dates earlier')
  await expect(page.getByTestId('review-maximum-preview')).toContainText('1 become due')
  expect((await storedVerses(page))[0].nextReviewDate).toBe(original.nextReviewDate)
  await apply.click()
  let verse = (await storedVerses(page))[0]
  expect(verse.interval).toBe(30)
  expect(verse.reviewSchedule?.earnedInterval).toBe(90)
  expect(verse.lastModified).toBe(original.lastModified)
  expect(verse.reviewCount).toBe(original.reviewCount)
  await maximum.fill('90')
  await expect(page.getByTestId('review-maximum-preview')).toContainText('1 no longer due')
  await apply.click()
  expect((await storedVerses(page))[0].nextReviewDate).toBe(original.nextReviewDate)
  await maximum.fill('10')
  await apply.click()
  await closeSettings(page)
  await openSettings(page)
  await expect(maximum).toHaveValue('10')
  await closeSettings(page)
  await page.getByRole('button', { name: 'Edit verse' }).first().click()
  await page.getByTestId('verse-schedule-change').click()
  const choices = page.getByTestId('verse-schedule-popover')
  await expect(choices.getByRole('button', { name: '+2w', exact: true })).toHaveCount(0)
  await choices.getByRole('button', { name: '+10d', exact: true }).click()
  expect((await storedVerses(page))[0].reviewSchedule?.earnedInterval).toBe(10)
  await page.getByTestId('toast-action').click()
  verse = (await storedVerses(page))[0]
  expect(verse.reviewSchedule?.earnedInterval).toBe(90)
  expect(verse.interval).toBe(10)
  expect(verse.nextReviewDate).toBe(iso(-30))
})

test('Rotation explains dates and keeps the visible sequence after a completed review reorders the list', async ({ page }) => {
  await seedVerses(page, [
    makeVerse('recent', 'John 16:33', { lastReviewed: iso(0), nextReviewDate: iso(9) }),
    makeVerse('old', 'Psalm 23:1', { lastReviewed: iso(-12), nextReviewDate: iso(11) }),
    makeVerse('due', 'Romans 8:1', { lastReviewed: iso(-30), nextReviewDate: iso(-1) }),
    makeVerse('never', 'Genesis 1:1', { lastReviewed: null, nextReviewDate: iso(20) }),
  ])
  await seedAppSettings(page, { reviewMode: 'rotation' })
  await gotoApp(page, '?view=review-list')
  await expect(page.getByRole('region', { name: 'Due now', exact: true })).toContainText('Romans 8:1')
  const remaining = page.getByRole('region', { name: 'Keep ruminating', exact: true })
  await expect(remaining.getByText('Last reviewed', { exact: true })).toBeVisible()
  await expect(remaining.locator('.verse-card__meta')).toHaveText(['Never', '12d ago', 'Today'])
  const sequence = ['due', 'never', 'old', 'recent']
  await page.getByTestId('start-review-cta').click()
  await expect.poll(() => page.evaluate(() => history.state?.practiceSequence?.verseIds)).toEqual(sequence)
  await page.locator('#letter-input-review').focus()
  await page.keyboard.type('gil', { delay: 40 })
  await expect(page.getByRole('button', { name: 'Next Verse', exact: true })).toBeVisible()
  await expect.poll(async () => (await storedVerses(page)).find(v => v.id === 'due')?.reviewCount).toBe(11)
  await expect.poll(() => page.evaluate(() => history.state?.practiceSequence?.verseIds)).toEqual(sequence)
  await page.getByRole('button', { name: 'Next Verse', exact: true }).click()
  await expect(page.locator('h1')).toContainText('Genesis 1:1')
  await expect(page.getByTestId('start-review-cta')).toHaveCount(0)
})

test('caught-up state hides Due now while retaining each mode’s list labels', async ({ page }) => {
  await seedVerses(page, [makeVerse('future', 'John 16:33', { lastReviewed: iso(-1), nextReviewDate: iso(9) })])
  await seedAppSettings(page, { reviewMode: 'rotation' })
  await gotoApp(page, '?view=review-list')
  await expect(page.getByTestId('review-caught-up')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Due now', exact: true })).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Keep ruminating', exact: true })).toContainText('Last reviewed')
  await expect(page.locator('.verse-card__meta')).toHaveText('Yesterday')
  await openSettings(page)
  await page.getByTestId('review-mode-classic').click()
  await closeSettings(page)
  await page.getByTestId('nav-review').click()
  await expect(page.getByTestId('review-caught-up')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Keep ruminating', exact: true })).toHaveCount(0)
  await expect(page.locator('.verse-card__meta')).toHaveText('9d')
  await seedVerses(page, [])
  await seedAppSettings(page, { reviewMode: 'rotation' })
  await gotoApp(page, '?view=review-list')
  await expect(page.getByTestId('review-caught-up')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Due now', exact: true })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Keep ruminating', exact: true })).toHaveCount(0)
  await expect(page.getByText('No verses to review', { exact: true })).toBeVisible()
  await expect(page.getByTestId('start-review-cta')).toHaveCount(0)
})

for (const mode of ['classic', 'rotation']) {
  test(`${mode} caught-up actions preserve review order and return navigation`, async ({ page }) => {
    await seedVerses(page, [
      makeVerse('recent', 'John 16:33', { lastReviewed: iso(-1), nextReviewDate: iso(2) }),
      makeVerse('old', 'Psalm 23:1', { lastReviewed: iso(-12), nextReviewDate: iso(10) }),
    ])
    await seedAppSettings(page, { reviewMode: mode })
    await gotoApp(page, '?view=review-list')
    const card = page.getByTestId('review-caught-up')
    await card.getByRole('button', { name: 'Add verse', exact: true }).click()
    await page.getByTestId('modal-add-verse').getByRole('button', { name: 'Close', exact: true }).click()
    await expect(card).toBeVisible()
    const sequence = mode === 'rotation' ? ['old', 'recent'] : ['recent', 'old']
    await card.getByRole('button', { name: 'Keep ruminating', exact: true }).click()
    await expect.poll(() => page.evaluate(() => history.state?.practiceSequence?.verseIds)).toEqual(sequence)
    await page.locator('#letter-input-review').focus()
    await page.keyboard.type('gil', { delay: 40 })
    await page.getByRole('button', { name: 'Next Verse', exact: true }).click()
    await expect(page.locator('h1')).toContainText(mode === 'rotation' ? 'John 16:33' : 'Psalm 23:1')
    await page.goBack()
    await expect(card).toBeVisible()
    await expect(page.getByTestId('nav-review')).toHaveClass(/tab-btn--active/)
  })

  test(`${mode} final due review reveals the caught-up state`, async ({ page }) => {
    await seedVerses(page, [makeVerse('due', 'Romans 8:1', { nextReviewDate: iso(-1) })])
    await seedAppSettings(page, { reviewMode: mode })
    await gotoApp(page, '?view=review-list')
    await expect(page.getByTestId('review-caught-up')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Due now', exact: true })).toHaveCount(mode === 'rotation' ? 1 : 0)
    await page.getByTestId('start-review-cta').click()
    await page.locator('#letter-input-review').focus()
    await page.keyboard.type('gil', { delay: 40 })
    await page.getByRole('button', { name: 'Done', exact: true }).click()
    await expect(page.getByTestId('review-caught-up')).toBeVisible()
    await expect(page.getByTestId('start-review-cta')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Due now', exact: true })).toHaveCount(0)
  })

  test(`${mode} timing applies inside collections while their visible order is respected`, async ({ page }) => {
    await seedStorage(page, [
      makeVerse('first', 'Psalm 1:1', { collectionIds: ['group'] }),
      makeVerse('second', 'Psalm 2:1', { collectionIds: ['group'] }),
    ], [{ id: 'group', name: 'Group', parentId: null, createdAt: iso(-100), lastModified: iso(-1) }])
    await seedAppSettings(page, {
      reviewMode: mode, verseSortPreferences: { 'collection:group': { criterion: 'reference', direction: 'desc' } },
    })
    await gotoApp(page, '?view=collection&collection=group')
    await expect.poll(() => page.locator('.verse-card__reference').evaluateAll(nodes => nodes.map(n => n.getAttribute('aria-label'))))
      .toEqual(['Psalm 2:1', 'Psalm 1:1'])
    await page.getByText('Psalm 2:1', { exact: true }).click()
    await page.locator('#letter-input-review').focus()
    await page.keyboard.type('gil', { delay: 40 })
    await expect(page.getByRole('button', { name: 'Next Verse', exact: true })).toBeVisible()
    const expected = mode === 'rotation' ? 14 : 36.4
    await expect.poll(async () => (await storedVerses(page)).find(v => v.id === 'second')?.interval).toBeCloseTo(expected)
    const result = (await storedVerses(page)).find(v => v.id === 'second')!
    expect(result.reviewSchedule?.earnedInterval).toBeCloseTo(expected)
    await page.getByRole('button', { name: 'Next Verse', exact: true }).click()
    await expect(page.locator('h1')).toContainText('Psalm 1:1')
  })
}

test('backup restore retains Rotation and earned spacing for a later maximum increase', async ({ page }) => {
  const verse = makeVerse('mature', 'Psalm 1:1', {
    interval: 30, lastReviewed: iso(-40), nextReviewDate: iso(-10),
    reviewSchedule: { earnedInterval: 90, anchorDate: iso(-40), appliedMaximumDays: 30, forceDue: false },
  })
  await seedVerses(page, [verse])
  await seedAppSettings(page, { reviewMode: 'rotation', maxReviewIntervalDays: 30 })
  await gotoApp(page, '?view=collections')
  await page.getByTestId('hamburger-button').click()
  await page.getByTestId('settings-backup').click()
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name: /Download Backup/i }).click()
  const download = await pending
  const backup = await readFile((await download.path())!, 'utf8')
  expect(JSON.parse(backup).verses[0].reviewSchedule.earnedInterval).toBe(90)
  await page.locator('#backup-file-input').setInputFiles({ name: 'review-backup.json', mimeType: 'application/json', buffer: Buffer.from(backup) })
  await page.getByTestId('modal-restore-backup-confirm').getByRole('button', { name: 'Restore' }).click()
  await page.getByTestId('modal-restore-backup-success').getByRole('button', { name: 'OK' }).click()
  expect((await storedVerses(page))[0].reviewSchedule?.earnedInterval).toBe(90)
  await openSettings(page)
  await expect(page.getByTestId('review-mode-rotation')).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByTestId('max-review-interval')).toHaveValue('30')
  await page.getByTestId('max-review-interval').fill('90')
  await page.getByTestId('apply-max-review-interval').click()
  expect((await storedVerses(page))[0].nextReviewDate).toBe(iso(50))
})

test('floating review action stays above tabs and leaves the last verse reachable on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 717 })
  await seedVerses(page, Array.from({ length: 20 }, (_, i) => makeVerse(`v${i}`, `Psalm ${i + 1}:1`, { nextReviewDate: iso(-1) })))
  await seedAppSettings(page, { reviewMode: 'rotation' })
  await gotoApp(page, '?view=review-list')
  const action = page.getByTestId('start-review-cta')
  await expect(action).toBeVisible()
  const initial = (await action.boundingBox())!
  const tabs = (await page.locator('nav').boundingBox())!
  expect(initial.y + initial.height).toBeLessThan(tabs.y)
  await page.locator('.app-view-panel--active .stagger-fade').first().evaluate(el => { el.scrollTop = el.scrollHeight })
  const after = (await action.boundingBox())!
  expect(after.y).toBe(initial.y)
  const last = (await page.locator('.app-view-panel--active .verse-card').last().boundingBox())!
  expect(last.y + last.height).toBeLessThan(after.y)
  await action.click()
  await expect(page.locator('h1')).toContainText('Psalm 1:1')
})
