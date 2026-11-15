import { test, expect, type Page } from '@playwright/test'
import { clearAppStorage, seedStorage } from '../helpers/storage'
import { gotoApp } from '../helpers/navigation'

const createdAt = '2026-08-01T12:00:00.000Z'

function collection(id: string, name: string, parentId: string | null = null) {
  return { id, name, parentId, description: 'A collection for practice.', createdAt, lastModified: createdAt }
}

function verse(
  id: string,
  reference: string,
  memorizationStatus: string,
  collectionIds: string[] = [],
  nextReviewDate: string | null = null,
) {
  return {
    id, reference, memorizationStatus, collectionIds, nextReviewDate,
    content: 'The Lord is my shepherd; I shall not want.',
    bibleVersion: 'BSB', createdAt, lastModified: createdAt,
    reviewCount: 0, lastReviewed: null, easeFactor: 2.5, interval: 7, reviewHistory: [],
  }
}

const collections = [
  collection('parent', 'Mixed collection with a longer title'),
  collection('child', 'Child', 'parent'),
  collection('sibling', 'Sibling', 'parent'),
  collection('grandchild', 'Grandchild', 'child'),
  collection('current', 'Up to date'),
  collection('due', 'Ready for review'),
  collection('unfinished', 'Unfinished only'),
  collection('empty', 'Empty'),
]

const verses = [
  // One saved range belongs to two sibling branches and must count once in the parent.
  verse('shared', 'Psalm 1:1-3', 'mastered', ['child', 'sibling']),
  verse('new', 'John 1:1', 'unmemorized', ['parent']),
  verse('learned', 'John 1:2-3', 'learned', ['child']),
  verse('memorized', 'Psalm 23', 'memorized', ['grandchild']),
  verse('current', 'John 3:16', 'mastered', ['current'], '2099-01-01T12:00:00.000Z'),
  verse('due', 'John 2:1-2', 'mastered', ['due'], '2020-01-01T12:00:00.000Z'),
  verse('unfinished', 'John 4:1-3', 'learned', ['unfinished']),
  verse('uncategorized-due', 'Psalm 150', 'mastered'),
  verse('uncategorized-new', 'John 5:1', 'unmemorized'),
]

function virtualCard(page: Page, name: string) {
  return page.locator('.collection-tile').filter({ has: page.getByRole('heading', { name, exact: true }) })
}

function summary(page: Page, id: string) {
  return page.getByTestId(`collection-tile-${id}`).locator('.collection-tile__meta > span')
}

function almanacCount(page: Page, label: string) {
  return page.locator('.almanac__stat')
    .filter({ has: page.locator('.almanac__label', { hasText: new RegExp(`^${label}$`) }) })
    .locator('.almanac__numeral')
}

test.beforeEach(async ({ page }) => {
  await gotoApp(page)
  await clearAppStorage(page)
  await seedStorage(page, verses, collections)
  await gotoApp(page, '?view=collections')
})

test('collection metadata counts all unfinished stages, ranges, and chapters and omits zero statuses', async ({ page }) => {
  await expect(virtualCard(page, 'All Verses').locator('.collection-tile__meta > span'))
    .toHaveText(['25 verses', '13 unmastered', '11 due'])
  await expect(virtualCard(page, 'Uncategorized').locator('.collection-tile__meta > span'))
    .toHaveText(['7 verses', '1 unmastered', '6 due'])
  await expect(virtualCard(page, 'Unmastered').locator('.collection-tile__meta > span')).toHaveText(['13 verses'])
  await expect(summary(page, 'parent')).toHaveText(['12 verses', '9 unmastered', '3 due'])
  await expect(summary(page, 'current')).toHaveText(['1 verse'])
  await expect(summary(page, 'due')).toHaveText(['2 verses', '2 due'])
  await expect(summary(page, 'unfinished')).toHaveText(['3 verses', '3 unmastered'])
  await expect(summary(page, 'empty')).toHaveText(['0 verses'])
  await expect(page.locator('.collection-tile .pos-badge-el')).toHaveCount(0)

  await virtualCard(page, 'Unmastered').click()
  await expect(page).toHaveURL(/collection=to-learn/)
  await expect(page.locator('.verse-card')).toHaveCount(5)
})

test('nested summaries include every descendant and deduplicate shared verses while navigation stays direct', async ({ page }) => {
  await page.getByTestId('collection-tile-parent').click()
  await expect(summary(page, 'child')).toHaveText(['11 verses', '8 unmastered', '3 due'])
  await expect(summary(page, 'sibling')).toHaveText(['3 verses', '3 due'])
  await expect(page.locator('.verse-card')).toHaveCount(1)
  await expect(page.locator('.verse-card')).toContainText('John 1:1')

  await page.getByTestId('collection-tile-child').click()
  await expect(summary(page, 'grandchild')).toHaveText(['6 verses', '6 unmastered'])
  await expect(page.locator('.verse-card')).toHaveCount(2)
  await page.getByTestId('collection-tile-grandchild').getByTitle('Edit collection').click()
  await expect(page.getByTestId('modal-edit-collection')).toBeVisible()
  await expect(page).toHaveURL(/collection=child/)
})

test('almanacs, the review CTA, and the navigation badge use individual verse counts', async ({ page }) => {
  for (const tab of ['nav-collections', 'nav-stats']) {
    await page.getByTestId(tab).click()
    await expect(almanacCount(page, 'due')).toHaveText('11')
    await expect(almanacCount(page, 'mastered')).toHaveText('12')
    await expect(page.getByTestId('nav-review').locator('span').filter({ hasText: /^11$/ })).toBeVisible()
  }
  await page.getByTestId('nav-review').click()
  await expect(page.getByRole('button', { name: 'Start review · 11 due', exact: true })).toBeVisible()
  await expect(page.getByTestId('nav-review').locator('span').filter({ hasText: /^11$/ })).toBeVisible()
})

test('summary lines stay compact in mobile and three-column desktop layouts in both themes', async ({ page }) => {
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 1100 })
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' })
      await expect(virtualCard(page, 'All Verses')).toBeVisible()
      const geometry = await page.locator('.collection-tile').evaluateAll(cards => cards.map(card => {
        const meta = card.querySelector('.collection-tile__meta')!
        const lines = new Set(Array.from(meta.children, child => Math.round(child.getBoundingClientRect().top))).size
        const title = card.querySelector('h3')!.getBoundingClientRect()
        const edit = card.querySelector('button[title="Edit collection"]')?.getBoundingClientRect()
        return {
          lines,
          overflows: meta.scrollWidth > meta.clientWidth,
          editOverlapsTitle: edit ? title.right > edit.left : false,
        }
      }))
      for (const card of geometry) {
        expect(card).toEqual({ lines: 1, overflows: false, editOverlapsTitle: false })
      }
    }
  }
})

test('resetting progress updates the collection summary and global counts without reloading', async ({ page }) => {
  await page.getByTestId('collection-tile-due').click()
  await page.getByRole('button', { name: 'Edit verse', exact: true }).click()
  await page.getByTestId('verse-schedule-reset').click()
  await expect(page.getByTestId('modal-edit-verse')).not.toBeVisible()
  await page.locator('header button').first().click()
  await expect(summary(page, 'due')).toHaveText(['2 verses', '2 unmastered'])
  await expect(virtualCard(page, 'All Verses').locator('.collection-tile__meta > span'))
    .toHaveText(['25 verses', '15 unmastered', '9 due'])
  await expect(almanacCount(page, 'due')).toHaveText('9')
  await expect(almanacCount(page, 'mastered')).toHaveText('10')
})

test.describe('calendar rollover', () => {
  test.use({ timezoneId: 'America/Winnipeg' })

  test('a newly due range updates the cached collection summary without reloading', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-08-08T04:59:30.000Z') })
    await seedStorage(page, [
      verse('midnight', 'Psalm 1:1-3', 'mastered', ['due'], '2026-08-08T18:00:00.000Z'),
    ], [collection('due', 'Ready for review')])
    await gotoApp(page, '?view=collections')
    await expect(summary(page, 'due')).toHaveText(['3 verses'])
    await expect(almanacCount(page, 'due')).toHaveText('0')

    await page.clock.runFor(60_000)

    await expect(summary(page, 'due')).toHaveText(['3 verses', '3 due'])
    await expect(virtualCard(page, 'All Verses').locator('.collection-tile__meta > span')).toHaveText(['3 verses', '3 due'])
    await expect(almanacCount(page, 'due')).toHaveText('3')
    await expect(page.getByTestId('nav-review').locator('span').filter({ hasText: /^3$/ })).toBeVisible()
  })
})
