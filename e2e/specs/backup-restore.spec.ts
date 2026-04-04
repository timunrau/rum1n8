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

test('download backup: Settings -> Backup/Import -> Download -> file download triggered', async ({
  page,
}) => {
  await page.getByTestId('hamburger-button').click()
  await page.getByTestId('settings-backup').click()

  await expect(page.getByTestId('modal-backup-restore')).toBeVisible()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: /Download|Backup/i }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/rum1n8-backup.*\.json/)
})

test('restore: Settings -> choose backup file -> confirm -> data replaced', async ({ page }) => {
  page.on('dialog', (dialog) => dialog.accept())
  await page.getByTestId('hamburger-button').click()
  await page.getByTestId('settings-backup').click()

  await expect(page.getByTestId('modal-backup-restore')).toBeVisible()
  const fileInput = page.locator('#backup-file-input')
  await fileInput.setInputFiles(path.join(__dirname, '../fixtures/sample-backup.json'))

  await page.waitForTimeout(2000)
  await expect(page.getByTestId('modal-backup-restore')).not.toBeVisible({ timeout: 10000 })
  await page.getByRole('heading', { name: 'Restored Collection' }).click()
  await expect(page.getByText('Philippians 4:13')).toBeVisible({ timeout: 10000 })
})
