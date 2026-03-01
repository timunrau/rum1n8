import { test, expect } from '@playwright/test'
import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { clearAppStorage, seedStorage } from '../helpers/storage'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const sampleVerses = JSON.parse(
  readFileSync(path.join(__dirname, '../fixtures/sample-verses.json'), 'utf-8')
)

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await clearAppStorage(page)
  await page.reload()
})

test('create collection: FAB -> New Collection -> fill -> submit -> appears in list', async ({
  page,
}) => {
  await page.getByTestId('nav-collections').click()
  await page.getByTestId('fab-trigger').click()
  await page.getByTestId('fab-new-collection').click()

  await expect(page.getByTestId('modal-add-collection')).toBeVisible()
  await page.getByLabel(/Collection Name/i).fill('Test Collection')
  await page.getByLabel(/Description/i).fill('Optional description')
  await page.getByRole('button', { name: /Create Collection/i }).click()

  await expect(page.getByTestId('modal-add-collection')).not.toBeVisible()
  await expect(page.getByText('Test Collection')).toBeVisible()
})

test('edit collection: create collection -> edit -> change name -> save', async ({ page }) => {
  await page.getByTestId('nav-collections').click()
  await page.getByTestId('fab-trigger').click()
  await page.getByTestId('fab-new-collection').click()
  await page.getByLabel(/Collection Name/i).fill('Original Name')
  await page.getByRole('button', { name: /Create Collection/i }).click()
  await expect(page.getByText('Original Name')).toBeVisible()

  await page.locator('button[title="Edit collection"]').first().click()
  await expect(page.getByTestId('modal-edit-collection')).toBeVisible()
  await page.getByLabel(/Collection Name|Name/i).fill('Updated Name')
  await page.getByRole('button', { name: /^Save$/i }).click()
  await expect(page.getByTestId('modal-edit-collection')).not.toBeVisible()
  await expect(page.getByText('Updated Name')).toBeVisible()
})

test('view master-list, no-collection, to-learn with seeded verses', async ({ page }) => {
  const verses = [
    ...sampleVerses,
    {
      ...sampleVerses[0],
      id: 'verse-3',
      reference: 'Psalm 1:1',
      content: 'Blessed is the man',
      memorizationStatus: 'learned',
      collectionIds: ['to-learn'],
    },
  ]
  const collections = [
    { id: 'custom-1', name: 'Custom', description: '', createdAt: new Date().toISOString(), lastModified: new Date().toISOString() },
  ]
  await seedStorage(page, verses, collections)
  await page.goto('/?view=collections')

  await expect(page.getByText('All Verses')).toBeVisible()
  await expect(page.getByText('Uncategorized')).toBeVisible()
  await expect(page.getByText('Not Yet Mastered')).toBeVisible()
})

test('empty state: no collections shows verse list or create CTA', async ({ page }) => {
  await clearAppStorage(page)
  await page.goto('/?view=collections')

  const noVersesMsg = page.getByText(/No verses yet|Create your first collection|Add a verse/i)
  await expect(noVersesMsg.first()).toBeVisible({ timeout: 5000 })
})
