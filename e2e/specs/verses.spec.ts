import { test, expect } from '@playwright/test'
import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { clearAppStorage, seedStorage } from '../helpers/storage'
import { mockBibleApi } from '../helpers/mocks'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const sampleVerses = JSON.parse(
  readFileSync(path.join(__dirname, '../fixtures/sample-verses.json'), 'utf-8')
)

test.beforeEach(async ({ page }) => {
  await page.goto('/')
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

test('edit verse: open verse card -> edit -> change content -> save', async ({ page }) => {
  await seedStorage(page, sampleVerses, [])
  await page.goto('/?view=search')
  await page.getByPlaceholder(/Search verses/i).fill('John')
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: 'Edit verse' }).first().click()

  await expect(page.getByTestId('modal-edit-verse')).toBeVisible()
  await page.getByLabel(/Verse Content|Content/i).fill('Updated verse content.')
  await page.getByRole('button', { name: /^Save$/i }).click()

  await expect(page.getByTestId('modal-edit-verse')).not.toBeVisible()
  await expect(page.getByText('Updated verse content.')).toBeVisible()
})

test('copy verse: copy button triggers copy', async ({ page }) => {
  await page.context().grantPermissions(['clipboard-write', 'clipboard-read'])
  await seedStorage(page, sampleVerses, [])
  await page.goto('/?view=search')
  await page.getByPlaceholder(/Search verses/i).fill('John')
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: 'Share verse' }).first().click()
  await expect(page.getByText(/Verse copied| copied/i)).toBeVisible({ timeout: 3000 })
})

test('search: add verses -> search by reference/content -> results filtered', async ({ page }) => {
  await seedStorage(page, sampleVerses, [])
  await page.goto('/?view=search')
  await page.getByPlaceholder(/Search verses/i).fill('Psalm')
  await page.waitForTimeout(500)
  await expect(page.getByText('Psalm 23:1')).toBeVisible()
  await expect(page.getByText('John 3:16')).not.toBeVisible()
})
