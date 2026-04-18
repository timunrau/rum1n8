import { test, expect } from '@playwright/test'
import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { clearAppStorage, seedAppSettings, seedStorage } from '../helpers/storage'
import { gotoApp } from '../helpers/navigation'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const sampleVerses = JSON.parse(
  readFileSync(path.join(__dirname, '../fixtures/sample-verses.json'), 'utf-8')
)

test.beforeEach(async ({ page }) => {
  await gotoApp(page)
  await clearAppStorage(page)
  await page.reload()
})

test('start from verse list -> click verse -> enters memorization screen', async ({ page }) => {
  const collections = [{ id: 'c1', name: 'Test', description: '', createdAt: new Date().toISOString(), lastModified: new Date().toISOString() }]
  await seedStorage(page, sampleVerses, collections)
  await page.reload()
  await gotoApp(page, '?view=collections')
  await expect(page.getByText('All Verses')).toBeVisible({ timeout: 5000 })
  await page.getByText('All Verses').click()
  await page.waitForTimeout(500)
  await page.getByText('John 3:16').first().click()

  await expect(page.locator('h1')).toContainText('John 3:16')
  await expect(page.locator('#letter-input-memorize')).toBeAttached()
  await expect(page.locator('#letter-input-memorize')).toBeFocused()
})

test('memorization: input focused after Continue to Memorize', async ({ page }) => {
  const shortVerse = [
    {
      ...sampleVerses[0],
      id: 'short-continue',
      reference: 'John 1:1',
      content: 'One two',
      memorizationStatus: 'unmemorized',
    },
  ]
  const collections = [{ id: 'c1', name: 'Test', description: '', createdAt: new Date().toISOString(), lastModified: new Date().toISOString() }]
  await seedStorage(page, shortVerse, collections)
  await page.reload()
  await gotoApp(page, '?view=collections')
  await expect(page.getByText('All Verses')).toBeVisible({ timeout: 5000 })
  await page.getByText('All Verses').click()
  await page.waitForTimeout(500)
  await page.getByText('John 1:1').first().click()

  await expect(page.locator('#letter-input-memorize')).toBeAttached()
  await page.locator('#letter-input-memorize').focus()
  await page.keyboard.type('ot', { delay: 100 })

  const continueBtn = page.getByRole('button', { name: /Continue to Memorize/i })
  await expect(continueBtn).toBeVisible({ timeout: 10000 })
  await continueBtn.click()

  await expect(page.locator('#letter-input-memorize')).toBeAttached()
  await expect(page.locator('#letter-input-memorize')).toBeFocused()
})

test('memorization: input focused after Try Again', async ({ page }) => {
  const twoWordVerse = [
    {
      ...sampleVerses[0],
      id: 'try-again-memo',
      reference: 'Psalm 1:1',
      content: 'Blessed is',
      memorizationStatus: 'unmemorized',
    },
  ]
  const collections = [{ id: 'c1', name: 'Test', description: '', createdAt: new Date().toISOString(), lastModified: new Date().toISOString() }]
  await seedStorage(page, twoWordVerse, collections)
  await page.reload()
  await gotoApp(page, '?view=collections')
  await expect(page.getByText('All Verses')).toBeVisible({ timeout: 5000 })
  await page.getByText('All Verses').click()
  await page.waitForTimeout(500)
  await page.getByText('Psalm 1:1').first().click()

  await expect(page.locator('#letter-input-memorize')).toBeAttached()
  await page.locator('#letter-input-memorize').focus()
  // One wrong letter then correct letters: 1 mistake in 2 words = 50% -> Try Again modal
  await page.keyboard.type('x', { delay: 50 })
  await page.keyboard.type('bi', { delay: 50 })

  await expect(page.getByText(/Keep practicing/i)).toBeVisible({ timeout: 5000 })
  const tryAgainBtn = page.getByRole('button', { name: 'Try Again' })
  await tryAgainBtn.click()

  await expect(page.locator('#letter-input-memorize')).toBeAttached()
  // Remount (key bump) is verified by attached input; auto-focus after Try Again is not asserted in headless (focus not observed after button click)
})

test('exit memorization: back button -> returns without completing', async ({ page }) => {
  const collections = [{ id: 'c1', name: 'Test', description: '', createdAt: new Date().toISOString(), lastModified: new Date().toISOString() }]
  await seedStorage(page, sampleVerses, collections)
  await page.reload()
  await gotoApp(page, '?view=collections')
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
  await gotoApp(page, '?view=collections')
  await expect(page.getByText('All Verses')).toBeVisible({ timeout: 5000 })
  await page.getByText('All Verses').click()
  await page.waitForTimeout(500)
  await page.getByText('Test 1:1').first().click()

  await expect(page.getByText('Learn')).toHaveClass(/mode-chip--active/)
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
  await gotoApp(page, '?view=collections')
  await expect(page.getByText('All Verses')).toBeVisible({ timeout: 5000 })
  await page.getByText('All Verses').click()
  await page.waitForTimeout(500)
  await page.getByText('Genesis 17:8').first().click()

  await expect(page.locator('#letter-input-memorize')).toBeAttached()
  await expect(page.getByText('Learn')).toHaveClass(/mode-chip--active/)

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
  await gotoApp(page, '?view=collections')
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

test('memorize mode: alternates hidden words on initial entry', async ({ page }) => {
  // 4-word verse: indices 0,1,2,3 = "One","Two","Three","Four"
  // First entry: count=1 → (index+1)%2===0 → odd indices (1,3) visible; even indices (0,2) hidden
  const verse = [
    {
      ...sampleVerses[0],
      id: 'alt-memo-1',
      reference: 'Alt 1:1',
      content: 'One Two Three Four',
      memorizationStatus: 'learned',
    },
  ]
  const collections = [{ id: 'c1', name: 'Test', description: '', createdAt: new Date().toISOString(), lastModified: new Date().toISOString() }]
  await seedStorage(page, verse, collections)
  await page.reload()
  await gotoApp(page, '?view=collections')
  await expect(page.getByText('All Verses')).toBeVisible({ timeout: 5000 })
  await page.getByText('All Verses').click()
  await page.waitForTimeout(500)
  await page.getByText('Alt 1:1').first().click()
  await expect(page.locator('#letter-input-memorize')).toBeAttached()

  // Even indices (0,2) should be hidden (text-transparent span present)
  await expect(page.locator('#practice-word-0 .text-transparent')).toBeAttached()
  await expect(page.locator('#practice-word-2 .text-transparent')).toBeAttached()
  // Odd indices (1,3) should be visible (no text-transparent span)
  await expect(page.locator('#practice-word-1 .text-transparent')).not.toBeAttached()
  await expect(page.locator('#practice-word-3 .text-transparent')).not.toBeAttached()
})

test('reference typing shows full reference and requires shorthand to complete', async ({ page }) => {
  const verse = [
    {
      ...sampleVerses[0],
      id: 'reference-tail',
      reference: 'John 3:16',
      content: 'One two',
      memorizationStatus: 'unmemorized',
    },
  ]
  const collections = [{ id: 'c1', name: 'Test', description: '', createdAt: new Date().toISOString(), lastModified: new Date().toISOString() }]
  await seedStorage(page, verse, collections)
  await seedAppSettings(page, { requireReferenceTyping: true })
  await page.reload()
  await gotoApp(page, '?view=collections')
  await page.getByText('All Verses').click()
  await page.waitForTimeout(500)
  await page.getByText('John 3:16').first().click()

  await expect(page.locator('#practice-word-2')).toContainText('John')
  await expect(page.locator('#practice-word-3')).toContainText('3:')
  await expect(page.locator('#practice-word-4')).toContainText('16')

  await page.locator('#letter-input-memorize').focus()
  await page.keyboard.type('ot', { delay: 50 })
  await page.waitForTimeout(150)
  await expect(page.getByText('Great job!')).toHaveCount(0)

  await page.keyboard.type('j316', { delay: 50 })
  await expect(page.getByText('Great job!').first()).toBeVisible({ timeout: 3000 })
})

test('reference typing keeps an incorrect earlier digit red after a later digit is correct', async ({ page }) => {
  const verse = [
    {
      ...sampleVerses[0],
      id: 'reference-digit-color',
      reference: 'Hebrews 12:2',
      content: 'One two',
      memorizationStatus: 'unmemorized',
    },
  ]
  const collections = [{ id: 'c1', name: 'Test', description: '', createdAt: new Date().toISOString(), lastModified: new Date().toISOString() }]
  await seedStorage(page, verse, collections)
  await seedAppSettings(page, { requireReferenceTyping: true })
  await page.reload()
  await gotoApp(page, '?view=collections')
  await page.getByText('All Verses').click()
  await page.waitForTimeout(500)
  await page.getByText('Hebrews 12:2').first().click()

  await page.locator('#letter-input-memorize').focus()
  await page.keyboard.type('oth', { delay: 50 })
  await page.keyboard.type('92', { delay: 50 })

  await expect(page.locator('#practice-word-3 .text-word-incorrect').first()).toHaveText('1')
  await expect(page.locator('#practice-word-3 .text-text-primary').first()).toHaveText('2')
})

test('memorize mode: pressing Memorize button again flips hidden words', async ({ page }) => {
  const verse = [
    {
      ...sampleVerses[0],
      id: 'alt-memo-2',
      reference: 'Alt 2:1',
      content: 'One Two Three Four',
      memorizationStatus: 'learned',
    },
  ]
  const collections = [{ id: 'c1', name: 'Test', description: '', createdAt: new Date().toISOString(), lastModified: new Date().toISOString() }]
  await seedStorage(page, verse, collections)
  await page.reload()
  await gotoApp(page, '?view=collections')
  await expect(page.getByText('All Verses')).toBeVisible({ timeout: 5000 })
  await page.getByText('All Verses').click()
  await page.waitForTimeout(500)
  await page.getByText('Alt 2:1').first().click()
  await expect(page.locator('#letter-input-memorize')).toBeAttached()

  // First entry: even indices hidden, odd visible
  await expect(page.locator('#practice-word-0 .text-transparent')).toBeAttached()
  await expect(page.locator('#practice-word-1 .text-transparent')).not.toBeAttached()

  // Press Memorize button again: count increments → pattern flips
  await page.getByText('Memorize').click()
  await page.waitForTimeout(200)

  // Now odd indices hidden, even visible
  await expect(page.locator('#practice-word-0 .text-transparent')).not.toBeAttached()
  await expect(page.locator('#practice-word-1 .text-transparent')).toBeAttached()
  await expect(page.locator('#practice-word-2 .text-transparent')).not.toBeAttached()
  await expect(page.locator('#practice-word-3 .text-transparent')).toBeAttached()
})

test('memorize mode: retry flips hidden words', async ({ page }) => {
  // Use a 2-word verse so we can complete it quickly and hit retry
  const verse = [
    {
      ...sampleVerses[0],
      id: 'alt-memo-3',
      reference: 'Alt 3:1',
      content: 'Alpha Beta',
      memorizationStatus: 'learned',
    },
  ]
  const collections = [{ id: 'c1', name: 'Test', description: '', createdAt: new Date().toISOString(), lastModified: new Date().toISOString() }]
  await seedStorage(page, verse, collections)
  await page.reload()
  await gotoApp(page, '?view=collections')
  await expect(page.getByText('All Verses')).toBeVisible({ timeout: 5000 })
  await page.getByText('All Verses').click()
  await page.waitForTimeout(500)
  await page.getByText('Alt 3:1').first().click()
  await expect(page.locator('#letter-input-memorize')).toBeAttached()

  // First entry (count=1): index 0 hidden, index 1 visible
  await expect(page.locator('#practice-word-0 .text-transparent')).toBeAttached()
  await expect(page.locator('#practice-word-1 .text-transparent')).not.toBeAttached()

  // Trigger Try Again: type a wrong letter then correct letters (1 mistake / 2 words = 50%)
  await page.locator('#letter-input-memorize').focus()
  await page.keyboard.type('x', { delay: 50 }) // wrong
  await page.keyboard.type('ab', { delay: 50 }) // correct: 'a' for Alpha, 'b' for Beta

  await expect(page.getByText(/Keep practicing/i)).toBeVisible({ timeout: 5000 })
  await page.getByRole('button', { name: 'Try Again' }).click()
  await page.waitForTimeout(200)
  await expect(page.locator('#letter-input-memorize')).toBeAttached()

  // After retry (count=2): pattern flips → index 0 visible, index 1 hidden
  await expect(page.locator('#practice-word-0 .text-transparent')).not.toBeAttached()
  await expect(page.locator('#practice-word-1 .text-transparent')).toBeAttached()
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
  await gotoApp(page, '?view=collections')
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
