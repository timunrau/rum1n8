import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { clearAppStorage, seedStorage, seedUiState } from '../helpers/storage'
import { gotoApp } from '../helpers/navigation'

test.beforeEach(async ({ page }) => {
  await gotoApp(page)
  await clearAppStorage(page)
  await page.reload()
})

async function addFirstVerseFromHero(page: Page, {
  reference = 'John 1:1',
  content = 'One two',
} = {}) {
  await gotoApp(page, '?view=collections')
  await expect(page.getByTestId('getting-started-card')).toBeVisible()

  await page.getByRole('button', { name: /Add your first verse/i }).click()
  await expect(page.getByTestId('modal-add-verse')).toBeVisible()

  await page.locator('#reference').fill(reference)
  await page.locator('#content').fill(content)
  await page.getByRole('button', { name: 'Add Verse' }).click()

  await expect(page.getByTestId('modal-add-verse')).not.toBeVisible()
  return { reference, content }
}

async function exitMemorization(page: Page) {
  await page.locator('header').getByRole('button').first().click()
  await expect(page.locator('#letter-input-memorize')).not.toBeAttached()
}

async function swipePracticeVerse(page: Page, direction: 'next' | 'previous') {
  const frame = page.locator('.practice-swipe-frame').first()
  await frame.evaluate((element, swipeDirection) => {
    const rect = element.getBoundingClientRect()
    const y = rect.top + rect.height / 2
    const startX = swipeDirection === 'next'
      ? rect.left + rect.width * 0.82
      : rect.left + rect.width * 0.18
    const endX = swipeDirection === 'next'
      ? rect.left + rect.width * 0.18
      : rect.left + rect.width * 0.82

    const touch = (clientX: number) => ({
      identifier: 1,
      target: element,
      clientX,
      clientY: y,
      screenX: clientX,
      screenY: y,
      pageX: clientX,
      pageY: y,
    })

    const dispatchTouch = (type: string, touches: Array<ReturnType<typeof touch>>, changedTouches = touches) => {
      const event = new Event(type, { bubbles: true, cancelable: true })
      Object.defineProperty(event, 'touches', { value: touches })
      Object.defineProperty(event, 'changedTouches', { value: changedTouches })
      element.dispatchEvent(event)
    }

    dispatchTouch('touchstart', [touch(startX)])
    dispatchTouch('touchmove', [touch(endX)], [touch(endX)])
    dispatchTouch('touchend', [], [touch(endX)])
  }, direction)
}

test('fresh storage shows the first-run hero card', async ({ page }) => {
  await gotoApp(page, '?view=collections')

  await expect(page.getByTestId('getting-started-card')).toBeVisible()
  await expect(page.getByText('Start ruminating')).toBeVisible()
  await expect(page.getByText('Choose a verse to get started.')).toBeVisible()
})

test('dismissing the first-run hero card persists across reload', async ({ page }) => {
  await gotoApp(page, '?view=collections')

  const heroCard = page.getByTestId('getting-started-card')
  await heroCard.getByLabel('Dismiss onboarding').click()

  await expect(heroCard).toBeHidden()
  await expect(page.getByText('No verses yet.')).toBeVisible()

  await page.reload()
  await expect(page.getByTestId('getting-started-card')).toBeHidden()
  await expect(page.getByText('No verses yet.')).toBeVisible()
})

test('adding a first verse through onboarding shows the verse callout', async ({ page }) => {
  const { reference } = await addFirstVerseFromHero(page)

  await expect(page.getByText(reference).first()).toBeVisible()
  await expect(page.getByText('Tap your verse to start memorizing it.')).toBeVisible()
})

test('first learn-mode hint shows once and stays dismissed after reload', async ({ page }) => {
  const { reference } = await addFirstVerseFromHero(page)

  await page.getByText(reference).first().click()
  await expect(page.locator('#letter-input-memorize')).toBeAttached()
  await expect(page.getByText('Type the first letter of each word.')).toBeVisible()

  await page.getByLabel('Dismiss practice modes help').click()
  await expect(page.getByText('Type the first letter of each word.')).toBeHidden()

  await exitMemorization(page)
  await page.reload()
  await page.getByText(reference).first().click()

  await expect(page.locator('#letter-input-memorize')).toBeAttached()
  await expect(page.getByText('Type the first letter of each word.')).toBeHidden()
})

test('desktop first practice aligns chrome, guidance, stages, and completion without narrowing the swipe frame', async ({ page }) => {
  const { reference } = await addFirstVerseFromHero(page)

  await page.getByText(reference).first().click()
  await expect(page.getByTestId('practice-mode-callout')).toBeVisible()

  const widths = await page.evaluate(() => {
    const width = (selector: string) => document.querySelector(selector)?.getBoundingClientRect().width || 0
    return {
      frame: width('.practice-swipe-frame'),
      header: width('.app-content-header__inner'),
      card: width('.practice-swipe-panel--active .practice-card'),
      guidance: width('[data-testid="practice-mode-callout"]'),
      stages: width('.practice-swipe-panel--active .practice-stage-rail'),
    }
  })

  expect(widths.frame).toBeGreaterThan(widths.card)
  for (const alignedWidth of [widths.header, widths.guidance, widths.stages]) {
    expect(Math.abs(alignedWidth - widths.card)).toBeLessThanOrEqual(1)
  }

  await page.locator('#letter-input-memorize').focus()
  await page.keyboard.type('ot', { delay: 50 })
  await expect(page.getByRole('button', { name: /Continue to Memorize/i })).toBeVisible()

  const completionWidth = await page.locator('.completion-tray').evaluate((element) => (
    element.getBoundingClientRect().width
  ))
  expect(Math.abs(completionWidth - widths.card)).toBeLessThanOrEqual(1)
})

test('memorization swipes keep target content, status-driven mode, and input focus live', async ({ page }) => {
  const now = new Date().toISOString()
  const verses = [
    {
      id: 'memorization-swipe-learn',
      reference: 'Psalm 1:1',
      content: 'Alpha first',
      bibleVersion: 'BSB',
      createdAt: now,
      lastModified: now,
      memorizationStatus: 'unmemorized',
      reviewCount: 0,
      lastReviewed: null,
      nextReviewDate: null,
      easeFactor: 2.5,
      interval: 0,
      reviewHistory: [],
      collectionIds: [],
    },
    {
      id: 'memorization-swipe-memorize',
      reference: 'Psalm 2:1',
      content: 'Beta second',
      bibleVersion: 'BSB',
      createdAt: now,
      lastModified: now,
      memorizationStatus: 'learned',
      reviewCount: 0,
      lastReviewed: null,
      nextReviewDate: null,
      easeFactor: 2.5,
      interval: 0,
      reviewHistory: [],
      collectionIds: [],
    },
  ]

  await seedStorage(page, verses, [])
  await seedUiState(page, {
    guidedOnboardingStep: 'practice',
    guidedOnboardingVerseId: verses[0].id,
    onboardingDismissed: false,
  })
  await page.reload()
  await gotoApp(page, '?view=collections')

  await page.getByText('Psalm 1:1').first().click()
  await expect(page.locator('.practice-swipe-panel--active .practice-card')).toContainText('Alpha')
  await page.locator('.practice-swipe-panel--active .mode-chip').filter({ hasText: 'Master' }).click()
  await expect(page.locator('.practice-swipe-panel--active .mode-chip[aria-current="step"]')).toContainText('Master')

  await swipePracticeVerse(page, 'next')

  await expect(page.locator('h1')).toContainText('Psalm 2:1')
  await expect(page.locator('.practice-swipe-panel--active .practice-card')).toContainText('Beta')
  await expect(page.locator('.practice-swipe-panel--active .practice-card')).not.toContainText('Alpha')
  await expect(page.locator('.practice-swipe-panel--active .mode-chip[aria-current="step"]')).toContainText('Memorize')
  await expect(page.locator('#letter-input-memorize')).toBeFocused()

  await swipePracticeVerse(page, 'previous')

  await expect(page.locator('h1')).toContainText('Psalm 1:1')
  await expect(page.locator('.practice-swipe-panel--active .practice-card')).toContainText('Alpha')
  await expect(page.locator('.practice-swipe-panel--active .mode-chip[aria-current="step"]')).toContainText('Learn')
  await expect(page.locator('#letter-input-memorize')).toBeFocused()
})

test('first-time memorize and master hints appear when advancing stages', async ({ page }) => {
  const { reference } = await addFirstVerseFromHero(page)

  await page.getByText(reference).first().click()
  await expect(page.locator('#letter-input-memorize')).toBeAttached()

  await page.locator('#letter-input-memorize').focus()
  await page.keyboard.type('ot', { delay: 50 })
  await page.getByRole('button', { name: /Continue to Memorize/i }).click()

  await expect(page.getByText('See if you can still do it with some of the words hidden.')).toBeVisible()

  await page.locator('#letter-input-memorize').focus()
  await page.keyboard.type('ot', { delay: 50 })
  await page.getByRole('button', { name: /Continue to Master/i }).click()

  await expect(page.getByText('Now try it without any words visible.')).toBeVisible()
})

test('exiting an incomplete first memorization session does not show the keep-memorizing callout', async ({ page }) => {
  const { reference } = await addFirstVerseFromHero(page)

  await page.getByText(reference).first().click()
  await expect(page.locator('#letter-input-memorize')).toBeAttached()

  await exitMemorization(page)

  await expect(page.getByText('Tap your verse to keep memorizing it.')).toBeHidden()
  await expect(page.getByText('Tap your verse to start memorizing it.')).toBeHidden()
})

test('mastering a first verse shows the review callout and dismiss persists across reload', async ({ page }) => {
  const verse = {
    id: 'first-master-review-cta',
    reference: 'Psalm 1:1',
    content: 'One two',
    bibleVersion: 'BSB',
    createdAt: new Date().toISOString(),
    lastModified: new Date().toISOString(),
    memorizationStatus: 'memorized',
    reviewCount: 0,
    lastReviewed: null,
    nextReviewDate: null,
    easeFactor: 2.5,
    interval: 0,
    reviewHistory: [],
    collectionIds: [],
  }

  await seedStorage(page, [verse], [])
  await seedUiState(page, {
    guidedOnboardingStep: 'practice',
    guidedOnboardingVerseId: verse.id,
    onboardingDismissed: false,
  })
  await page.reload()
  await gotoApp(page, '?view=collections')

  await page.getByText('Psalm 1:1').first().click()
  await expect(page.locator('#letter-input-memorize')).toBeAttached()

  await page.locator('#letter-input-memorize').focus()
  await page.keyboard.type('ot', { delay: 50 })
  await page.getByRole('button', { name: 'Done' }).click()

  await expect(page.getByText("You've mastered your first verse.")).toBeVisible()
  await expect(page.getByText('Review your verses each day to keep ruminating on the Word.')).toBeVisible()

  await page.getByLabel('Dismiss review callout').click()
  await expect(page.getByText("You've mastered your first verse.")).toBeHidden()

  await page.reload()
  await expect(page.getByText("You've mastered your first verse.")).toBeHidden()
})

test('starting the first review clears the review callout', async ({ page }) => {
  const verse = {
    id: 'first-master-start-review',
    reference: 'Psalm 2:1',
    content: 'One two',
    bibleVersion: 'BSB',
    createdAt: new Date().toISOString(),
    lastModified: new Date().toISOString(),
    memorizationStatus: 'memorized',
    reviewCount: 0,
    lastReviewed: null,
    nextReviewDate: null,
    easeFactor: 2.5,
    interval: 0,
    reviewHistory: [],
    collectionIds: [],
  }

  await seedStorage(page, [verse], [])
  await seedUiState(page, {
    guidedOnboardingStep: 'practice',
    guidedOnboardingVerseId: verse.id,
    onboardingDismissed: false,
  })
  await page.reload()
  await gotoApp(page, '?view=collections')

  await page.getByText('Psalm 2:1').first().click()
  await page.locator('#letter-input-memorize').focus()
  await page.keyboard.type('ot', { delay: 50 })
  await page.getByRole('button', { name: 'Done' }).click()

  await expect(page.getByText("You've mastered your first verse.")).toBeVisible()
  await page.getByTestId('almanac-start-review').click()

  await expect(page.locator('#letter-input-review')).toBeAttached()
  await expect(page.getByText("You've mastered your first verse.")).toBeHidden()
})
