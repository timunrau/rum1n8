import { test, expect } from '@playwright/test'
import { clearAppStorage, seedStorage } from '../helpers/storage'
import { gotoApp } from '../helpers/navigation'

test.beforeEach(async ({ page }) => {
  await gotoApp(page)
  await clearAppStorage(page)
})

test('collection header exports an importer-compatible CSV for the collection subtree', async ({ page }) => {
  const collections = [
    { id: 'family', name: 'Family', description: 'Shared verses', parentId: null },
    { id: 'promises', name: 'Promises', description: '', parentId: 'family' },
    { id: 'grace', name: 'Grace', description: '', parentId: 'family' },
  ]
  const verses = [{
    id: 'shared',
    reference: 'John 3:16',
    content: 'For God so loved the world.',
    bibleVersion: 'NIV',
    collectionIds: ['promises', 'grace'],
    interval: 60,
    nextReviewDate: '2026-08-01T00:00:00.000Z',
  }]
  await seedStorage(page, verses, collections)
  await gotoApp(page, '?view=collection&collection=family')

  await page.getByTestId('collection-actions-trigger').click()
  await expect(page.getByTestId('collection-actions-menu')).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Edit collection' })).toBeVisible()

  const downloadPromise = page.waitForEvent('download')
  await page.getByTestId('collection-export-csv').click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('family-verses.csv')

  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.from(chunk))
  const csv = Buffer.concat(chunks).toString('utf8')

  expect(csv).toBe([
    '"Reference","Content","Version","CollectionPath"',
    '"John 3:16","For God so loved the world.","NIV","Family/Promises"',
    '"John 3:16","For God so loved the world.","NIV","Family/Grace"',
  ].join('\r\n'))
})

test('virtual collections do not show collection actions', async ({ page }) => {
  const verses = [{
    id: 'one',
    reference: 'John 3:16',
    content: 'For God so loved the world.',
    bibleVersion: 'NIV',
    collectionIds: [],
  }]
  await seedStorage(page, verses, [])
  await gotoApp(page, '?view=collection&collection=master-list')

  await expect(page.getByTestId('collection-actions-trigger')).toHaveCount(0)
})
