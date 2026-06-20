import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { clearAppStorage, getStoredVerses, seedStorage, seedUiState } from '../helpers/storage'
import { gotoApp } from '../helpers/navigation'

const now = '2026-06-20T12:00:00.000Z'

const collection = (id: string, name: string) => ({
  id,
  name,
  description: '',
  parentId: null,
  createdAt: now,
  lastModified: now,
})

const verse = (overrides: Record<string, unknown>) => ({
  id: 'verse',
  reference: 'John 3:16',
  content: 'For God so loved the world.',
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
  masteredAt: null,
  collectionIds: [],
  ...overrides,
})

const baseCollections = [
  collection('alpha', 'Alpha'),
  collection('beta', 'Beta'),
  collection('gamma', 'Gamma'),
]

async function seedReadyApp(page: Page, verses: unknown[], collections = baseCollections) {
  await seedStorage(page, verses, collections)
  await seedUiState(page, {
    hasOpenedApp: true,
    onboardingDismissed: true,
    guidedOnboardingStep: 'done',
    guidedOnboardingVerseId: null,
    practiceModeHintsSeen: { learn: true, memorize: true, master: true },
    practiceModesHintSeen: true,
  })
}

async function openSelectionMode(page: Page) {
  await page.getByTestId('verse-select-mode').click()
  await expect(page.getByTestId('verse-selection-bar')).toBeVisible()
}

async function getDeletedVerseEntries(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('rum1n8-deleted-verses') || '[]'))
}

function verseCard(page: Page, reference: string) {
  return page.locator('.verse-card').filter({ hasText: reference }).first()
}

test.beforeEach(async ({ page }) => {
  await gotoApp(page)
  await clearAppStorage(page)
  await page.reload()
})

test('select mode opens in virtual verse lists', async ({ page }) => {
  await seedReadyApp(page, [
    verse({ id: 'uncategorized', reference: 'John 3:16', collectionIds: [] }),
    verse({
      id: 'mastered',
      reference: 'Psalm 23:1',
      memorizationStatus: 'mastered',
      reviewCount: 3,
      lastReviewed: now,
      nextReviewDate: now,
      interval: 3,
      masteredAt: now,
      collectionIds: ['alpha'],
    }),
  ])

  for (const collectionId of ['master-list', 'no-collection', 'to-learn']) {
    await gotoApp(page, `?view=collection&collection=${collectionId}`)
    await openSelectionMode(page)
    await page.getByTestId('bulk-cancel').click()
    await expect(page.getByTestId('verse-selection-bar')).toHaveCount(0)
  }
})

test('selection mode keeps verse card height stable and blank space exits', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await seedReadyApp(page, [
    verse({ id: 'one', reference: 'John 3:16', collectionIds: ['alpha'] }),
    verse({ id: 'two', reference: 'Psalm 23:1', collectionIds: ['alpha'] }),
  ])
  await gotoApp(page, '?view=collection&collection=alpha')

  const card = page.locator('.verse-card').first()
  const before = await card.boundingBox()
  await openSelectionMode(page)
  const after = await card.boundingBox()

  expect(Math.abs((after?.height ?? 0) - (before?.height ?? 0))).toBeLessThan(0.5)

  await card.click()
  await page.mouse.click(200, 420)
  await expect(page.getByTestId('verse-selection-bar')).toHaveCount(0)
})

test('bulk add and move update collection membership', async ({ page }) => {
  await seedReadyApp(page, [
    verse({ id: 'john', reference: 'John 3:16', collectionIds: ['alpha'] }),
    verse({ id: 'psalm', reference: 'Psalm 23:1', collectionIds: ['alpha'] }),
  ])
  await gotoApp(page, '?view=collection&collection=alpha')

  await openSelectionMode(page)
  await verseCard(page, 'John 3:16').click()
  await verseCard(page, 'Psalm 23:1').click()
  await page.getByTestId('bulk-add-collection').click()
  await page.getByRole('button', { name: 'Beta', exact: true }).click()
  await page.getByTestId('modal-bulk-collection').getByRole('button', { name: 'Add' }).click()

  let stored = await getStoredVerses(page) as Array<{ id: string; collectionIds: string[] }>
  expect(stored.find((item) => item.id === 'john')?.collectionIds).toEqual(['alpha', 'beta'])
  expect(stored.find((item) => item.id === 'psalm')?.collectionIds).toEqual(['alpha', 'beta'])

  await gotoApp(page, '?view=collection&collection=alpha')
  await openSelectionMode(page)
  await verseCard(page, 'John 3:16').click()
  await page.getByTestId('bulk-move-collection').click()
  await page.getByRole('button', { name: 'Gamma', exact: true }).click()
  await page.getByTestId('modal-bulk-collection').getByRole('button', { name: 'Move' }).click()

  stored = await getStoredVerses(page) as Array<{ id: string; collectionIds: string[] }>
  expect(stored.find((item) => item.id === 'john')?.collectionIds).toEqual(['beta', 'gamma'])
  expect(stored.find((item) => item.id === 'psalm')?.collectionIds).toEqual(['alpha', 'beta'])
})

test('bulk review frequency changes only mastered selected verses', async ({ page }) => {
  await seedReadyApp(page, [
    verse({ id: 'new', reference: 'John 3:16', collectionIds: [] }),
    verse({
      id: 'mastered',
      reference: 'Psalm 23:1',
      memorizationStatus: 'mastered',
      reviewCount: 3,
      lastReviewed: now,
      nextReviewDate: now,
      interval: 3,
      masteredAt: now,
      collectionIds: [],
    }),
  ])
  await gotoApp(page, '?view=collection&collection=master-list')

  await openSelectionMode(page)
  await verseCard(page, 'John 3:16').click()
  await verseCard(page, 'Psalm 23:1').click()
  await page.getByTestId('bulk-schedule').click()
  await page.getByRole('button', { name: '+1w' }).click()

  const stored = await getStoredVerses(page) as Array<{
    id: string
    nextReviewDate: string | null
  }>
  expect(stored.find((item) => item.id === 'new')?.nextReviewDate).toBeNull()

  const masteredDate = stored.find((item) => item.id === 'mastered')?.nextReviewDate
  const diffDays = Math.round((new Date(masteredDate || '').getTime() - Date.now()) / 86_400_000)
  expect(diffDays).toBeGreaterThanOrEqual(6)
  expect(diffDays).toBeLessThanOrEqual(7)
})

test('bulk delete confirms and undo restores verses plus deletion markers', async ({ page }) => {
  await seedReadyApp(page, [
    verse({ id: 'john', reference: 'John 3:16', collectionIds: [] }),
    verse({ id: 'psalm', reference: 'Psalm 23:1', collectionIds: [] }),
  ])
  await gotoApp(page, '?view=collection&collection=master-list')

  await openSelectionMode(page)
  await verseCard(page, 'John 3:16').click()
  await verseCard(page, 'Psalm 23:1').click()
  await page.getByTestId('bulk-delete').click()
  await page
    .getByTestId('modal-delete-selected-verses-confirm')
    .getByRole('button', { name: 'Delete' })
    .click()

  let stored = await getStoredVerses(page) as Array<{ id: string }>
  expect(stored).toHaveLength(0)

  let deletedEntries = await getDeletedVerseEntries(page) as Array<{ id: string }>
  expect(deletedEntries.map((entry) => entry.id).sort()).toEqual(['john', 'psalm'])

  await page.getByTestId('toast-action').click()

  stored = await getStoredVerses(page) as Array<{ id: string }>
  expect(stored.map((item) => item.id).sort()).toEqual(['john', 'psalm'])

  deletedEntries = await getDeletedVerseEntries(page) as Array<{ id: string }>
  expect(deletedEntries).toEqual([])
})
