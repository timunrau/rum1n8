import { test, expect } from '@playwright/test'
import { clearAppStorage } from '../helpers/storage'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await clearAppStorage(page)
  await page.reload()
})

test('app loads with default Collections view', async ({ page }) => {
  await expect(page.getByTestId('nav-collections')).toHaveClass(/text-nav-active/)
  await expect(page.locator('h1')).toContainText(/Verses|Collections|Review/)
})

test('bottom nav switches between Review, Collections, Stats', async ({ page }) => {
  await page.getByTestId('nav-review').click()
  await expect(page.getByTestId('nav-review')).toHaveClass(/text-nav-active/)
  await expect(page.locator('h1')).toContainText('Review')

  await page.getByTestId('nav-collections').click()
  await expect(page.getByTestId('nav-collections')).toHaveClass(/text-nav-active/)

  await page.getByTestId('nav-stats').click()
  await expect(page.getByTestId('nav-stats')).toHaveClass(/text-nav-active/)
  await expect(page.locator('h1')).toContainText('Stats')
})

test('URL updates when switching views', async ({ page }) => {
  await page.getByTestId('nav-review').click()
  await expect(page).toHaveURL(/\?view=review-list/)

  await page.getByTestId('nav-collections').click()
  await expect(page).toHaveURL(/\?view=collections/)

  await page.getByTestId('nav-stats').click()
  await expect(page).toHaveURL(/\?view=stats/)
})

test('FAB opens add verse / add collection / import CSV options on Collections view', async ({
  page,
}) => {
  await page.getByTestId('nav-collections').click()
  await expect(page.getByTestId('fab-trigger')).toBeVisible()

  await page.getByTestId('fab-trigger').click()
  await expect(page.getByTestId('fab-new-verse')).toBeVisible()
  await expect(page.getByTestId('fab-new-collection')).toBeVisible()
  await expect(page.getByTestId('fab-import-csv')).toBeVisible()
})

test('initial load with view=review-list shows Review tab', async ({ page }) => {
  await page.goto('/?view=review-list')
  await expect(page.getByTestId('nav-review')).toHaveClass(/text-nav-active/)
})

test('initial load with view=stats shows Stats tab', async ({ page }) => {
  await page.goto('/?view=stats')
  await expect(page.getByTestId('nav-stats')).toHaveClass(/text-nav-active/)
})

test('FAB is hidden on Stats view', async ({ page }) => {
  await page.getByTestId('nav-stats').click()
  await expect(page.getByTestId('fab-trigger')).not.toBeVisible()
})
