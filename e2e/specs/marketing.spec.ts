import { test, expect } from '@playwright/test'
import { clearAppStorage } from '../helpers/storage'
import { gotoApp } from '../helpers/navigation'

const HERO_HEADING = 'Ruminate: to turn something over in the mind.'

test.beforeEach(async ({ page }) => {
  await page.goto('/about/')
  await clearAppStorage(page)
  await page.reload()
})

test('fresh visit to root shows the marketing page', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { name: HERO_HEADING })).toBeVisible()
  await expect(page.getByTestId('nav-collections')).toHaveCount(0)
})

test('returning users visiting root are redirected back into the app', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('rum1n8-ui-state', JSON.stringify({
      hasOpenedApp: true,
      lastAppUrl: '/app/?view=stats',
    }))
  })

  await page.goto('/')

  await expect(page).toHaveURL(/\/app\/\?view=stats$/)
  await expect(page.getByTestId('nav-stats')).toHaveClass(/text-nav-active/)
})

test('about stays public even for returning users', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('rum1n8-ui-state', JSON.stringify({
      hasOpenedApp: true,
      lastAppUrl: '/app/?view=review-list',
    }))
  })

  await page.goto('/about/')

  await expect(page).toHaveURL(/\/about\/$/)
  await expect(page.getByRole('heading', { name: HERO_HEADING })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Back to app' })).toHaveAttribute(
    'href',
    '/app/?view=review-list'
  )
})

test('legacy root app query redirects into the app path', async ({ page }) => {
  await page.goto('/?view=review-list')

  await expect(page).toHaveURL(/\/app\/\?view=review-list$/)
  await expect(page.getByTestId('nav-review')).toHaveClass(/text-nav-active/)
})

test('app About opens the public page with a back link to the current app view', async ({
  page,
}) => {
  await gotoApp(page)

  await page.getByTestId('hamburger-button').click()
  await expect(page.getByTestId('settings-about')).toBeVisible()
  await page.getByTestId('settings-about').click()

  await expect(page).toHaveURL(/\/about\/\?returnTo=%2Fapp%2F$/)
  await expect(page.getByRole('heading', { name: HERO_HEADING })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Back to app' })).toHaveAttribute('href', '/app/')
})
