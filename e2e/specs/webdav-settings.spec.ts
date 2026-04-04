import { test, expect } from '@playwright/test'
import { clearAppStorage } from '../helpers/storage'
import { mockWebDAV } from '../helpers/mocks'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await clearAppStorage(page)
  await page.reload()
})

test('open sync settings: Settings gear -> Sync', async ({ page }) => {
  await page.getByTestId('hamburger-button').click()
  await page.getByTestId('settings-sync').click()

  await expect(page.getByTestId('modal-sync-settings')).toBeVisible()
  await expect(page.getByText(/Sync Settings/i)).toBeVisible()
})

test('fill URL, username, password -> Save -> settings persist (reopen modal, values present)', async ({
  page,
}) => {
  await page.getByTestId('hamburger-button').click()
  await page.getByTestId('settings-sync').click()
  await page.getByRole('button', { name: /^WebDAV$/i }).click()

  await page.getByLabel(/WebDAV Server URL/i).fill('https://test.example.com/remote.php/webdav/')
  await page.getByLabel(/Username/i).fill('testuser')
  await page.getByLabel(/Password/i).fill('testpass')
  await page.getByRole('button', { name: /^Save$/i }).click()

  await expect(page.getByTestId('modal-sync-settings')).not.toBeVisible()

  await page.getByTestId('hamburger-button').click()
  await page.getByTestId('settings-sync').click()

  await expect(page.getByLabel(/WebDAV Server URL/i)).toHaveValue(/test\.example\.com/)
  await expect(page.getByLabel(/Username/i)).toHaveValue('testuser')
  await expect(page.getByLabel(/Password/i)).toHaveValue('testpass')
})

test('test connection: mock WebDAV -> Test -> success message', async ({ page }) => {
  await mockWebDAV(page)
  await page.getByTestId('hamburger-button').click()
  await page.getByTestId('settings-sync').click()
  await page.getByRole('button', { name: /^WebDAV$/i }).click()

  await page.getByLabel(/WebDAV Server URL/i).fill('https://test.example.com/remote.php/webdav/')
  await page.getByLabel(/Username/i).fill('testuser')
  await page.getByLabel(/Password/i).fill('testpass')
  await page.getByRole('button', { name: /^Test$/i }).click()

  await expect(page.getByText(/success|connected|OK/i)).toBeVisible({ timeout: 5000 })
})
