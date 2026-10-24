import { test, expect } from '@playwright/test'
import { clearAppStorage, seedStorage } from '../helpers/storage'
import { gotoApp } from '../helpers/navigation'
import { seedRetiredVoiceData, verifyRetiredVoiceCleanup } from '../helpers/retired-voice.mjs'

interface AudioCalls {
  spoken: string[]
  cancelled: number
  microphone: number
}

test('legacy downloads are cleaned on startup and foreground without changing saved data', async ({ page }) => {
  const errors: string[] = []
  const modelRequests: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => {
    if (new URL(request.url()).pathname.startsWith('/voice-model/')) modelRequests.push(request.url())
  })
  await gotoApp(page)
  await clearAppStorage(page)
  const verses = [{
    id: 'retired-voice-sentinel', reference: 'John 1:1', content: 'One two three',
    bibleVersion: 'BSB', memorizationStatus: 'unmemorized',
    createdAt: '2026-01-01T00:00:00.000Z', lastModified: '2026-01-01T00:00:00.000Z',
    reviewCount: 0, lastReviewed: null as string | null, nextReviewDate: null, easeFactor: 2.5, interval: 0,
    reviewHistory: [] as Array<{ date: string; grade: number; mistakes: number }>, collectionIds: [],
  }]
  verses.push({
    ...verses[0], id: 'saved-review-history', reference: 'Psalm 1:1', memorizationStatus: 'mastered',
    reviewCount: 1, lastReviewed: '2026-01-01T00:00:00.000Z',
    reviewHistory: [{ date: '2026-01-01T00:00:00.000Z', grade: 2, mistakes: 1 }],
  })
  await seedStorage(page, verses, [])
  // Snapshot after the app's ordinary legacy-verse normalization has run.
  await page.reload()
  await seedRetiredVoiceData(page)
  const saved = await page.evaluate(() => localStorage.getItem('rum1n8-verses'))
  expect(JSON.parse(saved!).find((verse: { id: string }) => verse.id === 'saved-review-history').reviewHistory).toHaveLength(1)
  await page.reload()
  await verifyRetiredVoiceCleanup(page)
  expect(await page.evaluate(() => localStorage.getItem('rum1n8-verses'))).toBe(saved)

  await page.getByTestId('hamburger-button').click()
  await page.getByTestId('settings-practice').click()
  await expect(page.getByTestId('voice-practice-toggle')).toHaveCount(0)
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await gotoApp(page, '?view=collections')
  await page.getByText('John 1:1', { exact: true }).first().click()
  await expect(page.locator('#letter-input-memorize')).toBeFocused()
  await expect(page.getByRole('button', { name: 'Voice practice' })).toHaveCount(0)

  // An older open tab may finish a download after the new app has started.
  await page.evaluate(async () => {
    const cache = await caches.open('ruminate-voice-model-recreated')
    await cache.put('/late-model', new Response('partial'))
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await verifyRetiredVoiceCleanup(page)
  await page.keyboard.type('ott')
  await expect(page.getByText('Learned', { exact: true })).toBeVisible()
  expect(errors).toEqual([])
  expect(modelRequests).toEqual([])
})

test('Read Aloud still starts and stops in practice and review without requesting the microphone', async ({ page }) => {
  await page.addInitScript(() => {
    const calls = { spoken: [] as string[], cancelled: 0, microphone: 0 }
    Object.defineProperty(window, '__audioCalls', { value: calls })
    Object.defineProperty(window, 'speechSynthesis', { value: {
      speak: (utterance: SpeechSynthesisUtterance) => calls.spoken.push(utterance.text),
      cancel: () => { calls.cancelled++ },
    } })
    navigator.mediaDevices.getUserMedia = async () => {
      calls.microphone++
      throw new Error('The retired feature must not request the microphone')
    }
  })
  await gotoApp(page)
  await clearAppStorage(page)
  await seedStorage(page, [{
    id: 'read-aloud', reference: 'John 1:1', content: 'One two three', bibleVersion: 'BSB',
    memorizationStatus: 'mastered', createdAt: '2026-01-01T00:00:00.000Z',
    lastModified: '2026-01-01T00:00:00.000Z', reviewHistory: [], collectionIds: [],
  }], [])
  for (const view of ['memorization', 'review']) {
    await gotoApp(page, `?view=${view}&verse=read-aloud&mode=learn`)
    await page.getByTitle('Read aloud', { exact: true }).click()
    await expect(page.getByTitle('Stop reading', { exact: true })).toBeVisible()
    await page.getByTitle('Stop reading', { exact: true }).click()
    await expect(page.getByTitle('Read aloud', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Voice practice' })).toHaveCount(0)
    const calls = await page.evaluate(() => (window as typeof window & { __audioCalls: AudioCalls }).__audioCalls)
    expect(calls.spoken).toEqual(['John 1:1. One two three'])
    expect(calls.cancelled).toBeGreaterThanOrEqual(2)
    expect(calls.microphone).toBe(0)
  }
})
