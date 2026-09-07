import { test, expect, type Page } from '@playwright/test'
import { clearAppStorage, seedStorage } from '../helpers/storage'
import { gotoApp } from '../helpers/navigation'

const now = '2026-08-20T12:00:00.000Z'

function makeVerse(id: string, reference: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    reference,
    content: id,
    bibleVersion: 'BSB',
    createdAt: now,
    lastModified: now,
    memorizationStatus: 'mastered',
    masteredAt: now,
    reviewCount: 1,
    lastReviewed: '2026-08-10T12:00:00.000Z',
    nextReviewDate: '2026-08-19T12:00:00.000Z',
    easeFactor: 2.5,
    interval: 1,
    reviewHistory: [],
    collectionIds: ['sorting'],
    ...overrides,
  }
}

async function visibleVerseOrder(page: Page) {
  return page.locator('.verse-card__reference').evaluateAll(nodes => (
    nodes.map(node => node.getAttribute('aria-label'))
  ))
}

async function openSortSheet(page: Page) {
  await page.getByTestId('collection-actions-trigger').click()
  await page.getByTestId('collection-sort-action').click()
  await expect(page.getByTestId('modal-verse-sort')).toBeVisible()
}

async function expectSortSheetClosed(page: Page) {
  await expect(page.getByTestId('modal-verse-sort')).toBeHidden()
  await expect.poll(() => page.evaluate(() => window.history.state?.modal || null)).toBeNull()
}

async function dismissSortSheet(page: Page, method: 'close' | 'backdrop' = 'close') {
  const sheet = page.getByTestId('modal-verse-sort')
  if (method === 'backdrop') {
    await sheet.locator('.modal-sheet-backdrop').click({ position: { x: 8, y: 8 } })
  } else {
    await sheet.getByRole('button', { name: 'Close' }).click()
  }
  await expectSortSheetClosed(page)
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

test.beforeEach(async ({ page }) => {
  await gotoApp(page)
  await clearAppStorage(page)
})

test('sort chooser applies choices live, keeps labels readable, and waits to be dismissed', async ({ page }) => {
  const verses = [
    makeVerse('psalm-2', 'Psalm 2:1', { createdAt: '2026-08-02T12:00:00.000Z' }),
    makeVerse('psalm-1', 'Psalm 1:1', { createdAt: '2026-08-01T12:00:00.000Z' }),
    makeVerse('psalm-3', 'Psalm 3:1', { createdAt: '2026-08-03T12:00:00.000Z' }),
  ]
  const collections = [{ id: 'sorting', name: 'Sorting', parentId: null, createdAt: now, lastModified: now }]
  await seedStorage(page, verses, collections)
  await gotoApp(page, '?view=collection&collection=sorting')

  await expect.poll(() => visibleVerseOrder(page)).toEqual(['Psalm 1:1', 'Psalm 2:1', 'Psalm 3:1'])
  await openSortSheet(page)
  await page.getByTestId('verse-sort-option-createdAt').click()
  await expect(page.getByTestId('modal-verse-sort')).toBeVisible()
  const newestFirst = page.getByRole('radio', { name: 'Newest first' })
  await expect(newestFirst).toHaveAttribute('aria-checked', 'true')
  await expect(newestFirst).toHaveClass(/text-text-primary/)
  await expect(newestFirst).not.toHaveClass(/bg-action/)
  await expect(page.getByTestId('verse-sort-done')).toHaveCount(0)
  await expect.poll(() => visibleVerseOrder(page)).toEqual(['Psalm 3:1', 'Psalm 2:1', 'Psalm 1:1'])
  await dismissSortSheet(page, 'backdrop')

  await openSortSheet(page)
  await expect(newestFirst).toHaveAttribute('aria-checked', 'true')
  await page.getByRole('radio', { name: 'Oldest first' }).click()
  await expect(page.getByTestId('modal-verse-sort')).toBeVisible()
  await expect.poll(() => visibleVerseOrder(page)).toEqual(['Psalm 1:1', 'Psalm 2:1', 'Psalm 3:1'])
  await dismissSortSheet(page)

  await page.reload()
  await expect.poll(() => visibleVerseOrder(page)).toEqual(['Psalm 1:1', 'Psalm 2:1', 'Psalm 3:1'])
})

test('sort action appears on the flat library and unavailable criteria explain why', async ({ page }) => {
  const verses = [
    makeVerse('learning-2', 'Psalm 2:1', {
      memorizationStatus: 'unmemorized',
      masteredAt: null,
      lastReviewed: null,
      nextReviewDate: null,
      collectionIds: [],
    }),
    makeVerse('learning-1', 'Psalm 1:1', {
      memorizationStatus: 'learned',
      masteredAt: null,
      lastReviewed: null,
      nextReviewDate: null,
      collectionIds: [],
    }),
  ]
  await seedStorage(page, verses, [])
  await gotoApp(page, '?view=collections')

  await expect(page.getByTestId('collection-actions-trigger')).toBeVisible()
  await openSortSheet(page)
  const masteredOption = page.getByTestId('verse-sort-option-masteredAt')
  await expect(masteredOption).toBeDisabled()
  await expect(masteredOption).toContainText('No mastered dates')
})

test('active last-reviewed sequence stays frozen after the first review changes its date', async ({ page }) => {
  const verses = [
    makeVerse('alpha', 'Psalm 3:1', { content: 'Alpha one', lastReviewed: '2026-08-01T12:00:00.000Z' }),
    makeVerse('beta', 'Psalm 1:1', { content: 'Beta two', lastReviewed: '2026-08-02T12:00:00.000Z' }),
    makeVerse('gamma', 'Psalm 2:1', { content: 'Gamma three', lastReviewed: '2026-08-03T12:00:00.000Z' }),
  ]
  const collections = [{ id: 'sorting', name: 'Sorting', parentId: null, createdAt: now, lastModified: now }]
  await seedStorage(page, verses, collections)
  await gotoApp(page, '?view=collection&collection=sorting')
  await openSortSheet(page)
  await page.getByTestId('verse-sort-option-lastReviewed').click()
  await dismissSortSheet(page)

  await expect.poll(() => visibleVerseOrder(page)).toEqual(['Psalm 3:1', 'Psalm 1:1', 'Psalm 2:1'])
  await page.getByText('Psalm 3:1').click()
  await expect.poll(() => page.evaluate(() => window.history.state?.practiceSequence)).toMatchObject({
    verseIds: ['alpha', 'beta', 'gamma'],
    cursor: 0,
  })
  await expect(page.locator('.practice-swipe-panel--active .practice-card')).toContainText('Alpha')
  await expect(page.locator('.practice-swipe-panel--active .mode-chip[aria-current="step"]')).toContainText('Master')
  await expect(page.locator('#letter-input-review')).toBeFocused()
  await page.keyboard.type('ao', { delay: 50 })
  await page.getByRole('button', { name: 'Next Verse' }).click()

  await expect(page.locator('h1')).toContainText('Psalm 1:1')
  await expect.poll(() => page.evaluate(() => window.history.state?.practiceSequence?.cursor)).toBe(1)
  await swipePracticeVerse(page, 'previous')
  await expect(page.locator('h1')).toContainText('Psalm 3:1')
})

test('collection sort does not change Review-tab schedule ordering', async ({ page }) => {
  const verses = [
    makeVerse('later-due', 'Psalm 1:1', { nextReviewDate: '2026-08-19T12:00:00.000Z' }),
    makeVerse('earlier-due', 'Psalm 3:1', { nextReviewDate: '2026-08-18T12:00:00.000Z' }),
  ]
  const collections = [{ id: 'sorting', name: 'Sorting', parentId: null, createdAt: now, lastModified: now }]
  await seedStorage(page, verses, collections)
  await gotoApp(page, '?view=collection&collection=sorting')
  await openSortSheet(page)
  await page.getByTestId('verse-sort-option-reference').click()
  await dismissSortSheet(page)

  await page.getByLabel('Back').click()
  await page.getByTestId('nav-review').click()
  await expect.poll(() => visibleVerseOrder(page)).toEqual(['Psalm 3:1', 'Psalm 1:1'])
})

test('sort preferences are independent for each collection', async ({ page }) => {
  const verses = [
    makeVerse('a-psalm-2', 'Psalm 2:1', { createdAt: '2026-08-04T12:00:00.000Z', collectionIds: ['a'] }),
    makeVerse('a-psalm-1', 'Psalm 1:1', { createdAt: '2026-08-03T12:00:00.000Z', collectionIds: ['a'] }),
    makeVerse('b-psalm-2', 'Psalm 2:1', { createdAt: '2026-08-05T12:00:00.000Z', collectionIds: ['b'] }),
    makeVerse('b-psalm-1', 'Psalm 1:1', { createdAt: '2026-08-06T12:00:00.000Z', collectionIds: ['b'] }),
  ]
  const collections = [
    { id: 'a', name: 'Collection A', parentId: null, createdAt: now, lastModified: now },
    { id: 'b', name: 'Collection B', parentId: null, createdAt: now, lastModified: now },
  ]
  await seedStorage(page, verses, collections)
  await gotoApp(page, '?view=collection&collection=a')

  await openSortSheet(page)
  await page.getByTestId('verse-sort-option-createdAt').click()
  await dismissSortSheet(page)
  await expect.poll(() => visibleVerseOrder(page)).toEqual(['Psalm 2:1', 'Psalm 1:1'])

  await gotoApp(page, '?view=collection&collection=b')
  await expect.poll(() => visibleVerseOrder(page)).toEqual(['Psalm 1:1', 'Psalm 2:1'])

  await gotoApp(page, '?view=collection&collection=a')
  await expect.poll(() => visibleVerseOrder(page)).toEqual(['Psalm 2:1', 'Psalm 1:1'])
  await page.reload()
  await expect.poll(() => visibleVerseOrder(page)).toEqual(['Psalm 2:1', 'Psalm 1:1'])
})

test('sort action is available in every built-in collection view', async ({ page }) => {
  const verses = [
    makeVerse('mastered-1', 'Psalm 1:1', { collectionIds: [] }),
    makeVerse('mastered-2', 'Psalm 2:1', { collectionIds: [] }),
    makeVerse('learning-1', 'Psalm 3:1', { memorizationStatus: 'unmemorized', masteredAt: null, collectionIds: [] }),
    makeVerse('learning-2', 'Psalm 4:1', { memorizationStatus: 'learned', masteredAt: null, collectionIds: [] }),
  ]
  await seedStorage(page, verses, [])

  for (const collectionId of ['master-list', 'no-collection', 'to-learn']) {
    await gotoApp(page, `?view=collection&collection=${collectionId}`)
    await expect(page.getByTestId('collection-actions-trigger')).toBeVisible()
    await page.getByTestId('collection-actions-trigger').click()
    await expect(page.getByTestId('collection-sort-action')).toBeVisible()
    await page.keyboard.press('Escape')
  }
})

test('history and reload restore the original frozen sequence after dates reorder the collection', async ({ page }) => {
  const verses = [
    makeVerse('alpha', 'Psalm 3:1', { content: 'Alpha one', lastReviewed: '2026-08-01T12:00:00.000Z' }),
    makeVerse('beta', 'Psalm 1:1', { content: 'Beta two', lastReviewed: '2026-08-02T12:00:00.000Z' }),
    makeVerse('gamma', 'Psalm 2:1', { content: 'Gamma three', lastReviewed: '2026-08-03T12:00:00.000Z' }),
  ]
  const collections = [{ id: 'sorting', name: 'Sorting', parentId: null, createdAt: now, lastModified: now }]
  await seedStorage(page, verses, collections)
  await gotoApp(page, '?view=collection&collection=sorting')
  await openSortSheet(page)
  await page.getByTestId('verse-sort-option-lastReviewed').click()
  await dismissSortSheet(page)

  await page.getByText('Psalm 3:1').click()
  await expect(page.locator('#letter-input-review')).toBeFocused()
  await page.keyboard.type('ao', { delay: 50 })
  await expect(page.getByRole('button', { name: 'Next Verse' })).toBeVisible()

  await page.reload()
  await expect(page.locator('h1')).toContainText('Psalm 3:1')
  await expect(page.locator('#letter-input-review')).toBeFocused()
  await page.keyboard.type('ao', { delay: 50 })
  await page.getByRole('button', { name: 'Next Verse' }).click()
  await expect(page.locator('h1')).toContainText('Psalm 1:1')

  await page.goBack()
  await expect(page).toHaveURL(/\?view=collection&collection=sorting/)
  await page.goForward()
  await expect(page.locator('h1')).toContainText('Psalm 1:1')
  await expect(page.locator('#letter-input-review')).toBeFocused()
  await page.keyboard.type('bt', { delay: 50 })
  await page.getByRole('button', { name: 'Next Verse' }).click()
  await expect(page.locator('h1')).toContainText('Psalm 2:1')
})

test('opening a practice URL without history state creates a fresh sorted sequence', async ({ page, context }) => {
  const verses = [
    makeVerse('alpha', 'Psalm 3:1', { content: 'Alpha one', lastReviewed: '2026-08-01T12:00:00.000Z' }),
    makeVerse('beta', 'Psalm 1:1', { content: 'Beta two', lastReviewed: '2026-08-02T12:00:00.000Z' }),
    makeVerse('gamma', 'Psalm 2:1', { content: 'Gamma three', lastReviewed: '2026-08-03T12:00:00.000Z' }),
  ]
  const collections = [{ id: 'sorting', name: 'Sorting', parentId: null, createdAt: now, lastModified: now }]
  await seedStorage(page, verses, collections)
  await gotoApp(page, '?view=collection&collection=sorting')
  await openSortSheet(page)
  await page.getByTestId('verse-sort-option-lastReviewed').click()
  await dismissSortSheet(page)

  await page.getByText('Psalm 3:1').click()
  await expect(page.locator('#letter-input-review')).toBeFocused()
  await page.keyboard.type('ao', { delay: 50 })
  await expect.poll(() => page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem('rum1n8-verses') || '[]')
    return stored.find((verse: { id: string }) => verse.id === 'alpha')?.lastReviewed
  })).not.toBe('2026-08-01T12:00:00.000Z')

  const sharedPage = await context.newPage()
  await sharedPage.goto(page.url())
  await expect(sharedPage.locator('h1')).toContainText('Psalm 3:1')
  await expect.poll(() => sharedPage.evaluate(() => window.history.state?.practiceSequence)).toMatchObject({
    verseIds: ['beta', 'gamma', 'alpha'],
    cursor: 2,
  })
  await sharedPage.close()
})

test('passage review does not gather canonical neighbors separated by the visible sort', async ({ page }) => {
  const verses = [
    makeVerse('john-16', 'John 3:16', { content: 'Alpha one', lastReviewed: '2026-08-01T12:00:00.000Z' }),
    makeVerse('psalm', 'Psalm 23:1', { content: 'Middle verse', lastReviewed: '2026-08-02T12:00:00.000Z' }),
    makeVerse('john-17', 'John 3:17', { content: 'Beta two', lastReviewed: '2026-08-03T12:00:00.000Z' }),
  ]
  const collections = [{ id: 'sorting', name: 'Sorting', parentId: null, createdAt: now, lastModified: now }]
  await seedStorage(page, verses, collections)
  await gotoApp(page, '?view=collection&collection=sorting')
  await openSortSheet(page)
  await page.getByTestId('verse-sort-option-lastReviewed').click()
  await dismissSortSheet(page)

  await page.getByText('John 3:16').click()
  await expect(page.getByTestId('modal-passage-review-offer')).toBeHidden()
  await expect(page.locator('#letter-input-review')).toBeFocused()
})

test('review-to-memorization handoff retains the full visible sequence and cursor', async ({ page }) => {
  const verses = [
    makeVerse('review-first', 'Psalm 3:1', { content: 'Alpha one', createdAt: '2026-08-03T12:00:00.000Z' }),
    makeVerse('learn-second', 'Psalm 1:1', {
      content: 'Beta two',
      createdAt: '2026-08-02T12:00:00.000Z',
      memorizationStatus: 'unmemorized',
      masteredAt: null,
      lastReviewed: null,
      nextReviewDate: null,
    }),
    makeVerse('review-third', 'Psalm 2:1', { content: 'Gamma three', createdAt: '2026-08-01T12:00:00.000Z' }),
  ]
  const collections = [{ id: 'sorting', name: 'Sorting', parentId: null, createdAt: now, lastModified: now }]
  await seedStorage(page, verses, collections)
  await gotoApp(page, '?view=collection&collection=sorting')
  await openSortSheet(page)
  await page.getByTestId('verse-sort-option-createdAt').click()
  await dismissSortSheet(page)

  await expect.poll(() => visibleVerseOrder(page)).toEqual(['Psalm 3:1', 'Psalm 1:1', 'Psalm 2:1'])
  await page.getByText('Psalm 3:1').click()
  await expect(page.locator('#letter-input-review')).toBeFocused()
  await page.keyboard.type('ao', { delay: 50 })
  await page.getByRole('button', { name: 'Next Verse' }).click()

  await expect(page.locator('h1')).toContainText('Psalm 1:1')
  await expect(page.locator('.practice-swipe-panel--active .mode-chip[aria-current="step"]')).toContainText('Learn')
  await expect.poll(() => page.evaluate(() => window.history.state?.practiceSequence)).toMatchObject({
    verseIds: ['review-first', 'learn-second', 'review-third'],
    cursor: 1,
    sourceState: { view: 'collection', collectionId: 'sorting' },
  })
})

test('a restored session returns to the collections root when its origin was deleted', async ({ page }) => {
  const verses = [
    makeVerse('first', 'Psalm 1:1', { content: 'Alpha one' }),
    makeVerse('second', 'Psalm 2:1', { content: 'Beta two' }),
  ]
  const collections = [{ id: 'sorting', name: 'Sorting', parentId: null, createdAt: now, lastModified: now }]
  await seedStorage(page, verses, collections)
  await gotoApp(page, '?view=collection&collection=sorting')
  await page.getByText('Psalm 1:1').click()
  await expect(page.locator('#letter-input-review')).toBeFocused()

  await page.evaluate(() => localStorage.setItem('rum1n8-collections', '[]'))
  await page.reload()
  await expect(page.locator('h1')).toContainText('Psalm 1:1')
  await page.getByLabel('Back').click()

  await expect(page).toHaveURL(/\?view=collections$/)
  await expect(page.getByText('Your Verses', { exact: true })).toBeVisible()
})
