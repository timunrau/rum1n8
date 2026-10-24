import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { clearAppStorage, getStoredVerses, seedStorage } from '../helpers/storage'
import { MOCK_VERSE_CONTENT, mockBibleApi } from '../helpers/mocks'
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

async function openAddVerseModal(page: Page) {
  await page.getByTestId('nav-collections').click()
  await page.getByTestId('fab-trigger').click()
  await page.getByTestId('fab-new-verse').click()
  await expect(page.getByTestId('modal-add-verse')).toBeVisible()
}

async function openPracticeSettings(page: Page) {
  await page.getByRole('button', { name: 'Menu' }).click()
  await expect(page.getByTestId('settings-practice')).toBeVisible()
  await page.getByTestId('settings-practice').click()
  await expect(page.getByTestId('modal-practice-settings')).toBeVisible()
}

test('add verse: FAB -> New Verse -> reference + content (manual) -> add -> appears in list', async ({
  page,
}) => {
  await openAddVerseModal(page)

  await page.getByLabel('Reference').fill('John 3:16')
  await page.getByLabel('Verse text', { exact: true }).fill('For God so loved the world.')
  await page.getByRole('button', { name: 'Add Verse' }).click()

  await expect(page.getByTestId('modal-add-verse')).not.toBeVisible()
  await expect(page.getByText('John 3:16')).toBeVisible()
})

test('add verse: default translation prefills new verses but not existing edits', async ({ page }) => {
  await openPracticeSettings(page)

  const defaultTranslation = page.getByLabel(/Default translation/i)
  await defaultTranslation.fill('bsb')
  await expect(defaultTranslation).toHaveValue('BSB')
  await page.getByRole('button', { name: 'Done' }).click()

  await openAddVerseModal(page)
  await expect(page.getByLabel('Bible version')).toHaveValue('BSB')
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByTestId('modal-add-verse')).not.toBeVisible()

  await seedStorage(page, [
    {
      id: 'existing-verse',
      reference: 'John 3:16',
      content: 'For God so loved the world.',
      bibleVersion: 'NIV',
      createdAt: '2026-06-20T12:00:00.000Z',
      lastModified: '2026-06-20T12:00:00.000Z',
      memorizationStatus: 'unmemorized',
      reviewCount: 0,
      lastReviewed: null,
      nextReviewDate: null,
      easeFactor: 2.5,
      interval: 0,
      reviewHistory: [],
      collectionIds: [],
    },
  ], [])
  await gotoApp(page, '?view=collections')
  await expect(page.getByText('John 3:16')).toBeVisible()
  await page.getByRole('button', { name: 'Edit verse' }).first().click()
  await expect(page.getByTestId('modal-edit-verse')).toBeVisible()
  await expect(page.getByLabel('Bible version')).toHaveValue('NIV')
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByTestId('modal-edit-verse')).not.toBeVisible()

  await openPracticeSettings(page)
  await page.getByLabel(/Default translation/i).fill('')
  await page.getByRole('button', { name: 'Done' }).click()

  await openAddVerseModal(page)
  await expect(page.getByLabel('Bible version')).toHaveValue('')
})

test('add verse: offers to save a different translation as the default only when needed', async ({ page }) => {
  await openAddVerseModal(page)

  const bibleVersion = page.getByLabel('Bible version')
  const defaultTranslationOption = page.getByTestId('new-verse-default-bible-version')

  await expect(defaultTranslationOption).toHaveCount(0)
  await bibleVersion.fill('niv')
  await expect(defaultTranslationOption).toBeVisible()
  await expect(page.getByText('Use NIV by default')).toBeVisible()

  await defaultTranslationOption.check()
  await page.getByLabel('Reference').fill('John 3:16')
  await page.getByLabel('Verse text', { exact: true }).fill('For God so loved the world.')
  await page.getByRole('button', { name: 'Add Verse' }).click()

  await openAddVerseModal(page)
  await expect(bibleVersion).toHaveValue('NIV')
  await expect(defaultTranslationOption).toHaveCount(0)

  await bibleVersion.fill('esv')
  await expect(defaultTranslationOption).toBeVisible()
  await expect(page.getByText('Use ESV by default')).toBeVisible()

  await bibleVersion.fill('niv')
  await expect(defaultTranslationOption).toHaveCount(0)
  await page.getByRole('button', { name: 'Cancel' }).click()

  await page.getByRole('button', { name: 'Edit verse' }).click()
  await expect(page.getByTestId('modal-edit-verse')).toBeVisible()
  await expect(defaultTranslationOption).toHaveCount(0)
})

test('add verse: normalized and overlapping saved references show a subtle warning', async ({ page }) => {
  const verses = [
    {
      id: 'exact',
      reference: 'John 3:16',
      content: 'For God so loved the world.',
      bibleVersion: 'ESV',
      createdAt: '2024-01-01T00:00:00.000Z',
      lastModified: '2024-01-01T00:00:00.000Z',
      memorizationStatus: 'unmemorized',
      reviewCount: 0,
      lastReviewed: null,
      nextReviewDate: null,
      easeFactor: 2.5,
      interval: 0,
      reviewHistory: [],
      collectionIds: [],
    },
    {
      id: 'overlap',
      reference: 'John 3:16-17',
      content: 'For God so loved the world, and more.',
      bibleVersion: 'NIV',
      createdAt: '2024-01-01T00:00:00.000Z',
      lastModified: '2024-01-01T00:00:00.000Z',
      memorizationStatus: 'unmemorized',
      reviewCount: 0,
      lastReviewed: null,
      nextReviewDate: null,
      easeFactor: 2.5,
      interval: 0,
      reviewHistory: [],
      collectionIds: [],
    },
  ]

  await seedStorage(page, verses, [])
  await gotoApp(page, '?view=collections')
  await page.getByTestId('fab-trigger').click()
  await page.getByTestId('fab-new-verse').click()

  await expect(page.getByTestId('modal-add-verse')).toBeVisible()
  await page.getByLabel('Reference').fill('Jn 3:16')
  await expect(page.getByText('Already in your library: John 3:16 (ESV); John 3:16-17 (NIV)')).toBeVisible()
})

test('add verse reference input: accepts ghost suggestions by enter, tab, or click', async ({ page }) => {
  await openAddVerseModal(page)
  const reference = page.getByLabel('Reference')

  await reference.fill('joh')
  await reference.press('Space')
  await expect(reference).toHaveValue('joh ')

  await reference.fill('joh')
  await reference.press('Enter')
  await expect(reference).toHaveValue('John ')

  await reference.fill('ps')
  await expect(page.getByRole('button', { name: 'Use Psalms' })).toHaveText('alms')
  await reference.press('Space')
  await expect(reference).toHaveValue('ps ')
  await expect(page.getByRole('button', { name: 'Use Psalms' })).toHaveCount(0)

  await reference.fill('ps')
  await reference.press('Tab')
  await expect(reference).toHaveValue('Psalms ')

  await reference.fill('1 Cor')
  await expect(page.getByRole('button', { name: 'Use 1 Corinthians' })).toHaveText('inthians')

  await reference.fill('jn')
  await expect(page.getByRole('button', { name: 'Use John' })).toHaveCount(0)

  await reference.fill('phile')
  await page.getByRole('button', { name: 'Use Philemon' }).click()
  await expect(reference).toHaveValue('Philemon ')
})

test('add verse reference input: normalizes valid references and validates invalid references on each blur', async ({ page }) => {
  await openAddVerseModal(page)
  const reference = page.getByLabel('Reference')
  const content = page.getByLabel('Verse text', { exact: true })

  await reference.fill('john   3 : 16 - 17')
  await content.click()
  await expect(reference).toHaveValue('John 3:16-17')

  await reference.fill('jn 3:16')
  await content.click()
  await expect(reference).toHaveValue('John 3:16')

  await reference.fill('phil 1:6')
  await content.click()
  await expect(reference).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByText('Enter a verse or chapter reference. Ranges can span verses or chapters.')).toBeVisible()
  await expect(page.getByText('Examples: John 3:16 · John 3:16–17 · John 3:36–4:2 · Psalm 1 · Psalm 1–3')).toBeVisible()

  await reference.fill('John')
  await expect(reference).not.toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByText(/Use a reference like/i)).toHaveCount(0)

  await reference.fill('still invalid')
  await expect(reference).not.toHaveAttribute('aria-invalid', 'true')
  await content.click()
  await expect(reference).toHaveAttribute('aria-invalid', 'true')

  await content.fill('I am sure of this.')
  await page.getByRole('button', { name: 'Add Verse' }).click()

  await expect(page.getByTestId('modal-add-verse')).toBeVisible()
  await expect(page.getByText('Enter a verse or chapter reference. Ranges can span verses or chapters.')).toBeVisible()
  await expect(page.getByText('Examples: John 3:16 · John 3:16–17 · John 3:36–4:2 · Psalm 1 · Psalm 1–3')).toBeVisible()
})

test('add verse import: stays visible, validates on click, and clears stale offline feedback on edit', async ({ page }) => {
  await openAddVerseModal(page)

  const reference = page.getByLabel('Reference')
  const bibleVersion = page.getByLabel('Bible version')
  const importButton = page.getByRole('button', { name: 'Import verse text' })

  const bibleRequests: string[] = []
  page.on('request', request => {
    if (request.url().includes('fetch.bible')) bibleRequests.push(request.url())
  })

  await expect(importButton).toBeVisible()

  await reference.fill('not a reference')
  await expect(importButton).toBeVisible()
  await importButton.click()
  await expect(reference).toBeFocused()
  await expect(reference).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByText('Enter a verse or chapter reference. Ranges can span verses or chapters.')).toBeVisible()
  expect(bibleRequests).toEqual([])

  await reference.fill('John 3:16')
  await expect(importButton).toBeVisible()
  await importButton.click()
  await expect(bibleVersion).toBeFocused()
  await expect(page.getByText('Please enter a Bible version first.')).toBeVisible()
  expect(bibleRequests).toEqual([])

  await bibleVersion.fill('BSB')
  await expect(page.getByText('Please enter a Bible version first.')).toHaveCount(0)

  await page.context().setOffline(true)
  await page.evaluate(() => window.dispatchEvent(new Event('offline')))
  await importButton.click()

  await expect(page.getByText('This translation has not finished downloading for offline import. Reconnect to finish the download, or paste content manually.')).toBeVisible()

  await reference.fill('John 3:17')
  await expect(page.getByText(/has not finished downloading for offline import/i)).toHaveCount(0)
  await page.context().setOffline(false)
})

test('add verse with Bible import: BSB shorthand imports content through the fetch-client v2 API', async ({
  page,
}) => {
  await mockBibleApi(page)
  await page.getByTestId('nav-collections').click()
  await page.getByTestId('fab-trigger').click()
  await page.getByTestId('fab-new-verse').click()

  await page.getByLabel('Reference').fill('John 3:16')
  await page.getByLabel('Bible version').fill('BSB')
  await page.getByRole('button', { name: 'Import verse text' }).click()

  await expect(page.getByLabel('Verse text', { exact: true })).toHaveValue(MOCK_VERSE_CONTENT)
  await expect(page.getByText(/Failed to import verse/i)).toHaveCount(0)

  await page.getByRole('button', { name: 'Add Verse' }).click()
  await expect(page.getByTestId('modal-add-verse')).not.toBeVisible()
  await expect(page.getByText('John 3:16')).toBeVisible()

  const storedVerses = await getStoredVerses(page) as Array<{
    reference: string
    bibleVersion: string
    content: string
  }>
  expect(storedVerses).toHaveLength(1)
  expect(storedVerses[0]).toMatchObject({
    reference: 'John 3:16',
    bibleVersion: 'BSB',
    content: MOCK_VERSE_CONTENT,
  })
})

test('add passage with Bible import: whole-chapter shorthand imports through the final verse', async ({ page }) => {
  const chapterVerses = Array.from({ length: 6 }, (_, index) => `Psalm 1 verse ${index + 1}.`)
  await mockBibleApi(page, MOCK_VERSE_CONTENT, {
    bookId: 'psa',
    bookName: 'Psalms',
    chapter: 1,
    startVerse: 1,
    verseContents: chapterVerses,
  })
  await openAddVerseModal(page)

  await page.getByLabel('Reference').fill('Psalm 1')
  await page.getByLabel('Bible version').fill('BSB')
  await page.getByRole('button', { name: 'Import verse text' }).click()

  await expect(page.getByLabel('Verse text', { exact: true })).toHaveValue(chapterVerses.join(' '))
  await page.getByRole('button', { name: 'Add Verse' }).click()
  await expect(page.getByText('Psalms 1')).toBeVisible()

  const storedVerses = await getStoredVerses(page) as Array<{ reference: string, content: string }>
  expect(storedVerses).toHaveLength(1)
  expect(storedVerses[0]).toMatchObject({
    reference: 'Psalms 1',
    content: chapterVerses.join(' '),
  })
})

test('whole-chapter references link to the full chapter for unavailable translations', async ({ page }) => {
  await mockBibleApi(page)
  await openAddVerseModal(page)

  await page.getByLabel('Reference').fill('Psalm 1')
  await page.getByLabel('Bible version').fill('NIV')
  await page.getByRole('button', { name: 'Import verse text' }).click()

  await expect(page.getByRole('link', { name: 'YouVersion' })).toHaveAttribute(
    'href',
    'https://www.bible.com/bible/111/PSA.1.NIV',
  )
})

test('verse import: unavailable translations use the same guidance in Add and Edit', async ({ page }) => {
  await mockBibleApi(page)
  const copyrightGuidance = 'This translation is copyrighted. Copy the text from one of the links below and paste it into Verse text.'
  const bsbGuidance = 'Or try the BSB translation to fill in the verse text automatically.'

  await openAddVerseModal(page)
  await page.getByLabel('Reference').fill('John 3:16')
  await page.getByLabel('Bible version').fill('NIV')
  await page.getByRole('button', { name: 'Import verse text' }).click()

  await expect(page.getByText(copyrightGuidance)).toBeVisible()
  await expect(page.getByText(bsbGuidance)).toBeVisible()
  await page.getByRole('button', { name: 'Cancel' }).click()

  await seedStorage(page, sampleVerses, [])
  await gotoApp(page, '?view=collections')
  await page.getByRole('button', { name: 'Edit verse' }).first().click()
  await page.getByLabel('Bible version').fill('NIV')
  await page.getByRole('button', { name: 'Import verse text' }).click()

  await expect(page.getByText(copyrightGuidance)).toBeVisible()
  await expect(page.getByText(bsbGuidance)).toBeVisible()
})

test('edit verse: search on Verses tab -> edit -> change content -> save', async ({ page }) => {
  await seedStorage(page, sampleVerses, [])
  await gotoApp(page, '?view=collections')
  await page.getByTestId('search-bar').click()
  await page.getByPlaceholder(/Search verses/i).fill('John')
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: 'Edit verse' }).first().click()

  await expect(page.getByTestId('modal-edit-verse')).toBeVisible()
  await page.getByLabel('Verse text', { exact: true }).fill('Updated verse content.')
  await page.getByRole('button', { name: /^Save$/i }).click()

  await expect(page.getByTestId('modal-edit-verse')).not.toBeVisible()
  await expect(page.getByTestId('search-screen').getByText('Updated verse content.')).toBeVisible()
})

test('edit verse: reference errors wait for blur and a version-only change reveals import', async ({ page }) => {
  await seedStorage(page, sampleVerses, [])
  await gotoApp(page, '?view=collections')
  await page.getByRole('button', { name: 'Edit verse' }).first().click()

  const reference = page.getByLabel('Reference')
  const content = page.getByLabel('Verse text', { exact: true })
  const bibleVersion = page.getByLabel('Bible version')
  const importButton = page.getByRole('button', { name: 'Import verse text' })

  await expect(importButton).toHaveCount(0)
  await reference.fill('')
  await expect(reference).not.toHaveAttribute('aria-invalid', 'true')

  await content.click()
  await expect(reference).toHaveAttribute('aria-invalid', 'true')

  await reference.fill('John 3:16')
  await expect(reference).not.toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByText(/Use a reference like/i)).toHaveCount(0)

  await bibleVersion.fill('NIV')
  await expect(importButton).toBeVisible()
})

test('edit verse: changing the reference shows duplicate warnings but ignores the verse itself', async ({ page }) => {
  await seedStorage(page, sampleVerses, [])
  await gotoApp(page, '?view=collections')
  await page.getByTestId('search-bar').click()
  await page.getByPlaceholder(/Search verses/i).fill('John')
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: 'Edit verse' }).first().click()

  await expect(page.getByTestId('modal-edit-verse')).toBeVisible()
  await expect(page.getByText(/Already in your library:/i)).toHaveCount(0)
  await page.getByLabel('Reference').fill('Ps 23:1')
  await expect(page.getByText('Already in your library: Psalm 23:1 (BSB)')).toBeVisible()
})

test('share fallback copies the reference only after the verse content', async ({ page }) => {
  await page.context().grantPermissions(['clipboard-write', 'clipboard-read'])
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: undefined,
    })
  })
  await seedStorage(page, sampleVerses, [])
  await gotoApp(page, '?view=collections')
  await page.getByTestId('search-bar').click()
  await page.getByPlaceholder(/Search verses/i).fill('John')
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: 'Share verse' }).first().click()
  await expect(page.getByText(/Verse copied| copied/i)).toBeVisible({ timeout: 3000 })
  const copied = await page.evaluate(() => navigator.clipboard.readText())
  expect(copied).toBe([
    sampleVerses[0].content,
    'John 3:16 (BSB)',
    '',
    'Shared from Ruminate',
    `${(process.env.PLAYWRIGHT_MARKETING_URL || 'http://127.0.0.1:5174').replace(/\/$/, '')}/`,
  ].join('\n'))
})

test('search: type in search bar on Verses tab -> results filtered', async ({ page }) => {
  await seedStorage(page, sampleVerses, [])
  await gotoApp(page, '?view=collections')
  await page.getByTestId('search-bar').click()
  await page.getByPlaceholder(/Search verses/i).fill('Psalm')
  await page.waitForTimeout(500)
  const searchScreen = page.getByTestId('search-screen')
  await expect(searchScreen.getByRole('heading', { name: /Psalm 23:1/ })).toBeVisible()
  await expect(searchScreen.getByRole('heading', { name: /John 3:16/ })).not.toBeVisible()
})

test('search: clearing search restores collection cards', async ({ page }) => {
  const collections = [
    { id: 'col-1', name: 'My Collection', createdAt: '2024-01-01T00:00:00.000Z', lastModified: '2024-01-01T00:00:00.000Z' },
  ]
  await seedStorage(page, sampleVerses, collections)
  await gotoApp(page, '?view=collections')
  await page.getByTestId('search-bar').click()
  const searchInput = page.getByPlaceholder(/Search verses/i)

  await searchInput.fill('John')
  await page.waitForTimeout(500)
  await expect(page.getByText('John 3:16')).toBeVisible()

  // Close the search overlay via the back button
  await page.locator('header button').first().click()
  await page.waitForTimeout(300)
  // Collection cards should be visible again
  await expect(page.getByText('All Verses')).toBeVisible()
})
