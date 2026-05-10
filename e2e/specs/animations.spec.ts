import { test, expect, type Page } from '@playwright/test'
import { gotoApp } from '../helpers/navigation'
import { clearAppStorage, seedStorage } from '../helpers/storage'

const now = () => new Date().toISOString()
const yesterday = () => new Date(Date.now() - 86400000).toISOString()

const seedAnimationFixture = async (page: Page) => {
  const timestamp = now()
  await seedStorage(
    page,
    [
      {
        id: 'learn-1',
        reference: 'James 1:2',
        content: 'Consider it pure joy.',
        bibleVersion: 'NIV',
        memorizationStatus: 'unmemorized',
        collectionIds: ['james'],
        createdAt: timestamp,
        lastModified: timestamp,
      },
      {
        id: 'review-1',
        reference: 'James 1:3',
        content: 'Testing produces perseverance.',
        bibleVersion: 'NIV',
        memorizationStatus: 'mastered',
        nextReviewDate: yesterday(),
        interval: 1,
        reviewCount: 1,
        easeFactor: 2.5,
        collectionIds: ['james'],
        createdAt: timestamp,
        lastModified: timestamp,
      },
    ],
    [
      {
        id: 'james',
        name: 'James',
        description: '',
        createdAt: timestamp,
        lastModified: timestamp,
      },
    ]
  )
}

const animationName = (locator: ReturnType<Page['locator']>) =>
  locator.first().evaluate((el) => getComputedStyle(el).animationName)

test.beforeEach(async ({ page }) => {
  await gotoApp(page)
  await clearAppStorage(page)
  await seedAnimationFixture(page)
  await gotoApp(page, '?view=collections')
})

test('collection list floats in on collection enter and return to root', async ({ page }) => {
  await expect(page.locator('.collection-tile').first()).toBeVisible()
  await expect(animationName(page.locator('.collection-tile'))).resolves.toBe('none')

  await page.getByText('James').click()
  await expect(page.locator('.stagger-fade--nav-enter > .relative').first()).toBeVisible()
  await expect(animationName(page.locator('.stagger-fade--nav-enter > .relative'))).resolves.toBe('fade-up')

  await page.locator('header button').first().click()
  await expect(page.locator('.collection-tile').first()).toBeVisible()
  await expect(animationName(page.locator('.collection-tile'))).resolves.toBe('fade-up')
})

test('practice exits float in the destination list', async ({ page }) => {
  await page.getByText('James').click()
  await page.getByText('James 1:2').click()
  await page.locator('.fixed.inset-0 button').first().click()
  await expect(page.locator('.stagger-fade--nav-enter > .relative').first()).toBeVisible()
  await expect(animationName(page.locator('.stagger-fade--nav-enter > .relative'))).resolves.toBe('fade-up')

  await page.locator('header button').first().click()
  await page.getByTestId('nav-review').click()
  await page.getByText('James 1:3').click()
  await page.locator('.fixed.inset-0 button').first().click()
  await expect(page.locator('.app-view-panel--active .stagger-fade--nav-enter .verse-card').first()).toBeVisible()
  await expect(animationName(page.locator('.app-view-panel--active .stagger-fade--nav-enter .verse-card'))).resolves.toBe('fade-up')
})

test('tab navigation keeps stagger lists suppressed', async ({ page }) => {
  await page.getByTestId('nav-review').click()
  await expect(page.locator('.app-view-panel--active .verse-card').first()).toBeVisible()
  await expect(animationName(page.locator('.app-view-panel--active .verse-card'))).resolves.toBe('none')
})

test('completion tray keeps its slide-up transition contract', async ({ page }) => {
  const trayTransition = await page.evaluate(() => {
    const el = document.createElement('div')
    el.className = 'result-tray-enter-active'
    document.body.appendChild(el)
    const styles = getComputedStyle(el)
    const result = {
      property: styles.transitionProperty,
      duration: styles.transitionDuration,
    }
    el.remove()
    return result
  })

  expect(trayTransition.property).toContain('transform')
  expect(trayTransition.duration).not.toBe('0s')
})

test('practice next verse uses the next transition contract', async ({ page }) => {
  const timestamp = now()
  await seedStorage(
    page,
    [
      {
        id: 'review-a',
        reference: 'James 1:4',
        content: 'Alpha',
        bibleVersion: 'NIV',
        memorizationStatus: 'mastered',
        nextReviewDate: yesterday(),
        interval: 1,
        reviewCount: 1,
        easeFactor: 2.5,
        collectionIds: [],
        createdAt: timestamp,
        lastModified: timestamp,
      },
      {
        id: 'review-b',
        reference: 'James 1:5',
        content: 'Beta',
        bibleVersion: 'NIV',
        memorizationStatus: 'mastered',
        nextReviewDate: yesterday(),
        interval: 1,
        reviewCount: 1,
        easeFactor: 2.5,
        collectionIds: [],
        createdAt: timestamp,
        lastModified: timestamp,
      },
    ],
    []
  )
  await gotoApp(page, '?view=review-list')

  await page.getByText('James 1:4').click()
  await page.locator('#letter-input-review').focus()
  await page.keyboard.type('a')
  await page.getByRole('button', { name: /Next Verse/i }).click()

  await expect(page.locator('h1')).toContainText('James 1:5')
  await expect(page.locator('.practice-view-stage')).toHaveAttribute('data-practice-transition', 'practice-verse-next')
})
