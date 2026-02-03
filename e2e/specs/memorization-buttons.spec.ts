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

test('Learn modal shows Keep Learning and Continue buttons; Keep Learning sits below Continue on small screens', async ({ page }) => {
  const shortVerse = [
    {
      ...sampleVerses[0],
      id: 'short-learn-1',
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
  await page.keyboard.type('itb', { delay: 50 })

  const modalText = page.getByText(/Great job|Ready to memorize/i)
  await expect(modalText).toBeVisible({ timeout: 5000 })

  const btnContinue = page.getByRole('button', { name: /Continue to Memorize/i })
  const btnKeep = page.getByRole('button', { name: /Keep Learning/i })
  await expect(btnContinue).toBeVisible()
  await expect(btnKeep).toBeVisible()

  // Small viewport: ensure Continue is visually above Keep
  await page.setViewportSize({ width: 375, height: 800 })
  const boxContinue = await btnContinue.boundingBox()
  const boxKeep = await btnKeep.boundingBox()
  expect(boxContinue).not.toBeNull()
  expect(boxKeep).not.toBeNull()
  if (boxContinue && boxKeep) {
    expect(boxContinue.y).toBeLessThan(boxKeep.y)
  }

  // Clicking Keep Learning should close modal and return to memorization input
  await btnKeep.click()
  await expect(modalText).not.toBeVisible()
  await expect(page.locator('#letter-input-memorize')).toBeAttached()
})

test('Memorize modal shows Keep Memorizing and Continue to Master; Keep Memorizing stacks underneath on small screens', async ({ page }) => {
  const shortVerse = [
    {
      ...sampleVerses[0],
      id: 'short-memorize-1',
      reference: 'Test 2:1',
      content: 'One two three',
      memorizationStatus: 'learned',
    },
  ]
  const collections = [{ id: 'c1', name: 'Test', description: '', createdAt: new Date().toISOString(), lastModified: new Date().toISOString() }]
  await seedStorage(page, shortVerse, collections)
  await page.reload()
  await page.goto('/?view=collections')
  await expect(page.getByText('All Verses')).toBeVisible({ timeout: 5000 })
  await page.getByText('All Verses').click()
  await page.waitForTimeout(500)
  await page.getByText('Test 2:1').first().click()

  // Switch to Memorize mode
  await page.getByText('Memorize').click()

  await expect(page.locator('#letter-input-memorize')).toBeAttached()
  await page.locator('#letter-input-memorize').focus()
  await page.keyboard.type('ot3', { delay: 50 })

  const modalText = page.getByText(/Great job|Ready to master/i)
  await expect(modalText).toBeVisible({ timeout: 5000 })

  const btnContinue = page.getByRole('button', { name: /Continue to Master/i })
  const btnKeep = page.getByRole('button', { name: /Keep Memorizing/i })
  await expect(btnContinue).toBeVisible()
  await expect(btnKeep).toBeVisible()

  await page.setViewportSize({ width: 375, height: 800 })
  const boxContinue = await btnContinue.boundingBox()
  const boxKeep = await btnKeep.boundingBox()
  expect(boxContinue).not.toBeNull()
  expect(boxKeep).not.toBeNull()
  if (boxContinue && boxKeep) {
    expect(boxContinue.y).toBeLessThan(boxKeep.y)
  }

  await btnKeep.click()
  await expect(modalText).not.toBeVisible()
  await expect(page.locator('#letter-input-memorize')).toBeAttached()
})
