import { test, expect, type Page } from '@playwright/test'
import { clearAppStorage, seedStorage, seedWebDAVSettings, seedAppSettings, getStoredVerses } from '../helpers/storage'
import { gotoApp } from '../helpers/navigation'

test.use({ timezoneId: 'America/Winnipeg' })
const now = new Date('2026-11-12T12:00:00.000Z')
const day = (offset: number) => new Date(+now + offset * 86400000).toISOString()
const makeVerse = (overrides: Record<string, unknown> = {}) => ({
  id: 'v', reference: 'John 3:16', content: 'For God', bibleVersion: 'BSB',
  memorizationStatus: 'mastered', interval: 30, reviewCount: 5, easeFactor: 2.5,
  createdAt: day(-100), masteredAt: day(-90), lastModified: day(-30), lastReviewed: day(-30),
  nextReviewDate: day(0), reviewHistory: [] as Record<string, unknown>[], collectionIds: [] as string[],
  ...overrides,
})
type StoredVerse = ReturnType<typeof makeVerse> & { lastGrade?: number; reviewSchedule?: { forceDue: boolean; earnedInterval: number } }
type SyncFile = { verses: StoredVerse[]; collections: Record<string, unknown>[];
  appSettings?: Record<string, unknown>; appSettingsLastModified?: string;
  deletedVerses?: { id: string; deletedAt: string }[] }
const stored = async (page: Page) => await getStoredVerses(page) as StoredVerse[]

// A deterministic server, with a gate rather than a timed sleep to reproduce races.
async function mockSync(page: Page, initial: SyncFile | null, pause?: 'GET' | 'PUT', failFirstUpload = false) {
  let remote = structuredClone(initial)
  let signalPaused!: () => void
  const paused = new Promise<void>(resolve => { signalPaused = resolve })
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  let gateUsed = false
  let uploads = 0
  let completedUploads = 0
  const payloads: SyncFile[] = []
  await page.route('**/sync-test/**', async route => {
    const method = route.request().method()
    const snapshot = structuredClone(remote)
    if (!gateUsed && method === pause) {
      gateUsed = true
      signalPaused()
      await gate
    }
    if (method === 'GET') {
      await route.fulfill({ status: snapshot ? 200 : 404, contentType: 'application/json', body: JSON.stringify(snapshot) })
    } else if (method === 'PUT') {
      uploads++
      const payload = route.request().postDataJSON() as SyncFile
      payloads.push(payload)
      if (failFirstUpload && uploads === 1) {
        await route.fulfill({ status: 500 })
      } else {
        remote = payload
        await route.fulfill({ status: 200 })
      }
      completedUploads++
    } else {
      await route.fulfill({ status: 207, body: '<multistatus/>' })
    }
  })
  await seedWebDAVSettings(page, { url: 'https://example.com/sync-test/', username: 'test', password: 'synthetic', useProxy: false })
  return { paused, release: () => release(), payloads, remote: () => remote, completedUploads: () => completedUploads }
}

async function settled(page: Page, server: Awaited<ReturnType<typeof mockSync>>, expectedUploads = 1) {
  await expect.poll(server.completedUploads).toBeGreaterThanOrEqual(expectedUploads)
  const back = page.getByRole('button', { name: 'Back', exact: true })
  if (await back.isVisible()) await back.click()
  await page.getByTestId('nav-collections').click()
  await page.getByTestId('hamburger-button').click()
  await expect(page.getByTestId('settings-sync-now')).toBeEnabled()
  await expect(page.getByTestId('drawer-sync-status')).not.toContainText('Syncing')
  await page.mouse.click((page.viewportSize()?.width || 1280) - 10, 100)
  await expect(page.getByTestId('drawer-sync-status')).not.toBeVisible()
}
async function review(page: Page, letters = 'fg', finish = true) {
  await page.getByText('John 3:16', { exact: true }).click()
  await page.locator('#letter-input-review').focus()
  await page.keyboard.type(letters)
  await expect(page.locator('.completion-tray')).toBeVisible()
  if (finish) await page.getByRole('button', { name: 'Done', exact: true }).click()
}

test.beforeEach(async ({ page }) => {
  await gotoApp(page)
  await clearAppStorage(page)
  await page.clock.setFixedTime(now)
  await seedAppSettings(page, { reviewMode: 'rotation', maxReviewIntervalDays: 90 }, day(-1))
})

for (const phase of ['GET', 'PUT'] as const) {
  for (const outcome of ['success', 'failure'] as const) {
    test(`review completed during ${phase} survives sync (${outcome}) and reaches the server`, async ({ page }) => {
      const verse = makeVerse()
      const server = await mockSync(page, { verses: [verse], collections: [] }, phase)
      await seedStorage(page, [verse], [])
      await gotoApp(page, '?view=review-list')
      await server.paused
      await review(page, outcome === 'success' ? 'fg' : 'xx', outcome === 'success')
      const completed = (await stored(page))[0]
      expect(completed.reviewCount).toBe(6)
      if (outcome === 'failure') expect(completed.interval).toBe(1)
      server.release()
      await settled(page, server, 2)
      expect((await stored(page))[0]).toEqual(completed)
      expect(server.remote()?.verses[0]).toEqual(completed)
    })
  }

  for (const action of ['reset', 'override', 'edit', 'add', 'delete', 'maximum'] as const) {
    test(`${action} during ${phase} is preserved locally and in the queued sync`, async ({ page }) => {
      const verse = makeVerse()
      const server = await mockSync(page, { verses: [verse], collections: [] }, phase)
      await seedStorage(page, [verse], [])
      await gotoApp(page, '?view=collections')
      await server.paused
      if (action === 'maximum') {
        await page.getByTestId('hamburger-button').click()
        await page.getByTestId('settings-practice').click()
        await page.getByTestId('max-review-interval').fill('7')
        await page.getByTestId('apply-max-review-interval').click()
        await page.getByTestId('modal-practice-settings').getByRole('button', { name: 'Done', exact: true }).click()
      } else if (action === 'add') {
        await page.getByTestId('fab-trigger').click()
        await page.getByTestId('fab-new-verse').click()
        await page.getByLabel('Reference', { exact: true }).fill('Romans 8:1')
        await page.getByLabel('Verse text', { exact: true }).fill('Therefore there is now no condemnation')
        await page.getByRole('button', { name: 'Add Verse', exact: true }).click()
      } else {
        await page.getByRole('button', { name: 'Edit verse' }).first().click()
        if (action === 'reset') {
          await page.getByTestId('verse-schedule-reset').click()
        } else if (action === 'override') {
          await page.getByTestId('verse-schedule-change').click()
          await page.getByTestId('verse-schedule-popover').getByRole('button', { name: '+1w', exact: true }).click()
          await page.getByTestId('modal-edit-verse').getByRole('button', { name: 'Cancel', exact: true }).click()
        } else if (action === 'edit') {
          await page.getByLabel('Verse text', { exact: true }).fill('For God so loved')
          await page.getByTestId('modal-edit-verse').getByRole('button', { name: 'Save', exact: true }).click()
        } else {
          await page.getByTestId('modal-edit-verse').getByRole('button', { name: 'Delete', exact: true }).click()
          await page.getByTestId('modal-delete-verse-confirm').getByRole('button', { name: 'Delete', exact: true }).click()
        }
      }
      const changed = await stored(page)
      server.release()
      await settled(page, server, 2)
      expect(await stored(page)).toEqual(changed)
      expect(server.remote()?.verses).toEqual(changed)
      if (action === 'maximum') {
        expect(server.remote()?.appSettings?.maxReviewIntervalDays).toBe(7)
        expect((await stored(page))[0].interval).toBe(7)
        expect((await stored(page))[0].reviewSchedule?.earnedInterval).toBe(30)
      }
      if (action === 'delete') expect(server.remote()?.deletedVerses?.map(v => v.id)).toContain('v')
    })
  }
}

test('first upload to a new account preserves a review completed during that upload', async ({ page }) => {
  const server = await mockSync(page, null, 'PUT')
  await seedStorage(page, [makeVerse()], [])
  await gotoApp(page, '?view=review-list')
  await server.paused
  await review(page)
  const completed = (await stored(page))[0]
  server.release()
  await settled(page, server, 2)
  expect((await stored(page))[0]).toEqual(completed)
  expect(server.remote()?.verses[0]).toEqual(completed)
})

test('failed upload preserves local data and the next review retries it', async ({ page }) => {
  const verse = makeVerse()
  const server = await mockSync(page, { verses: [verse], collections: [] }, 'PUT', true)
  await seedStorage(page, [verse], [])
  await gotoApp(page, '?view=review-list')
  await server.paused
  server.release()
  await settled(page, server)
  await review(page)
  const completed = (await stored(page))[0]
  await settled(page, server, 2)
  expect((await stored(page))[0]).toEqual(completed)
  expect(server.remote()?.verses[0]).toEqual(completed)
})

test('newer remote reset is honored even if a review was open when sync started', async ({ page }) => {
  const verse = makeVerse()
  const server = await mockSync(page, { verses: [verse], collections: [] })
  await seedStorage(page, [verse], [])
  await gotoApp(page, '?view=review-list')
  await settled(page, server)
  const remote = server.remote()!
  remote.verses[0] = makeVerse({ memorizationStatus: 'unmemorized', interval: 0, reviewCount: 0,
    nextReviewDate: null, lastReviewed: null, lastModified: day(0), reviewScheduleModifiedAt: day(0), masteredAt: null })
  await page.getByText('John 3:16', { exact: true }).click()
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    window.dispatchEvent(new Event('offline'))
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
    window.dispatchEvent(new Event('online'))
  })
  await settled(page, server, 2)
  expect((await stored(page))[0].memorizationStatus).toBe('unmemorized')
})

test('offline review is uploaded on reconnect and survives reload', async ({ page }) => {
  const verse = makeVerse()
  const server = await mockSync(page, { verses: [verse], collections: [] })
  await seedStorage(page, [verse], [])
  await gotoApp(page, '?view=review-list')
  await settled(page, server)
  await page.context().setOffline(true)
  await review(page)
  const completed = (await stored(page))[0]
  expect(completed.reviewCount).toBe(6)
  expect(server.completedUploads()).toBe(1)
  await page.context().setOffline(false)
  await settled(page, server, 2)
  expect((await stored(page))[0]).toEqual(completed)
  expect(server.remote()?.verses[0]).toEqual(completed)
  await page.reload()
  await settled(page, server, 3)
  expect((await stored(page))[0]).toEqual(completed)
})

test('undo after a reset has synced restores progress on both devices', async ({ page }) => {
  const verse = makeVerse()
  const server = await mockSync(page, { verses: [verse], collections: [] })
  await seedStorage(page, [verse], [])
  await gotoApp(page, '?view=collections')
  await settled(page, server)
  await page.getByRole('button', { name: 'Edit verse' }).first().click()
  await page.getByTestId('verse-schedule-reset').click()
  await settled(page, server, 2)
  expect((await stored(page))[0].memorizationStatus).toBe('unmemorized')
  await page.clock.setFixedTime(new Date(+now + 1000))
  await page.getByTestId('toast-action').click()
  await settled(page, server, 3)
  expect((await stored(page))[0]).toMatchObject({ ...verse, lastModified: new Date(+now + 1000).toISOString() })
  expect(server.remote()?.verses[0]).toEqual((await stored(page))[0])
})

test('manual retry after an upload error succeeds without changing review progress', async ({ page }) => {
  const verse = makeVerse()
  const server = await mockSync(page, { verses: [verse], collections: [] }, undefined, true)
  await seedStorage(page, [verse], [])
  await gotoApp(page, '?view=review-list')
  await settled(page, server)
  const original = (await stored(page))[0]
  await page.getByTestId('hamburger-button').click()
  await expect(page.getByTestId('settings-sync-now')).toHaveText('Retry')
  await page.getByTestId('settings-sync-now').click()
  await settled(page, server, 2)
  expect((await stored(page))[0]).toEqual(original)
  expect(server.remote()?.verses[0]).toEqual(original)
})
