import { test, expect, type Page } from '@playwright/test'
import { clearAppStorage } from '../helpers/storage'
import { gotoApp } from '../helpers/navigation'

const APP_URL = (process.env.PLAYWRIGHT_APP_URL || 'http://127.0.0.1:5173').replace(/\/$/, '')
const MARKETING_URL = (process.env.PLAYWRIGHT_MARKETING_URL || 'http://127.0.0.1:5174').replace(/\/$/, '')
const HERO_HEADING = "Everything you need to memorize Scripture. Nothing you don't."

async function gotoMarketing(page: Page, path = '/') {
  await page.goto(`${MARKETING_URL}${path}`)
}

async function openAppMenu(page: Page) {
  await page.getByTestId('hamburger-button').click()
  await expect(page.getByTestId('settings-about')).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  await gotoApp(page)
  await clearAppStorage(page)
  await gotoMarketing(page)
  await page.evaluate(() => localStorage.clear())
})

test('fresh marketing visit shows the static homepage and app CTA', async ({ page }) => {
  await gotoMarketing(page)

  await expect(page).toHaveURL(`${MARKETING_URL}/`)
  await expect(page.getByRole('heading', { name: HERO_HEADING })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Start memorizing' }).first()).toHaveAttribute(
    'href',
    `${APP_URL}/app/`,
  )
  await expect(page.getByTestId('nav-collections')).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Back to app' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Google Play', exact: true })).toHaveAttribute(
    'href',
    'https://play.google.com/store/apps/details?id=xyz.unrau.rum1n8',
  )
})

test('mobile navigation opens, dismisses, and resets when switching to desktop', async ({ page }) => {
  await page.setViewportSize({ width: 466, height: 888 })
  await gotoMarketing(page)

  const navigation = page.getByRole('navigation', { name: 'Main navigation' })
  const toggle = page.getByRole('button', { name: /navigation menu/, includeHidden: true })
  await expect(navigation).toBeHidden()
  await toggle.click()
  await expect(navigation).toBeVisible()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await navigation.getByRole('link', { name: 'Tips', exact: true }).focus()
  await page.keyboard.press('Escape')
  await expect(navigation).toBeHidden()
  await expect(toggle).toBeFocused()

  await toggle.click()
  await page.locator('.home-hero__description').click()
  await expect(navigation).toBeHidden()

  await toggle.click()
  await page.setViewportSize({ width: 912, height: 888 })
  await expect(toggle).toBeHidden()
  await expect(navigation).toBeVisible()
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await page.setViewportSize({ width: 466, height: 888 })
  await expect(toggle).toBeVisible()
  await expect(navigation).toBeHidden()
  await toggle.click()
  await navigation.getByRole('link', { name: 'Tips', exact: true }).click()
  await expect(page).toHaveURL(`${MARKETING_URL}/tips-for-memorizing-scripture/`)
})

for (const path of [
  '/',
  '/memorization-is-a-spiritual-life-hack/',
  '/tips-for-memorizing-scripture/',
  '/import/biblememory/',
  '/privacy/',
]) {
  test(`app return remains left of the brand on desktop and mobile at ${path}`, async ({ page }) => {
    await gotoMarketing(page, `${path}?returnTo=%2Fapp%2F%3Fview%3Dreview-list%23today`)

    const returnLink = page.getByRole('link', { name: 'Back to app', exact: true })
    const brand = page.getByRole('banner').getByRole('link', { name: /^Ruminate(?: home)?$/ })
    for (const width of [842, 466, 320]) {
      await page.setViewportSize({ width, height: 888 })
      await expect(returnLink).toBeVisible()
      await expect(brand).toBeVisible()
      await expect.poll(async () => {
        const returnBox = await returnLink.boundingBox()
        const brandBox = await brand.boundingBox()
        return returnBox && brandBox && returnBox.x + returnBox.width <= brandBox.x
      }).toBe(true)
      await expect(returnLink).toHaveAttribute('href', `${APP_URL}/app/?view=review-list#today`)
    }
  })
}

test('browsing marketing pages retains the exact app return destination', async ({ page }) => {
  const returnTo = '/app/?view=review-list#today'
  await gotoMarketing(page, `/?returnTo=${encodeURIComponent(returnTo)}`)
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Tips', exact: true }).click()
  expect(new URL(page.url()).searchParams.get('returnTo')).toBe(returnTo)
  await page.getByRole('banner').getByRole('link', { name: 'Ruminate home' }).click()
  expect(new URL(page.url()).searchParams.get('returnTo')).toBe(returnTo)

  await page.setViewportSize({ width: 466, height: 888 })
  await page.getByRole('button', { name: 'Open navigation menu' }).click()
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Privacy', exact: true }).click()
  expect(new URL(page.url()).searchParams.get('returnTo')).toBe(returnTo)
  await page.getByRole('link', { name: 'Back to app', exact: true }).click()
  await expect(page).toHaveURL(`${APP_URL}${returnTo}`)
})

test('marketing origin does not inspect app-local UI state', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('rum1n8-ui-state', JSON.stringify({
      hasOpenedApp: true,
      lastAppUrl: '/app/?view=stats',
    }))
  })
  await page.reload()

  await expect(page).toHaveURL(`${MARKETING_URL}/`)
  await expect(page.getByRole('heading', { name: HERO_HEADING })).toBeVisible()
})

for (const legacyQuery of ['view=stats', 'collection=abc', 'verse=def', 'mode=master']) {
  test(`app root preserves legacy ${legacyQuery.split('=')[0]} navigation`, async ({ request }) => {
    const response = await request.get(`${APP_URL}/?${legacyQuery}`, { maxRedirects: 0 })

    expect(response.status()).toBe(301)
    expect(response.headers().location).toBe(`/app/?${legacyQuery}`)
  })
}

test('allowlisted returnTo produces an exact absolute app return link', async ({ page }) => {
  await gotoMarketing(page, '/tips-for-memorizing-scripture/?returnTo=%2Fapp%2F%3Fview%3Dreview-list%23today')

  await expect(page.getByRole('link', { name: 'Back to app' })).toHaveAttribute(
    'href',
    `${APP_URL}/app/?view=review-list#today`,
  )
})

for (const returnTo of ['https://evil.example/app/', '//evil.example/app/', '/privacy/']) {
  test(`rejects unsafe returnTo value ${returnTo}`, async ({ page }) => {
    await gotoMarketing(page, `/tips-for-memorizing-scripture/?returnTo=${encodeURIComponent(returnTo)}`)

    await expect(page.getByRole('link', { name: 'Back to app' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Start memorizing' }).first()).toHaveAttribute(
      'href',
      `${APP_URL}/app/`,
    )
  })
}

for (const [alias, canonical] of [
  ['/index.html', '/'],
  ['/about/', '/'],
  ['/privacy.html', '/privacy/'],
  ['/privacy', '/privacy/'],
  ['/tips-for-memorizing-scripture/index.html', '/tips-for-memorizing-scripture/'],
  ['/import/biblememory', '/import/biblememory/'],
] as const) {
  test(`marketing alias ${alias} redirects canonically with its query`, async ({ page }) => {
    await gotoMarketing(page, `${alias}?campaign=old`)

    await expect(page).toHaveURL(`${MARKETING_URL}${canonical}?campaign=old`)
  })
}

test('privacy has a clean URL and an independent analytics preference', async ({ page }) => {
  await gotoMarketing(page, '/privacy/')

  await expect(page).toHaveURL(`${MARKETING_URL}/privacy/`)
  await expect(page.getByRole('heading', { name: 'Privacy Policy' })).toBeVisible()
  const optOut = page.getByRole('checkbox', { name: /Do not load analytics/ })
  await expect(optOut).not.toBeChecked()
  await optOut.check()
  await expect(page).toHaveURL(`${MARKETING_URL}/privacy/`)
  await expect(optOut).toBeChecked()
  expect(await page.evaluate(() => localStorage.getItem('rum1n8-marketing-analytics-opt-out'))).toBe('true')
})

for (const [testId, path, heading] of [
  ['settings-about', '/', HERO_HEADING],
  ['settings-memorization-tips', '/tips-for-memorizing-scripture/', 'Tips For Memorizing Scripture'],
  ['settings-biblememory-import', '/import/biblememory/', 'Import from BibleMemory.com'],
  ['settings-privacy', '/privacy/', 'Privacy Policy'],
] as const) {
  test(`app action ${testId} crosses origins and returns to the exact app screen`, async ({ page }) => {
    await gotoApp(page, '?view=collections')
    await openAppMenu(page)
    await page.getByTestId(testId).click()

    await expect(page).toHaveURL(`${MARKETING_URL}${path}?returnTo=%2Fapp%2F%3Fview%3Dcollections`)
    await expect(page.getByRole('heading', { name: heading })).toBeVisible()
    await page.getByRole('link', { name: 'Back to app' }).click()
    await expect(page).toHaveURL(`${APP_URL}/app/?view=collections`)
  })
}

test('ordinary browser Back returns from marketing to the app', async ({ page }) => {
  await gotoApp(page, '?view=collections')
  await openAppMenu(page)
  await page.getByTestId('settings-about').click()
  await expect(page).toHaveURL(new RegExp(`^${MARKETING_URL.replaceAll('.', '\\.')}/`))

  await page.goBack()
  await expect(page).toHaveURL(`${APP_URL}/app/?view=collections`)
})

test('Share app shares the public marketing URL', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: ShareData) => {
        ;(window as typeof window & { __sharedApp?: ShareData }).__sharedApp = data
      },
    })
  })
  await gotoApp(page)
  await openAppMenu(page)
  await page.getByTestId('settings-share').click()

  const shared = await page.evaluate(
    () => (window as typeof window & { __sharedApp?: ShareData }).__sharedApp,
  )
  expect(shared).toMatchObject({
    title: 'Ruminate: Bible Memory',
    url: `${MARKETING_URL}/`,
  })
})

test('dedication links are marked for analytics tracking', async ({ page }) => {
  await gotoMarketing(page)

  await expect(page.getByRole('link', { name: 'Donate to Church Renewal International' })).toHaveAttribute(
    'data-marketing-track',
    'marketing_church_renewal_donate_clicked',
  )
  await expect(page.getByRole('link', { name: 'Visit TheWay.app' })).toHaveAttribute(
    'data-marketing-track',
    'marketing_theway_clicked',
  )
})
