import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { clearAppStorage } from '../helpers/storage'
import { MOCK_VERSE_CONTENT, mockBibleApi } from '../helpers/mocks'
import { gotoApp } from '../helpers/navigation'

test.beforeEach(async ({ page }) => {
  await mockBibleApi(page)
  await gotoApp(page)
  await clearAppStorage(page)
  await page.reload()
})

async function openPracticeSettings(page: Page) {
  await page.getByRole('button', { name: 'Menu' }).click()
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
}

async function openAddVerseModal(page: Page) {
  await page.getByTestId('nav-collections').click()
  await page.getByTestId('fab-trigger').click()
  await page.getByTestId('fab-new-verse').click()
  await expect(page.getByTestId('modal-add-verse')).toBeVisible()
}

test('a supported default becomes available offline and imports after a reload', async ({ page }) => {
  await openPracticeSettings(page)

  await page.getByLabel('Default translation').fill('BSB')
  await page.getByRole('button', { name: 'Done' }).click()
  await openPracticeSettings(page)
  await expect(page.getByTestId('default-bible-cache-status')).toHaveText('Available offline')
  await page.getByRole('button', { name: 'Done' }).click()

  await page.reload()
  await page.context().setOffline(true)
  await page.evaluate(() => window.dispatchEvent(new Event('offline')))

  try {
    await openAddVerseModal(page)
    await expect(page.getByLabel('Bible version')).toHaveValue('BSB')
    await page.getByLabel('Reference').fill('John 3:16')
    await page.getByRole('button', { name: 'Import verse text' }).click()
    await expect(page.getByLabel('Verse text', { exact: true })).toHaveValue(MOCK_VERSE_CONTENT)
  } finally {
    await page.context().setOffline(false)
  }
})

test('saving a new verse translation as the default starts its offline download', async ({ page }) => {
  await openAddVerseModal(page)

  await page.getByLabel('Bible version').fill('BSB')
  await page.getByTestId('new-verse-default-bible-version').check()
  await page.getByLabel('Reference').fill('John 3:16')
  await page.getByLabel('Verse text', { exact: true }).fill('Manually entered verse text.')
  await page.getByRole('button', { name: 'Add Verse' }).click()

  await openPracticeSettings(page)
  await expect(page.getByLabel('Default translation')).toHaveValue('BSB')
  await expect(page.getByTestId('default-bible-cache-status')).toHaveText('Available offline')
})

test('unsupported defaults stay quiet in Settings and retain import guidance', async ({ page }) => {
  await openPracticeSettings(page)

  await page.getByLabel('Default translation').fill('NIV')
  await page.getByRole('button', { name: 'Done' }).click()

  await openPracticeSettings(page)
  await expect(page.getByLabel('Default translation')).toHaveValue('NIV')
  await expect(page.getByTestId('default-bible-cache-status')).toHaveCount(0)
  await page.getByRole('button', { name: 'Done' }).click()

  await openAddVerseModal(page)
  await page.getByLabel('Reference').fill('John 3:16')
  await page.getByRole('button', { name: 'Import verse text' }).click()
  await expect(page.getByText('This translation is copyrighted. Copy the text from one of the links below and paste it into Verse text.')).toBeVisible()
})
