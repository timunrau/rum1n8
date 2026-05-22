import { test, expect } from '@playwright/test'
import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { clearAppStorage, seedStorage } from '../helpers/storage'
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

test('create collection: FAB -> New Collection -> fill -> submit -> appears in list', async ({
  page,
}) => {
  await page.getByTestId('nav-collections').click()
  await page.getByTestId('fab-trigger').click()
  await page.getByTestId('fab-new-collection').click()

  await expect(page.getByTestId('modal-add-collection')).toBeVisible()
  await page.getByLabel(/Collection Name/i).fill('Test Collection')
  await page.getByLabel(/Description/i).fill('Optional description')
  await page.getByRole('button', { name: /Create Collection/i }).click()

  await expect(page.getByTestId('modal-add-collection')).not.toBeVisible()
  await expect(page.getByText('Test Collection')).toBeVisible()
})

test('create child collection from inside a parent collection', async ({ page }) => {
  await page.getByTestId('nav-collections').click()
  await page.getByTestId('fab-trigger').click()
  await page.getByTestId('fab-new-collection').click()
  await page.getByLabel(/Collection Name/i).fill('Parent')
  await page.getByRole('button', { name: /Create Collection/i }).click()
  await page.getByText('Parent').click()

  await page.getByTestId('fab-trigger').click()
  await page.getByTestId('fab-new-collection').click()
  await page.getByLabel(/Collection Name/i).fill('Child')
  await page.getByRole('button', { name: /Create Collection/i }).click()

  await expect(page.getByText('Child')).toBeVisible()
  await page.locator('header button').first().click()
  await expect(page.getByText('Child')).not.toBeVisible()
})

test('edit collection: create collection -> edit -> change name -> save', async ({ page }) => {
  await page.getByTestId('nav-collections').click()
  await page.getByTestId('fab-trigger').click()
  await page.getByTestId('fab-new-collection').click()
  await page.getByLabel(/Collection Name/i).fill('Original Name')
  await page.getByRole('button', { name: /Create Collection/i }).click()
  await expect(page.getByText('Original Name')).toBeVisible()

  await page.locator('button[title="Edit collection"]').first().click()
  await expect(page.getByTestId('modal-edit-collection')).toBeVisible()
  await page.getByLabel(/Collection Name|Name/i).fill('Updated Name')
  await page.getByRole('button', { name: /^Save$/i }).click()
  await expect(page.getByTestId('modal-edit-collection')).not.toBeVisible()
  await expect(page.getByText('Updated Name')).toBeVisible()
})

test('view master-list, no-collection, to-learn with seeded verses', async ({ page }) => {
  const verses = [
    ...sampleVerses,
    {
      ...sampleVerses[0],
      id: 'verse-3',
      reference: 'Psalm 1:1',
      content: 'Blessed is the man',
      memorizationStatus: 'learned',
      collectionIds: ['to-learn'],
    },
  ]
  const collections = [
    { id: 'custom-1', name: 'Custom', description: '', createdAt: new Date().toISOString(), lastModified: new Date().toISOString() },
  ]
  await seedStorage(page, verses, collections)
  await gotoApp(page, '?view=collections')

  await expect(page.getByText('All Verses')).toBeVisible()
  await expect(page.getByText('Uncategorized')).toBeVisible()
  await expect(page.getByText('Not Yet Mastered')).toBeVisible()
})

test('one-level child collections: parent metrics aggregate while parent view shows direct verses', async ({ page }) => {
  const now = new Date().toISOString()
  const collections = [
    { id: 'parent', name: 'Parent', description: '', parentId: null, createdAt: now, lastModified: now },
    { id: 'child', name: 'Child', description: '', parentId: 'parent', createdAt: now, lastModified: now },
  ]
  const verses = [
    {
      ...sampleVerses[0],
      id: 'direct-verse',
      reference: 'Psalm 1:1',
      content: 'Direct parent verse',
      collectionIds: ['parent'],
      createdAt: now,
      lastModified: now,
    },
    {
      ...sampleVerses[0],
      id: 'child-verse',
      reference: 'Psalm 2:1',
      content: 'Child only verse',
      collectionIds: ['child'],
      createdAt: now,
      lastModified: now,
    },
    {
      ...sampleVerses[0],
      id: 'other-verse',
      reference: 'Psalm 3:1',
      content: 'Other verse',
      collectionIds: ['other'],
      createdAt: now,
      lastModified: now,
    },
  ]

  await seedStorage(page, verses, collections)
  await gotoApp(page, '?view=collections')

  await expect(page.getByTestId('collection-tile-parent')).toContainText('2 verses')
  await expect(page.getByTestId('collection-tile-child')).toHaveCount(0)

  await page.getByTestId('collection-tile-parent').click()
  await expect(page).toHaveURL(/\?view=collection&collection=parent/)
  await expect(page.getByTestId('collection-tile-child')).toBeVisible()
  await expect(page.getByText('Psalm 1:1')).toBeVisible()
  await expect(page.getByText('Psalm 2:1')).not.toBeVisible()
  await expect(page.getByText('Psalm 3:1')).not.toBeVisible()

  await page.getByTestId('collection-tile-child').click()
  await expect(page).toHaveURL(/\?view=collection&collection=child/)
  await expect(page.getByText('Psalm 2:1')).toBeVisible()
  await expect(page.getByText('Psalm 1:1')).not.toBeVisible()
  await expect(page.getByText('Psalm 3:1')).not.toBeVisible()

  await page.getByTestId('fab-trigger').click()
  await expect(page.getByTestId('fab-new-collection')).not.toBeVisible()
})

test('collection picker shows child collections as flat path chips', async ({ page }) => {
  const now = new Date().toISOString()
  const collections = [
    { id: 'parent', name: 'Parent', description: '', parentId: null, createdAt: now, lastModified: now },
    { id: 'child', name: 'Child', description: '', parentId: 'parent', createdAt: now, lastModified: now },
  ]

  await seedStorage(page, [], collections)
  await gotoApp(page, '?view=collections')

  await page.getByTestId('fab-trigger').click()
  await page.getByTestId('fab-new-verse').click()

  const parentChip = page.getByRole('button', { name: 'Parent', exact: true })
  const childChip = page.getByRole('button', { name: 'Parent / Child', exact: true })

  await expect(parentChip).toBeVisible()
  await expect(childChip).toBeVisible()

  await parentChip.click()
  await expect(parentChip).toHaveClass(/bg-action/)
  await childChip.click()
  await expect(parentChip).not.toHaveClass(/bg-action/)
  await expect(childChip).toHaveClass(/bg-action/)

  await parentChip.click()
  await expect(parentChip).toHaveClass(/bg-action/)
  await expect(childChip).not.toHaveClass(/bg-action/)
})

test('deleting a parent collection with children is blocked', async ({ page }) => {
  const now = new Date().toISOString()
  const collections = [
    { id: 'parent', name: 'Parent', description: '', parentId: null, createdAt: now, lastModified: now },
    { id: 'child', name: 'Child', description: '', parentId: 'parent', createdAt: now, lastModified: now },
  ]

  await seedStorage(page, [], collections)
  await gotoApp(page, '?view=collections')

  await page.getByTestId('collection-tile-parent').locator('button[title="Edit collection"]').click()
  await expect(page.getByTestId('modal-edit-collection')).toBeVisible()
  await page.getByRole('button', { name: /^Delete$/i }).click()
  await expect(page.getByTestId('modal-delete-collection-blocked')).toBeVisible()
  await page.getByRole('button', { name: 'OK' }).click()
  await page.keyboard.press('Escape')

  await expect(page.getByTestId('collection-tile-parent')).toBeVisible()
})

test('long numbered reference truncates the book without wrapping the verse reference', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })

  const now = new Date().toISOString()
  await seedStorage(page, [
    {
      ...sampleVerses[0],
      id: 'long-reference',
      reference: '1 Corinthians 13:11-13',
      content: 'When I was a child, I spoke as a child.',
      bibleVersion: 'BSB',
      memorizationStatus: 'unmemorized',
      collectionIds: ['master-list'],
      createdAt: now,
      lastModified: now,
    },
  ], [])
  await gotoApp(page, '?view=collection&collection=master-list')

  const reference = page.locator('.headword-ref[aria-label="1 Corinthians 13:11-13"]')
  await expect(reference).toBeVisible()

  const layout = await reference.evaluate((el) => {
    const book = el.querySelector('.headword-ref__book')
    const verse = el.querySelector('.headword-ref__verse')
    const version = el.nextElementSibling

    if (!(book instanceof HTMLElement) || !(verse instanceof HTMLElement) || !(version instanceof HTMLElement)) {
      throw new Error('Reference row markup changed')
    }

    const bookRect = book.getBoundingClientRect()
    const verseRect = verse.getBoundingClientRect()
    const versionRect = version.getBoundingClientRect()

    return {
      bookClientWidth: book.clientWidth,
      bookScrollWidth: book.scrollWidth,
      bookText: book.textContent,
      verseText: verse.textContent?.trim(),
      bookTop: bookRect.top,
      verseTop: verseRect.top,
      verseBottom: verseRect.bottom,
      versionTop: versionRect.top,
      versionBottom: versionRect.bottom,
    }
  })

  expect(layout.bookText).toBe('1 Corinthians')
  expect(layout.verseText).toBe('13:11-13')
  expect(layout.bookScrollWidth).toBeGreaterThan(layout.bookClientWidth)
  expect(Math.abs(layout.bookTop - layout.verseTop)).toBeLessThan(2)
  expect(layout.versionTop).toBeLessThan(layout.verseBottom)
  expect(layout.versionBottom).toBeGreaterThan(layout.verseTop)
})

test('empty state: no collections shows verse list or create CTA', async ({ page }) => {
  await clearAppStorage(page)
  await gotoApp(page, '?view=collections')

  const noVersesMsg = page.getByText(/No verses yet|Create your first collection|Add a verse/i)
  await expect(noVersesMsg.first()).toBeVisible({ timeout: 5000 })
})
