import { test, expect, type Page } from '@playwright/test'
import { clearAppStorage, getStoredVerses, seedAppSettings, seedStorage, seedUiState } from '../helpers/storage'
import { gotoApp } from '../helpers/navigation'

const now = new Date('2026-11-12T18:00:00.000Z')
const verse = {
  id: 'stats-verse', reference: 'Romans 8:28', bibleVersion: 'BSB',
  content: 'God is love and we love him.', memorizationStatus: 'mastered',
  createdAt: '2026-10-01T18:00:00.000Z', masteredAt: '2026-10-02T18:00:00.000Z',
  lastModified: '2026-11-08T18:00:00.000Z', lastReviewed: '2026-11-08T18:00:00.000Z',
  nextReviewDate: '2026-11-22T18:00:00.000Z', interval: 14, easeFactor: 1.68, reviewCount: 2,
  lastAccuracy: '98', lastGrade: 4.5, srsVersion: 2, collectionIds: [],
  reviewSchedule: { earnedInterval: 21, anchorDate: '2026-11-08T18:00:00.000Z', appliedMaximumDays: 14, forceDue: false },
  reviewHistory: [
    { date: '2026-11-01T18:00:00.000Z', accuracy: 82, mistakes: 9, grade: 3 },
    { date: '2026-11-08T17:00:00.000Z', accuracy: 100, mistakes: 0, grade: 5 },
    { date: '2026-11-08T18:00:00.000Z', accuracy: 98, mistakes: 1, grade: 4.5 },
  ],
}

const sheet = (page: Page) => page.getByTestId('modal-verse-stats')
const row = (page: Page) => page.locator('.verse-card').filter({ hasText: verse.reference }).first()
async function seed(page: Page, settings = {}, records: unknown[] = [verse]) {
  await seedStorage(page, records, [])
  await seedAppSettings(page, { statsForNerds: true, maxReviewIntervalDays: 14, ...settings })
  await gotoApp(page, '?view=review-list')
}
async function openSettings(page: Page) {
  await page.getByTestId('hamburger-button').click()
  await page.getByTestId('settings-practice').click()
  return page.getByTestId('modal-practice-settings')
}
async function assertClosed(page: Page) {
  await expect(sheet(page)).not.toBeVisible()
  await expect.poll(() => page.evaluate(() => history.state?.modal)).not.toBe('verseStats')
}

test.use({ timezoneId: 'America/Winnipeg' })
test.beforeEach(async ({ page }) => {
  await gotoApp(page)
  await clearAppStorage(page)
  await seedUiState(page, { onboardingDismissed: true })
  await page.clock.setFixedTime(now)
})

test('the final settings toggle defaults off, persists, and gates all stats access', async ({ page }) => {
  await seedStorage(page, [verse], [])
  await gotoApp(page, '?view=collections')
  const settings = await openSettings(page)
  const toggle = settings.getByRole('switch', { name: 'Stats for nerds', exact: true })
  await expect(toggle).toHaveAttribute('aria-checked', 'false')
  await expect(settings.locator('section').last()).toContainText('Tap and hold a verse in Review')
  await toggle.click()
  await settings.getByRole('button', { name: 'Done', exact: true }).click()
  await page.reload()
  await openSettings(page)
  await expect(toggle).toHaveAttribute('aria-checked', 'true')
  await settings.getByRole('button', { name: 'Done', exact: true }).click()
  await page.getByTestId('nav-review').click()
  await row(page).hover()
  await page.mouse.down()
  await expect(sheet(page)).toBeVisible()
  await page.mouse.up()
  await page.keyboard.press('Escape')
  await assertClosed(page)
  await page.getByTestId('nav-collections').click()
  await openSettings(page)
  await toggle.click()
  await settings.getByRole('button', { name: 'Done', exact: true }).click()
  await gotoApp(page, '?view=review-list')
  await expect(row(page)).not.toHaveAttribute('tabindex', '0')
  await row(page).click({ button: 'right' })
  await expect(sheet(page)).not.toBeVisible()
  await row(page).click()
  await expect(page.locator('#letter-input-review')).toBeAttached()
  await expect(page.getByTestId('practice-verse-stats')).toHaveCount(0)
  await gotoApp(page, '?view=collections')
  await page.getByRole('button', { name: 'Edit verse' }).first().click()
  await expect(page.getByTestId('verse-stats-panel')).toHaveCount(0)
})

for (const mode of ['classic', 'rotation']) {
  test(`${mode}: holding a verse opens the final stats layout without starting or recording a review`, async ({ page }) => {
    await seed(page, { reviewMode: mode })
    const before = await getStoredVerses(page)
    await row(page).hover()
    await page.mouse.down()
    await expect(sheet(page)).toBeVisible()
    await page.mouse.up()
    const stats = sheet(page).getByTestId('verse-stats-panel')
    await expect(sheet(page).getByRole('heading', { name: verse.reference, exact: true })).toBeVisible()
    await expect(stats).toContainText('Due in 10 days')
    await expect(stats.locator('.verse-stats__metrics > div').nth(1)).toHaveText('3Times reviewed')
    await expect(stats.locator('.verse-stats__metrics > div').nth(2)).toHaveText('93%Average accuracy')
    await expect(stats.getByRole('heading', { name: 'Accuracy', exact: true })).toBeVisible()
    await expect(stats.locator('canvas')).toBeVisible()
    await expect(stats).toContainText('Earned spacing21 days')
    await expect(stats).toContainText('Last review Nov 8, 2026')
    await expect(stats).not.toContainText(/grade|Counted days|Review history|Recall trail|Recorded accuracy over time/i)
    await expect(page.locator('#letter-input-review')).toHaveCount(0)
    await page.keyboard.press('Escape')
    await assertClosed(page)
    await expect(row(page)).toBeFocused()
    expect(await getStoredVerses(page)).toEqual(before)
    await row(page).focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('#letter-input-review')).toBeAttached()
  })
}

test('movement, scrolling, and pointer cancellation cancel a pending hold', async ({ page }) => {
  await seed(page)
  const card = row(page)
  for (const reason of ['movement', 'scroll', 'pointercancel']) {
    await card.dispatchEvent('pointerdown', { isPrimary: true, button: 0, clientX: 20, clientY: 20 })
    if (reason === 'movement') await card.dispatchEvent('pointermove', { clientX: 40, clientY: 20 })
    else if (reason === 'scroll') await page.evaluate(() => document.dispatchEvent(new Event('scroll')))
    else await card.dispatchEvent('pointercancel')
    await page.waitForTimeout(550)
    await expect(sheet(page)).not.toBeVisible()
    await expect(page.locator('#letter-input-review')).toHaveCount(0)
  }
})

test('keyboard and context menu open stats, trap focus, and support browser Back', async ({ page }) => {
  await seed(page)
  await row(page).focus()
  await page.keyboard.press('Shift+F10')
  await expect(sheet(page)).toBeVisible()
  const close = sheet(page).getByRole('button', { name: 'Close', exact: true })
  await expect(close).toBeFocused()
  await page.keyboard.press('Tab'); await expect(close).toBeFocused()
  await page.keyboard.press('Shift+Tab'); await expect(close).toBeFocused()
  await page.goBack(); await assertClosed(page)
  await expect(row(page)).toBeFocused()
  await row(page).click({ button: 'right' }); await expect(sheet(page)).toBeVisible()
  await close.click(); await assertClosed(page)
  await row(page).focus(); await page.keyboard.press('Enter')
  await expect(page.locator('#letter-input-review')).toBeAttached()
})

for (const context of ['review', 'memorization']) {
  test(`${context}: stats preserve progress in every practice mode through each dismissal`, async ({ page }) => {
    await seed(page)
    await gotoApp(page, `?view=${context}&verse=${verse.id}&mode=learn`)
    const input = page.locator(context === 'review' ? '#letter-input-review' : '#letter-input-memorize')
    await expect(input).toBeAttached()
    for (const mode of ['Learn', 'Memorize', 'Master']) {
      await page.getByText(mode, { exact: true }).click()
      await input.focus()
      await page.keyboard.type('g')
      const progress = () => page.locator('.practice-swipe-panel--active .practice-word').evaluateAll(words => words.map(word => ({ text: word.textContent, html: word.innerHTML, className: word.className })))
      const beforeProgress = await progress()
      const beforeVerses = await getStoredVerses(page)
      for (const dismissal of ['back', 'escape', 'close', 'backdrop']) {
        const icon = page.getByRole('button', { name: 'Show verse stats', exact: true })
        await icon.click()
        await expect(sheet(page)).toBeVisible()
        if (dismissal === 'back') await page.goBack()
        else if (dismissal === 'escape') await page.keyboard.press('Escape')
        else if (dismissal === 'close') await sheet(page).getByRole('button', { name: 'Close', exact: true }).click()
        else await sheet(page).locator('.modal-sheet-backdrop').click({ position: { x: 2, y: 2 } })
        await assertClosed(page)
        await expect(input).toBeAttached()
        expect(await progress(), `${context}: ${mode}, ${dismissal}`).toEqual(beforeProgress)
        await expect(icon, `${context}: ${mode}, ${dismissal}`).toBeFocused()
        expect(await getStoredVerses(page)).toEqual(beforeVerses)
      }
    }
  })
}

test('edit stats use current scheduling and handle reset/undo without retaining old results', async ({ page }) => {
  await seed(page)
  await gotoApp(page, '?view=collections')
  const edit = page.getByTestId('modal-edit-verse')
  await page.getByRole('button', { name: 'Edit verse' }).first().click()
  await expect(edit.getByTestId('verse-stats-panel')).toBeVisible()
  await page.getByTestId('verse-schedule-change').click()
  await page.getByTestId('verse-schedule-popover').getByRole('button', { name: '+1w', exact: true }).click()
  await expect(edit.getByTestId('verse-stats-panel')).toContainText('Earned spacing7 days')
  await page.getByTestId('verse-schedule-reset').click()
  await expect(edit).not.toBeVisible()
  await page.getByRole('button', { name: 'Edit verse' }).first().click()
  await expect(edit.getByTestId('verse-stats-panel')).toContainText('Not scheduled')
  await expect(edit.getByTestId('verse-stats-panel')).toContainText('No recorded accuracy yet.')
  await expect(edit.locator('canvas')).toHaveCount(0)
  await edit.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.getByTestId('toast-action').click()
  await page.getByRole('button', { name: 'Edit verse' }).first().click()
  await expect(edit.locator('canvas')).toBeVisible()
  await expect(edit.getByTestId('verse-stats-panel')).toContainText('3Times reviewed')
})

test('combined passages hide the info icon while individual verse ranges support it', async ({ page }) => {
  await seed(page, {}, [
    { ...verse, id: 'one', reference: 'Psalm 1:1' },
    { ...verse, id: 'two', reference: 'Psalm 1:2' },
  ])
  await gotoApp(page, '?view=collection&collection=master-list')
  await page.getByText('Psalm 1:1', { exact: true }).first().click()
  await expect(page.getByTestId('modal-passage-review-offer')).toBeVisible()
  await page.getByTestId('passage-review-start').click()
  await expect(page.locator('#letter-input-review')).toBeAttached()
  await expect(page.getByTestId('practice-verse-stats')).toHaveCount(0)
  await seed(page, {}, [{ ...verse, reference: 'Romans 8:28-30' }])
  await row(page).click()
  await expect(page.getByTestId('practice-verse-stats')).toBeVisible()
})

test('mobile stats fill the viewport and legacy empty history renders without overflow', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await seed(page, {}, [{ ...verse, masteredAt: undefined, lastReviewed: null, reviewHistory: [], lastAccuracy: null }])
  await row(page).click({ button: 'right' })
  await expect(sheet(page)).toBeVisible()
  await expect(sheet(page)).toContainText('No recorded accuracy yet.')
  await expect(sheet(page)).toContainText('0Times reviewed')
  await expect.poll(() => sheet(page).locator('.modal-sheet-panel').evaluate(panel => Math.round(panel.getBoundingClientRect().height))).toBe(740)
  expect(await sheet(page).evaluate(element => element.scrollWidth > innerWidth)).toBe(false)
})
