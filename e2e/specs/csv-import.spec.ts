import { test, expect } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'
import { clearAppStorage } from '../helpers/storage'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

test.beforeEach(async ({ page }) => {
  await page.goto('/')
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

test('select collections -> import -> verses appear in selected collections', async ({ page }) => {
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
  await page.getByLabel('Import Target').check()
  await page.getByRole('button', { name: /Import 1 verse/i }).click()
  await page.getByRole('button', { name: 'Done' }).click()
  await page.getByText('Import Target').click()
  await expect(page.getByText('John 3:16')).toBeVisible()
})

test('cancel: close modal without importing', async ({ page }) => {
  await page.getByTestId('nav-collections').click()
  await page.getByTestId('fab-trigger').click()
  await page.getByTestId('fab-import-csv').click()
  await page.getByRole('button', { name: /Cancel/i }).click()
  await expect(page.getByTestId('modal-import-csv')).not.toBeVisible()
})
