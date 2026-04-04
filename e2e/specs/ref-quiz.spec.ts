import { test, expect } from '@playwright/test'
import { clearAppStorage, seedStorage, getStoredVerses } from '../helpers/storage'

// A mastered, reviewed verse that is due for reference quiz
function makeRefVerse(id: string, reference: string, content: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    reference,
    content,
    bibleVersion: 'ESV',
    createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
    lastModified: new Date().toISOString(),
    memorizationStatus: 'mastered',
    reviewCount: 2,
    lastReviewed: new Date(Date.now() - 86400000).toISOString(),
    nextReviewDate: new Date(Date.now() + 86400000 * 3).toISOString(),
    easeFactor: 2.5,
    interval: 3,
    reviewHistory: [],
    masteredAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    collectionIds: ['master-list'],
    refEaseFactor: 2.5,
    refInterval: 0,
    refNextReviewDate: new Date(Date.now() - 86400000).toISOString(), // due yesterday
    refLastReviewed: null,
    refReviewCount: 0,
    refReviewHistory: [],
    ...overrides,
  }
}

// Minimum 4 verses needed for the quiz to work
const VERSE_A = makeRefVerse('v1', 'John 3:16', 'For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.')
const VERSE_B = makeRefVerse('v2', 'Romans 8:28', 'And we know that in all things God works for the good of those who love him, who have been called according to his purpose.')
const VERSE_C = makeRefVerse('v3', 'Psalm 23:1', 'The LORD is my shepherd, I lack nothing.')
const VERSE_D = makeRefVerse('v4', 'Philippians 4:13', 'I can do all this through him who gives me strength.')

const FOUR_VERSES = [VERSE_A, VERSE_B, VERSE_C, VERSE_D]

// Determine the correct choice by matching the snippet shown on screen against known verses
async function getCorrectRef(page: any, verses: ReturnType<typeof makeRefVerse>[]) {
  const snippetEl = page.locator('[data-testid="ref-quiz-snippet"]')
  const raw = (await snippetEl.textContent() as string).trim()
  // Strip any surrounding quote characters (straight or curly) and trailing ellipsis
  const snippetText = raw.replace(/^["\u201C]/, '').replace(/["\u201D]$/, '').replace(/\u2026$/, '').replace(/\.\.\.$/, '').trim()
  const match = verses.find(v => {
    const first20 = v.content.substring(0, 20)
    return v.content.startsWith(snippetText) || snippetText.startsWith(first20)
  })
  return match?.reference ?? null
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await clearAppStorage(page)
  await page.reload()
})

// --- Navigation ---

test('Ref. Quiz tab appears in nav and navigates to references view', async ({ page }) => {
  await page.getByTestId('nav-references').click()
  await expect(page.getByTestId('nav-references')).toHaveClass(/text-nav-active/)
  await expect(page).toHaveURL(/\?view=references/)
})

test('FAB is hidden on references view', async ({ page }) => {
  await page.getByTestId('nav-references').click()
  await expect(page.getByTestId('fab-trigger')).not.toBeVisible()
})

// --- Empty / insufficient state ---

test('shows "not enough verses" when fewer than 4 eligible verses', async ({ page }) => {
  await seedStorage(page, [VERSE_A, VERSE_B, VERSE_C], [])
  await page.reload()
  await page.getByTestId('nav-references').click()

  await expect(page.getByText(/Not enough verses/i)).toBeVisible()
  await expect(page.getByRole('button', { name: /Start Quiz/i })).not.toBeVisible()
})

test('shows empty state when no verses have been mastered+reviewed', async ({ page }) => {
  await page.getByTestId('nav-references').click()
  await expect(page.getByText(/Not enough verses yet/i)).toBeVisible()
})

// --- Landing page stats ---

test('landing page shows correct due count and practiced count', async ({ page }) => {
  const notDue = makeRefVerse('v5', 'Genesis 1:1', 'In the beginning God created the heavens and the earth.', {
    refNextReviewDate: new Date(Date.now() + 86400000 * 5).toISOString(),
    refReviewCount: 1, // already practiced once
  })
  await seedStorage(page, [...FOUR_VERSES, notDue], [])
  await page.reload()
  await page.getByTestId('nav-references').click()

  await expect(page.locator('p.text-5xl')).toHaveText('4') // 4 due (FOUR_VERSES)
  await expect(page.getByText(/references due/i)).toBeVisible()
  await expect(page.getByText(/1 of 5 references practiced/i)).toBeVisible()
})

test('shows "no references due" message when all are in the future', async ({ page }) => {
  const futureDue = FOUR_VERSES.map((v, i) => makeRefVerse(
    `future-${i}`,
    v.reference,
    v.content,
    { refNextReviewDate: new Date(Date.now() + 86400000 * 10).toISOString() }
  ))
  await seedStorage(page, futureDue, [])
  await page.reload()
  await page.getByTestId('nav-references').click()

  await expect(page.getByText(/No references due/i)).toBeVisible()
  await expect(page.getByRole('button', { name: /Start Quiz/i })).not.toBeVisible()
})

// --- Quiz flow ---

test('Start Quiz button launches quiz with verse snippet and 4 choices', async ({ page }) => {
  await seedStorage(page, FOUR_VERSES, [])
  await page.reload()
  await page.getByTestId('nav-references').click()
  await page.getByRole('button', { name: /Start Quiz/i }).click()

  await expect(page.getByText(/Reference Quiz/i)).toBeVisible()
  await expect(page.getByText('1 / 4')).toBeVisible()

  // 4 choice buttons visible
  const choices = page.locator('.space-y-3 button')
  await expect(choices).toHaveCount(4)

  // The correct reference for the shown verse must be among the choices
  const correctRef = await getCorrectRef(page, FOUR_VERSES)
  expect(correctRef).toBeTruthy()
  await expect(choices.filter({ hasText: correctRef! })).toBeVisible()
})

test('correct answer on first attempt highlights green and auto-advances', async ({ page }) => {
  await seedStorage(page, FOUR_VERSES, [])
  await page.reload()
  await page.getByTestId('nav-references').click()
  await page.getByRole('button', { name: /Start Quiz/i }).click()

  const choices = page.locator('.space-y-3 button')
  const correctRef = await getCorrectRef(page, FOUR_VERSES)
  expect(correctRef).toBeTruthy()

  const correctButton = choices.filter({ hasText: correctRef! })
  await correctButton.click()

  // Green highlight applied (wait a tick for Vue reactivity)
  await expect(correctButton).toHaveClass(/bg-green-100/, { timeout: 1000 })

  // Auto-advances to question 2 after 800ms
  await expect(page.getByText('2 / 4')).toBeVisible({ timeout: 3000 })
})

test('wrong answer highlights red and is disabled; must tap correct to advance', async ({ page }) => {
  await seedStorage(page, FOUR_VERSES, [])
  await page.reload()
  await page.getByTestId('nav-references').click()
  await page.getByRole('button', { name: /Start Quiz/i }).click()

  const choices = page.locator('.space-y-3 button')
  const correctText = await getCorrectRef(page, FOUR_VERSES)
  expect(correctText).toBeTruthy()
  const choiceTexts = await choices.allTextContents()
  const wrongText = choiceTexts.find(t => t.trim() !== correctText && t.trim().length > 0)!

  // Tap wrong answer
  const wrongButton = choices.filter({ hasText: wrongText.trim() })
  await wrongButton.click()

  // Wrong button is red and disabled
  await expect(wrongButton).toHaveClass(/bg-red-100|red/)
  await expect(wrongButton).toBeDisabled()

  // Still on question 1
  await expect(page.getByText('1 / 4')).toBeVisible()

  // Tap correct answer (wait for Vue to process the disabled state first)
  await page.waitForTimeout(100)
  const correctButton = choices.filter({ hasText: correctText.trim() })
  await correctButton.click()

  // Advances to question 2 (800ms auto-advance + buffer)
  await expect(page.getByText('2 / 4')).toBeVisible({ timeout: 3000 })
})

test('Show full verse link expands snippet for long verses', async ({ page }) => {
  await seedStorage(page, FOUR_VERSES, [])
  await page.reload()
  await page.getByTestId('nav-references').click()
  await page.getByRole('button', { name: /Start Quiz/i }).click()

  // John 3:16 is longer than 12 words so "Show full verse" should appear on its question
  // Navigate until we see the show full verse link
  let showFullVerseVisible = false
  for (let i = 0; i < 4; i++) {
    const link = page.getByText('Show full verse')
    if (await link.isVisible()) {
      showFullVerseVisible = true
      await link.click()
      await expect(link).not.toBeVisible()
      break
    }
    // Advance by tapping correct answer
    const choices = page.locator('.space-y-3 button')
    const allRefs = [VERSE_A.reference, VERSE_B.reference, VERSE_C.reference, VERSE_D.reference]
    const choiceTexts = await choices.allTextContents()
    const correctText = choiceTexts.find(t => allRefs.includes(t.trim()))!
    await choices.filter({ hasText: correctText.trim() }).click()
    await page.waitForTimeout(900)
  }
  expect(showFullVerseVisible).toBe(true)
})

test('completing all due questions shows completion screen', async ({ page }) => {
  // Use 4 short verses so we can answer quickly
  const shortVerses = [
    makeRefVerse('s1', 'John 11:35', 'Jesus wept.'),
    makeRefVerse('s2', 'Psalm 23:1', 'The LORD is my shepherd, I lack nothing.'),
    makeRefVerse('s3', 'John 3:16', 'For God so loved the world.'),
    makeRefVerse('s4', 'Romans 8:28', 'All things work together for good.'),
  ]
  await seedStorage(page, shortVerses, [])
  await page.reload()
  await page.getByTestId('nav-references').click()
  await page.getByRole('button', { name: /Start Quiz/i }).click()

  for (let i = 0; i < 4; i++) {
    // Wait for question counter to show current index
    await expect(page.getByText(`${i + 1} / 4`)).toBeVisible({ timeout: 3000 })
    const correctRef = await getCorrectRef(page, shortVerses)
    expect(correctRef).toBeTruthy()
    const choices = page.locator('.space-y-3 button')
    await choices.filter({ hasText: correctRef! }).click()
    // Wait for green highlight then auto-advance
    await page.waitForTimeout(1000)
  }

  await expect(page.getByText(/All caught up/i)).toBeVisible({ timeout: 3000 })
  await expect(page.getByText(/4 references reviewed/i)).toBeVisible()
})

test('back button exits quiz and returns to references tab', async ({ page }) => {
  await seedStorage(page, FOUR_VERSES, [])
  await page.reload()
  await page.getByTestId('nav-references').click()
  await page.getByRole('button', { name: /Start Quiz/i }).click()

  await expect(page.getByText(/Reference Quiz/i)).toBeVisible()

  await page.getByTestId('ref-quiz-back').click()

  await expect(page.getByText(/Reference Quiz/i)).not.toBeVisible()
  await expect(page.getByTestId('nav-references')).toHaveClass(/text-nav-active/)
})

// --- SRS updates ---

test('correct first-attempt answer updates refNextReviewDate and refReviewCount', async ({ page }) => {
  const shortVerses = [
    makeRefVerse('s1', 'John 11:35', 'Jesus wept.'),
    makeRefVerse('s2', 'Psalm 23:1', 'The LORD is my shepherd.'),
    makeRefVerse('s3', 'Romans 3:23', 'For all have sinned.'),
    makeRefVerse('s4', 'Romans 6:23', 'The wages of sin is death.'),
  ]
  await seedStorage(page, shortVerses, [])
  await page.reload()
  await page.getByTestId('nav-references').click()
  await page.getByRole('button', { name: /Start Quiz/i }).click()

  const choices = page.locator('.space-y-3 button')
  await expect(choices.first()).toBeEnabled({ timeout: 3000 })
  const correctText = await getCorrectRef(page, shortVerses)
  expect(correctText).toBeTruthy()
  await choices.filter({ hasText: correctText! }).click()
  // Wait for saveVerses to be called (happens synchronously in handleRefQuizChoice)
  await expect(choices.filter({ hasText: correctText! })).toHaveClass(/bg-green-100/, { timeout: 1000 })

  const stored = await getStoredVerses(page) as any[]
  const answered = stored.find(v => v.reference === correctText!.trim())
  expect(answered).toBeTruthy()
  expect(answered.refReviewCount).toBe(1)
  // refNextReviewDate should be in the future (advanced by SRS)
  expect(new Date(answered.refNextReviewDate).getTime()).toBeGreaterThan(Date.now())
})

test('wrong-then-correct answer saves grade 1 (shorter interval than grade 5)', async ({ page }) => {
  const shortVerses = [
    makeRefVerse('s1', 'John 11:35', 'Jesus wept.'),
    makeRefVerse('s2', 'Psalm 23:1', 'The LORD is my shepherd.'),
    makeRefVerse('s3', 'Romans 3:23', 'For all have sinned.'),
    makeRefVerse('s4', 'Romans 6:23', 'The wages of sin is death.'),
  ]
  await seedStorage(page, shortVerses, [])
  await page.reload()
  await page.getByTestId('nav-references').click()
  await page.getByRole('button', { name: /Start Quiz/i }).click()

  const choices = page.locator('.space-y-3 button')
  await expect(choices.first()).toBeEnabled({ timeout: 3000 })
  const correctText = await getCorrectRef(page, shortVerses)
  expect(correctText).toBeTruthy()
  const choiceTexts = await choices.allTextContents()
  const wrongText = choiceTexts.find(t => t.trim() !== correctText && t.trim().length > 0)!

  // Tap wrong first, then correct
  await choices.filter({ hasText: wrongText.trim() }).click()
  await page.waitForTimeout(100) // wait for Vue to process disabled state
  await choices.filter({ hasText: correctText! }).click()
  // Wait for green highlight (save happens synchronously before it)
  await expect(choices.filter({ hasText: correctText! })).toHaveClass(/bg-green-100/, { timeout: 1000 })

  const stored = await getStoredVerses(page) as any[]
  const answered = stored.find(v => v.reference === correctText!.trim())
  expect(answered.refReviewCount).toBe(1)
  // grade 1 → interval should be very short (≤ 1 day)
  expect(answered.refInterval).toBeLessThanOrEqual(1)
})

// --- Data migration ---

test('existing mastered+reviewed verses without refNextReviewDate are migrated on load', async ({ page }) => {
  const legacy = {
    id: 'legacy-1',
    reference: 'Hebrews 11:1',
    content: 'Now faith is confidence in what we hope for.',
    bibleVersion: 'NIV',
    createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
    lastModified: new Date().toISOString(),
    memorizationStatus: 'mastered',
    reviewCount: 5,
    lastReviewed: new Date(Date.now() - 86400000).toISOString(),
    nextReviewDate: new Date(Date.now() + 86400000 * 2).toISOString(),
    easeFactor: 2.5,
    interval: 3,
    reviewHistory: [],
    masteredAt: new Date(Date.now() - 86400000 * 20).toISOString(),
    collectionIds: ['master-list'],
    // No ref* fields — simulates pre-feature data
  }
  await seedStorage(page, [legacy, ...FOUR_VERSES.slice(0, 3)], [])
  await page.reload()

  const stored = await getStoredVerses(page) as any[]
  const migrated = stored.find(v => v.id === 'legacy-1')
  expect(migrated.refNextReviewDate).toBeTruthy()
  // Should be due immediately (in the past or now)
  expect(new Date(migrated.refNextReviewDate).getTime()).toBeLessThanOrEqual(Date.now() + 5000)
})
