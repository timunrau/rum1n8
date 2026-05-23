import { test, expect } from '@playwright/test'
import { clearAppStorage } from '../helpers/storage'
import { gotoApp } from '../helpers/navigation'

const HERO_HEADING = 'Ruminate: to turn something over in the mind.'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
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
  await expect(page.getByTestId('nav-stats')).toHaveClass(/tab-btn--active/)
})

test('root return links stay public even for returning users', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('rum1n8-ui-state', JSON.stringify({
      hasOpenedApp: true,
      lastAppUrl: '/app/?view=review-list',
    }))
  })

  await page.goto('/?returnTo=%2Fapp%2F%3Fview%3Dreview-list')

  await expect(page).toHaveURL(/\/\?returnTo=%2Fapp%2F%3Fview%3Dreview-list$/)
  await expect(page.getByRole('heading', { name: HERO_HEADING })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Back to app' })).toHaveAttribute(
    'href',
    '/app/?view=review-list'
  )
})

test('deprecated about URL redirects to the canonical root and preserves return target', async ({ page }) => {
  await page.goto('/about/?returnTo=%2Fapp%2F%3Fview%3Dreview-list')

  await expect(page).toHaveURL(/\/\?returnTo=%2Fapp%2F%3Fview%3Dreview-list$/)
  await expect(page.getByRole('heading', { name: HERO_HEADING })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Back to app' })).toHaveAttribute(
    'href',
    '/app/?view=review-list'
  )
})

test('privacy page is available at the clean URL', async ({ page }) => {
  await page.goto('/privacy')

  await expect(page).toHaveURL(/\/privacy$/)
  await expect(page.getByRole('heading', { name: 'Privacy Policy' })).toBeVisible()
  await expect(page.getByText('No data is sent to or stored on any rum1n8 server.')).toBeVisible()
})

test('legacy root app query redirects into the app path', async ({ page }) => {
  await page.goto('/?view=review-list')

  await expect(page).toHaveURL(/\/app\/\?view=review-list$/)
  await expect(page.getByTestId('nav-review')).toHaveClass(/tab-btn--active/)
})

test('app About opens the public page with a back link to the current app view', async ({
  page,
}) => {
  await gotoApp(page)

  await page.getByTestId('hamburger-button').click()
  await expect(page.getByTestId('settings-about')).toBeVisible()
  await page.getByTestId('settings-about').click()

  await expect(page).toHaveURL(/\/\?returnTo=%2Fapp%2F$/)
  await expect(page.getByRole('heading', { name: HERO_HEADING })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Back to app' })).toHaveAttribute('href', '/app/')
})

test('dedication links are marked for analytics tracking', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('link', { name: 'Donate to Church Renewal International' })).toHaveAttribute(
    'data-marketing-track',
    'marketing_church_renewal_donate_clicked'
  )
  await expect(page.getByRole('link', { name: 'Visit TheWay.app' })).toHaveAttribute(
    'data-marketing-track',
    'marketing_theway_clicked'
  )
})
