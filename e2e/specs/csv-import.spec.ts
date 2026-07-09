import { test, expect, type Page } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'
import { clearAppStorage, getStoredCollections, getStoredVerses, seedStorage } from '../helpers/storage'
import { gotoApp } from '../helpers/navigation'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function openCSVImport(page: Page) {
  await page.getByTestId('nav-collections').click()
  await page.getByTestId('fab-trigger').click()
  await page.getByTestId('fab-import-csv').click()
}

test.beforeEach(async ({ page }) => {
  await gotoApp(page)
  await clearAppStorage(page)
  await page.reload()
})

test('FAB -> Import CSV -> modal opens', async ({ page }) => {
  await page.getByTestId('nav-collections').click()
  await page.getByTestId('fab-trigger').click()
  await page.getByTestId('fab-import-csv').click()

  await expect(page.getByTestId('modal-import-csv')).toBeVisible()
  await expect(page.getByText(/Import Verses from CSV/i)).toBeVisible()
})

test('paste CSV: paste valid content -> preview shows verses', async ({ page }) => {
  const csvContent = `Reference,Content,Version,DaysUntilNextReview,Interval
John 3:16,"For God so loved the world",BSB,,`
  await page.getByTestId('nav-collections').click()
  await page.getByTestId('fab-trigger').click()
  await page.getByTestId('fab-import-csv').click()

  await page.getByPlaceholder(/Paste your CSV/i).fill(csvContent)
  await page.waitForTimeout(500)
  await expect(page.getByRole('button', { name: /Import 1 verse/i })).toBeVisible()
})

test('file upload: use input with sample-import.csv', async ({ page }) => {
  await page.getByTestId('nav-collections').click()
  await page.getByTestId('fab-trigger').click()
  await page.getByTestId('fab-import-csv').click()

  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles(path.join(__dirname, '../fixtures/sample-import.csv'))
  await page.waitForTimeout(500)
  await expect(page.getByRole('button', { name: /Import 2 verses/i })).toBeVisible()
})

test('select one destination -> import -> verses appear directly in it', async ({ page }) => {
  await page.getByTestId('nav-collections').click()
  await page.getByTestId('fab-trigger').click()
  await page.getByTestId('fab-new-collection').click()
  await page.getByLabel(/Collection Name/i).fill('Import Target')
  await page.getByRole('button', { name: /Create Collection/i }).click()
  await page.waitForTimeout(500)

  await page.getByTestId('fab-trigger').click()
  await page.getByTestId('fab-import-csv').click()
  const csvContent = `Reference,Content,Version
John 3:16,"For God so loved the world",BSB`
  await page.getByPlaceholder(/Paste your CSV/i).fill(csvContent)
  await page.waitForTimeout(500)
  await page.getByLabel('Import into').selectOption({ label: 'Import Target' })
  await page.getByRole('button', { name: /Import 1 verse/i }).click()
  await page.getByRole('button', { name: 'Done' }).click()
  await page.getByRole('heading', { name: 'Import Target' }).click()
  await expect(page.getByText('John 3:16')).toBeVisible()
})

test('CollectionPath creates nested collections beneath the import destination', async ({ page }) => {
  const now = new Date().toISOString()
  const target = {
    id: 'work',
    name: 'Work',
    description: '',
    parentId: null,
    createdAt: now,
    lastModified: now,
  }
  await seedStorage(page, [], [target])
  await gotoApp(page, '?view=collections')
  await page.getByTestId('collection-tile-work').click()
  await page.getByTestId('fab-trigger').click()
  await page.getByTestId('fab-import-csv').click()

  await expect(page.getByLabel('Import into')).toHaveValue('work')
  const csvContent = `Reference,Content,Version,CollectionPath
John 15:5,"Apart from me you can do nothing",NIV,Core Values/Abide in Christ
Philippians 2:3,"Value others above yourselves",NIV,Core Values/Humility`
  await page.getByPlaceholder(/Paste your CSV/i).fill(csvContent)
  await page.getByRole('button', { name: /Import 2 verses/i }).click()
  await expect(page.getByText(/Created 3 collections/i)).toBeVisible()

  const collections = await getStoredCollections(page) as Array<{
    id: string
    name: string
    parentId: string | null
  }>
  const coreValues = collections.find(collection => collection.name === 'Core Values')
  const abide = collections.find(collection => collection.name === 'Abide in Christ')
  const humility = collections.find(collection => collection.name === 'Humility')
  expect(coreValues?.parentId).toBe('work')
  expect(abide?.parentId).toBe(coreValues?.id)
  expect(humility?.parentId).toBe(coreValues?.id)
})

test('invalid CSV rows leave verses and planned nested collections unchanged', async ({ page }) => {
  const csvContent = `Reference,Content,CollectionPath,Interval
John 15:5,"Apart from me you can do nothing",Core Values/Abide in Christ,30
Philippians 2:3,"Value others above yourselves",Core Values/Humility,not-a-number`

  await openCSVImport(page)
  await page.getByPlaceholder(/Paste your CSV/i).fill(csvContent)
  await page.getByRole('button', { name: /Import 2 verses/i }).click()
  await expect(page.getByText(/not a number/i)).toBeVisible()
  expect(await getStoredCollections(page)).toEqual([])
  expect(await getStoredVerses(page)).toEqual([])
})

test('cancel: close modal without importing', async ({ page }) => {
  await page.getByTestId('nav-collections').click()
  await page.getByTestId('fab-trigger').click()
  await page.getByTestId('fab-import-csv').click()
  await page.getByRole('button', { name: /Cancel/i }).click()
  await expect(page.getByTestId('modal-import-csv')).not.toBeVisible()
})

test('BibleMemory CSV: quoted commas, quotes, and embedded newlines import as one verse', async ({ page }) => {
  const csvContent = `Reference,Content,Version,Collection
Psalm 23:1,"The LORD is my shepherd, ""I shall not want.""
He makes me lie down.",BSB,Comfort`

  await openCSVImport(page)
  await page.getByPlaceholder(/Paste your CSV/i).fill(csvContent)
  await expect(page.getByRole('button', { name: /Import 1 verse/i })).toBeVisible()
  await page.getByRole('button', { name: /Import 1 verse/i }).click()

  const verses = await getStoredVerses(page) as Array<{
    reference: string
    content: string
    bibleVersion: string
  }>
  const collections = await getStoredCollections(page) as Array<{ name: string }>

  expect(verses).toHaveLength(1)
  expect(verses[0].reference).toBe('Psalm 23:1')
  expect(verses[0].bibleVersion).toBe('BSB')
  expect(verses[0].content).toBe('The LORD is my shepherd, "I shall not want."\nHe makes me lie down.')
  expect(collections.map(collection => collection.name)).toContain('Comfort')
})

test('BibleMemory CSV: repeated collection rows create one verse in multiple collections', async ({ page }) => {
  const existingCollections = [{
    id: 'existing-assurance',
    name: 'Assurance',
    description: '',
    parentId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    lastModified: '2026-01-01T00:00:00.000Z',
  }]
  await seedStorage(page, [], existingCollections)
  await page.reload()

  const csvContent = `Reference,Content,Version,Collection
Romans 8:28,"And we know that in all things God works for the good.",NIV,Assurance
Romans 8:28,"And we know that in all things God works for the good.",NIV,Promises`

  await openCSVImport(page)
  await page.getByPlaceholder(/Paste your CSV/i).fill(csvContent)
  await expect(page.getByRole('button', { name: /Import 2 verses/i })).toBeVisible()
  await page.getByRole('button', { name: /Import 2 verses/i }).click()

  const verses = await getStoredVerses(page) as Array<{ collectionIds: string[] }>
  const collections = await getStoredCollections(page) as Array<{ id: string, name: string }>
  const assuranceCollections = collections.filter(collection => collection.name === 'Assurance')
  const promises = collections.find(collection => collection.name === 'Promises')

  expect(verses).toHaveLength(1)
  expect(assuranceCollections).toHaveLength(1)
  expect(promises).toBeTruthy()
  expect(verses[0].collectionIds).toContain('existing-assurance')
  expect(verses[0].collectionIds).toContain(promises!.id)
})

test('BibleMemory CSV: duplicate references with different versions or content stay separate', async ({ page }) => {
  const csvContent = `Reference,Content,Version,Collection
John 3:16,"For God so loved the world.",NIV,Salvation
John 3:16,"For this is how God loved the world.",NLT,Salvation
John 3:16,"For God so loved the world.",ESV,Salvation`

  await openCSVImport(page)
  await page.getByPlaceholder(/Paste your CSV/i).fill(csvContent)
  await expect(page.getByRole('button', { name: /Import 3 verses/i })).toBeVisible()
  await page.getByRole('button', { name: /Import 3 verses/i }).click()

  const verses = await getStoredVerses(page) as Array<{ reference: string, bibleVersion: string, content: string }>

  expect(verses).toHaveLength(3)
  expect(verses.map(verse => `${verse.reference}|${verse.bibleVersion}|${verse.content}`).sort()).toEqual([
    'John 3:16|ESV|For God so loved the world.',
    'John 3:16|NIV|For God so loved the world.',
    'John 3:16|NLT|For this is how God loved the world.',
  ])
})

test('BibleMemory CSV: matching existing verse is updated without creating a duplicate', async ({ page }) => {
  const existingCollections = [{
    id: 'existing-salvation',
    name: 'Salvation',
    description: '',
    parentId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    lastModified: '2026-01-01T00:00:00.000Z',
  }]
  const existingVerses = [{
    id: 'existing-john',
    reference: 'John 3:16',
    content: 'For God so loved the world.',
    bibleVersion: 'NIV',
    createdAt: '2026-01-01T00:00:00.000Z',
    lastModified: '2026-01-01T00:00:00.000Z',
    memorizationStatus: 'unmemorized',
    reviewCount: 0,
    lastReviewed: null,
    nextReviewDate: null,
    easeFactor: 2.5,
    interval: 0,
    reviewHistory: [],
    collectionIds: [],
  }]
  await seedStorage(page, existingVerses, existingCollections)
  await page.reload()

  const csvContent = `Reference,Content,Version,Collection,DaysUntilNextReview,Interval
John 3:16,"For God so loved the world.",NIV,Salvation,45,60`

  await openCSVImport(page)
  await page.getByPlaceholder(/Paste your CSV/i).fill(csvContent)
  await expect(page.getByRole('button', { name: /Import 1 verse/i })).toBeVisible()
  await page.getByRole('button', { name: /Import 1 verse/i }).click()

  const verses = await getStoredVerses(page) as Array<{
    id: string
    memorizationStatus: string
    reviewCount: number
    interval: number
    nextReviewDate: string | null
    lastReviewed: string | null
    collectionIds: string[]
  }>

  expect(verses).toHaveLength(1)
  expect(verses[0].id).toBe('existing-john')
  expect(verses[0].memorizationStatus).toBe('mastered')
  expect(verses[0].reviewCount).toBeGreaterThan(0)
  expect(verses[0].interval).toBe(60)
  expect(verses[0].nextReviewDate).toBeTruthy()
  expect(verses[0].lastReviewed).toBeTruthy()
  expect(verses[0].collectionIds).toContain('existing-salvation')
})
