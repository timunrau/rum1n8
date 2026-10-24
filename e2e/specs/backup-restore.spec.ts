import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { clearAppStorage } from '../helpers/storage'
import { gotoApp } from '../helpers/navigation'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

test.beforeEach(async ({ page }) => {
  await gotoApp(page)
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
  await page.getByRole('button', { name: /Download Backup/i }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/ruminate-backup.*\.json/)
})

for (const format of ['legacy', 'retired voice settings']) {
  test(`restore ${format}: Settings -> choose backup file -> confirm -> data replaced`, async ({ page }) => {
    await page.getByTestId('hamburger-button').click()
    await page.getByTestId('settings-backup').click()

    await expect(page.getByTestId('modal-backup-restore')).toBeVisible()
    const fileInput = page.locator('#backup-file-input')
    const backup = JSON.parse(readFileSync(path.join(__dirname, '../fixtures/sample-backup.json'), 'utf8'))
    if (format === 'retired voice settings') {
      backup.version = '2.1'
      backup.settings = {
        appSettings: { voicePracticeEnabled: true, analyticsOptOut: true, showMasterPlaceholderLines: false },
        appSettingsLastModified: '2026-06-20T12:00:00.000Z',
      }
    }
    await fileInput.setInputFiles({
      name: 'rum1n8-backup-legacy.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(backup)),
    })

    await expect(page.getByTestId('modal-restore-backup-confirm')).toBeVisible()
    await page.getByTestId('modal-restore-backup-confirm').getByRole('button', { name: 'Restore' }).click()
    await expect(page.getByTestId('modal-restore-backup-success')).toBeVisible()
    await page.getByTestId('modal-restore-backup-success').getByRole('button', { name: 'OK' }).click()
    await expect(page.getByTestId('modal-backup-restore')).not.toBeVisible({ timeout: 10000 })
    await page.getByRole('heading', { name: 'Restored Collection' }).click()
    await expect(page.getByText('Philippians 4:13')).toBeVisible({ timeout: 10000 })
    if (format === 'retired voice settings') {
      const record = await page.evaluate(() => JSON.parse(localStorage.getItem('rum1n8-app-settings')!))
      expect(record.appSettings).not.toHaveProperty('voicePracticeEnabled')
      expect(record.appSettings).toMatchObject({ analyticsOptOut: true, showMasterPlaceholderLines: false })
      expect(record.appSettingsLastModified).toBe(backup.settings.appSettingsLastModified)
    }
  })
}
