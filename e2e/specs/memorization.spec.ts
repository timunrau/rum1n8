import { test, expect } from '@playwright/test'
import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { clearBibleMemoryStorage, seedStorage } from '../helpers/storage'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const sampleVerses = JSON.parse(
  readFileSync(path.join(__dirname, '../fixtures/sample-verses.json'), 'utf-8')
)

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await clearBibleMemoryStorage(page)
  await page.reload()
})

test('start from verse list -> click verse -> enters memorization screen', async ({ page }) => {
  const collections = [{ id: 'c1', name: 'Test', description: '', createdAt: new Date().toISOString(), lastModified: new Date().toISOString() }]
  await seedStorage(page, sampleVerses, collections)
  await page.reload()
  await page.goto('/?view=collections')
  await expect(page.getByText('All Verses')).toBeVisible({ timeout: 5000 })
  await page.getByText('All Verses').click()
  await page.waitForTimeout(500)
  await page.getByText('John 3:16').first().click()

  await expect(page.locator('h1')).toContainText('John 3:16')
  await expect(page.locator('#letter-input-memorize')).toBeAttached()
})

test.skip('learn mode: first letters reveal words; complete verse -> Great job modal -> advance to Memorize', async ({
  page,
}) => {
  const shortVerse = [
    {
      ...sampleVerses[0],
      id: 'short-1',
      reference: 'John 1:1',
      content: 'In the beginning',
      memorizationStatus: 'unmemorized',
    },
  ]
  const collections = [{ id: 'c1', name: 'Test', description: '', createdAt: new Date().toISOString(), lastModified: new Date().toISOString() }]
  await seedStorage(page, shortVerse, collections)
  await page.reload()
  await page.goto('/?view=collections')
  await expect(page.getByText('All Verses')).toBeVisible({ timeout: 5000 })
  await page.getByText('All Verses').click()
  await page.waitForTimeout(500)
  await page.getByText('John 1:1').first().click()

  await expect(page.locator('#letter-input-memorize')).toBeAttached()
  await page.locator('#letter-input-memorize').focus()
  await page.keyboard.type('itb', { delay: 100 })

  const greatJob = page.getByText(/Great job|Ready to memorize/i)
  await expect(greatJob).toBeVisible({ timeout: 10000 })
})

test('exit memorization: back button -> returns without completing', async ({ page }) => {
  const collections = [{ id: 'c1', name: 'Test', description: '', createdAt: new Date().toISOString(), lastModified: new Date().toISOString() }]
  await seedStorage(page, sampleVerses, collections)
  await page.reload()
  await page.goto('/?view=collections')
  await expect(page.getByText('All Verses')).toBeVisible({ timeout: 5000 })
  await page.getByText('All Verses').click()
  await page.waitForTimeout(500)
  await page.getByText('John 3:16').first().click()

  await expect(page.locator('#letter-input-memorize')).toBeAttached()
  await page.getByRole('button').first().click()
  await expect(page.locator('#letter-input-memorize')).not.toBeAttached()
  await expect(page.getByText('John 3:16')).toBeVisible()
})

test('progress indicators: Learn / Memorize / Master tabs reflect current stage', async ({
  page,
}) => {
  const shortVerse = [
    {
      ...sampleVerses[0],
      id: 'short-1',
      reference: 'Test 1:1',
      content: 'One two',
      memorizationStatus: 'unmemorized',
    },
  ]
  const collections = [{ id: 'c1', name: 'Test', description: '', createdAt: new Date().toISOString(), lastModified: new Date().toISOString() }]
  await seedStorage(page, shortVerse, collections)
  await page.reload()
  await page.goto('/?view=collections')
  await expect(page.getByText('All Verses')).toBeVisible({ timeout: 5000 })
  await page.getByText('All Verses').click()
  await page.waitForTimeout(500)
  await page.getByText('Test 1:1').first().click()

  await expect(page.getByText('Learn')).toHaveClass(/bg-blue-600|text-white/)
})

test('learn mode: verse with dash (no spaces) treats parts as separate words', async ({ page }) => {
  const verseWithDash = [
    {
      ...sampleVerses[0],
      id: 'dash-learn',
      reference: 'Genesis 17:8',
      content: 'One—two',
      memorizationStatus: 'unmemorized',
    },
  ]
  const collections = [{ id: 'c1', name: 'Test', description: '', createdAt: new Date().toISOString(), lastModified: new Date().toISOString() }]
  await seedStorage(page, verseWithDash, collections)
  await page.reload()
  await page.goto('/?view=collections')
  await expect(page.getByText('All Verses')).toBeVisible({ timeout: 5000 })
  await page.getByText('All Verses').click()
  await page.waitForTimeout(500)
  await page.getByText('Genesis 17:8').first().click()

  await expect(page.locator('#letter-input-memorize')).toBeAttached()
  await expect(page.getByText('Learn')).toHaveClass(/bg-blue-600|text-white/)

  // "One—two" must require 2 letters: "o" for "One", "t" for "two"
  await page.locator('#letter-input-memorize').focus()
  await page.keyboard.type('o', { delay: 50 })
  await page.waitForTimeout(100)
  // After "o", "One" should be revealed; "two" still grey - completion modal should NOT appear
  await expect(page.getByText('Great job!')).toHaveCount(0)

  await page.keyboard.type('t', { delay: 50 })
  await page.waitForTimeout(200)
  await expect(page.getByText('Great job!').first()).toBeVisible({ timeout: 3000 })
})

test('memorize mode: verse with dash treats parts as separate words', async ({ page }) => {
  const verseWithDash = [
    {
      ...sampleVerses[0],
      id: 'dash-memorize',
      reference: 'Test 2:1',
      content: 'A—B',
      memorizationStatus: 'learned',
    },
  ]
  const collections = [{ id: 'c1', name: 'Test', description: '', createdAt: new Date().toISOString(), lastModified: new Date().toISOString() }]
  await seedStorage(page, verseWithDash, collections)
  await page.reload()
  await page.goto('/?view=collections')
  await expect(page.getByText('All Verses')).toBeVisible({ timeout: 5000 })
  await page.getByText('All Verses').click()
  await page.waitForTimeout(500)
  await page.getByText('Test 2:1').first().click()

  // Click Memorize tab to enter memorize mode
  await page.getByText('Memorize').click()
  await page.waitForTimeout(200)
  await expect(page.locator('#letter-input-memorize')).toBeAttached()

  await page.locator('#letter-input-memorize').focus()
  await page.keyboard.type('a', { delay: 50 })
  await page.waitForTimeout(100)
  await expect(page.getByText('Great job!')).toHaveCount(0)

  await page.keyboard.type('b', { delay: 50 })
  await page.waitForTimeout(200)
  await expect(page.getByText('Great job!').first()).toBeVisible({ timeout: 3000 })
})

test('master mode: verse with dash treats parts as separate words', async ({ page }) => {
  const verseWithDash = [
    {
      ...sampleVerses[0],
      id: 'dash-master',
      reference: 'Test 3:1',
      content: 'X—Y',
      memorizationStatus: 'memorized',
    },
  ]
  const collections = [{ id: 'c1', name: 'Test', description: '', createdAt: new Date().toISOString(), lastModified: new Date().toISOString() }]
  await seedStorage(page, verseWithDash, collections)
  await page.reload()
  await page.goto('/?view=collections')
  await expect(page.getByText('All Verses')).toBeVisible({ timeout: 5000 })
  await page.getByText('All Verses').click()
  await page.waitForTimeout(500)
  await page.getByText('Test 3:1').first().click()

  await page.getByText('Master').click()
  await page.waitForTimeout(200)
  await expect(page.locator('#letter-input-memorize')).toBeAttached()

  await page.locator('#letter-input-memorize').focus()
  await page.keyboard.type('xy', { delay: 50 })
  await page.waitForTimeout(200)
  await expect(page.getByText('Great job!').first()).toBeVisible({ timeout: 3000 })
})
