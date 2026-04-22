import { test, expect } from '@playwright/test'
import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { clearAppStorage, seedStorage } from '../helpers/storage'
import { mockBibleApi } from '../helpers/mocks'
import { gotoApp } from '../helpers/navigation'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const sampleVerses = JSON.parse(
  readFileSync(path.join(__dirname, '../fixtures/sample-verses.json'), 'utf-8')
)

test.beforeEach(async ({ page }) => {
  await gotoApp(page)
  await clearAppStorage(page)
  await page.reload()
})

test('add verse: FAB -> New Verse -> reference + content (manual) -> add -> appears in list', async ({
  page,
}) => {
  await page.getByTestId('nav-collections').click()
  await page.getByTestId('fab-trigger').click()
  await page.getByTestId('fab-new-verse').click()

  await expect(page.getByTestId('modal-add-verse')).toBeVisible()
  await page.getByLabel(/Verse Reference/i).fill('John 3:16')
  await page.getByLabel(/Verse Content|Content/i).fill('For God so loved the world.')
  await page.getByRole('button', { name: /Save Verse/i }).click()

  await expect(page.getByTestId('modal-add-verse')).not.toBeVisible()
  await expect(page.getByText('John 3:16')).toBeVisible()
})

test('add verse: normalized and overlapping saved references show a subtle warning', async ({ page }) => {
  const verses = [
    {
      id: 'exact',
      reference: 'John 3:16',
      content: 'For God so loved the world.',
      bibleVersion: 'ESV',
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
    },
    {
      id: 'overlap',
      reference: 'John 3:16-17',
      content: 'For God so loved the world, and more.',
      bibleVersion: 'NIV',
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
    },
  ]

  await seedStorage(page, verses, [])
  await gotoApp(page, '?view=collections')
  await page.getByTestId('fab-trigger').click()
  await page.getByTestId('fab-new-verse').click()

  await expect(page.getByTestId('modal-add-verse')).toBeVisible()
  await page.getByLabel(/Verse Reference/i).fill('Jn 3:16')
  await expect(page.getByText('Already in your library: John 3:16 (ESV); John 3:16-17 (NIV)')).toBeVisible()
})

test.skip('add verse with Bible import: mock API -> enter reference + version -> Import Content', async ({
  page,
}) => {
  await mockBibleApi(page)
  await page.getByTestId('nav-collections').click()
  await page.getByTestId('fab-trigger').click()
  await page.getByTestId('fab-new-verse').click()

  await page.getByLabel(/Verse Reference/i).fill('John 3:16')
  await page.getByLabel(/Bible Version|Version/i).fill('BSB')
  await page.getByRole('button', { name: /Import Content/i }).click()

  await page.waitForTimeout(3000)
  const contentArea = page.locator('#content')
  await expect(contentArea).not.toHaveValue('')
})

test('edit verse: search on Verses tab -> edit -> change content -> save', async ({ page }) => {
  await seedStorage(page, sampleVerses, [])
  await gotoApp(page, '?view=collections')
  await page.getByTestId('search-bar').click()
  await page.getByPlaceholder(/Search verses/i).fill('John')
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: 'Edit verse' }).first().click()

  await expect(page.getByTestId('modal-edit-verse')).toBeVisible()
  await page.getByLabel(/Verse Content|Content/i).fill('Updated verse content.')
  await page.getByRole('button', { name: /^Save$/i }).click()

  await expect(page.getByTestId('modal-edit-verse')).not.toBeVisible()
  await expect(page.getByText('Updated verse content.')).toBeVisible()
})

test('edit verse: changing the reference shows duplicate warnings but ignores the verse itself', async ({ page }) => {
  await seedStorage(page, sampleVerses, [])
  await gotoApp(page, '?view=collections')
  await page.getByTestId('search-bar').click()
  await page.getByPlaceholder(/Search verses/i).fill('John')
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: 'Edit verse' }).first().click()

  await expect(page.getByTestId('modal-edit-verse')).toBeVisible()
  await expect(page.getByText(/Already in your library:/i)).toHaveCount(0)
  await page.getByLabel(/Verse Reference/i).fill('Ps 23:1')
  await expect(page.getByText('Already in your library: Psalm 23:1 (BSB)')).toBeVisible()
})

test('copy verse: copy button triggers copy', async ({ page }) => {
  await page.context().grantPermissions(['clipboard-write', 'clipboard-read'])
  await seedStorage(page, sampleVerses, [])
  await gotoApp(page, '?view=collections')
  await page.getByTestId('search-bar').click()
  await page.getByPlaceholder(/Search verses/i).fill('John')
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: 'Share verse' }).first().click()
  await expect(page.getByText(/Verse copied| copied/i)).toBeVisible({ timeout: 3000 })
})

test('search: type in search bar on Verses tab -> results filtered', async ({ page }) => {
  await seedStorage(page, sampleVerses, [])
  await gotoApp(page, '?view=collections')
  await page.getByTestId('search-bar').click()
  await page.getByPlaceholder(/Search verses/i).fill('Psalm')
  await page.waitForTimeout(500)
  const searchScreen = page.getByTestId('search-screen')
  await expect(searchScreen.getByRole('heading', { name: /Psalm 23:1/ })).toBeVisible()
  await expect(searchScreen.getByRole('heading', { name: /John 3:16/ })).not.toBeVisible()
})

test('search: clearing search restores collection cards', async ({ page }) => {
  const collections = [
    { id: 'col-1', name: 'My Collection', createdAt: '2024-01-01T00:00:00.000Z', lastModified: '2024-01-01T00:00:00.000Z' },
  ]
  await seedStorage(page, sampleVerses, collections)
  await gotoApp(page, '?view=collections')
  await page.getByTestId('search-bar').click()
  const searchInput = page.getByPlaceholder(/Search verses/i)

  await searchInput.fill('John')
  await page.waitForTimeout(500)
  await expect(page.getByText('John 3:16')).toBeVisible()

  // Close the search overlay via the back button
  await page.locator('header button').first().click()
  await page.waitForTimeout(300)
  // Collection cards should be visible again
  await expect(page.getByText('All Verses')).toBeVisible()
})
