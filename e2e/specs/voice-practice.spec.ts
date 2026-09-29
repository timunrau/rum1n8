import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { clearAppStorage, getStoredVerses, seedAppSettings, seedStorage } from '../helpers/storage'
import { gotoApp } from '../helpers/navigation'
import {
  disableVoiceCapability,
  installFakeSpeech,
  installFakeSpeechWithoutModel,
  type LocalSpeech,
} from '../helpers/local-speech'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const sampleVerses = JSON.parse(
  readFileSync(path.join(__dirname, '../fixtures/sample-verses.json'), 'utf-8')
)

const now = () => new Date().toISOString()

const verse = (overrides: Record<string, unknown>) => ({
  bibleVersion: 'BSB',
  createdAt: now(),
  lastModified: now(),
  reviewHistory: [],
  collectionIds: [],
  ...overrides,
})

const learnVerse = (overrides: Record<string, unknown> = {}) => verse({
  id: 'voice-learn',
  reference: 'John 1:1',
  content: 'One two three',
  memorizationStatus: 'unmemorized',
  reviewCount: 0,
  lastReviewed: null,
  nextReviewDate: null,
  easeFactor: 2.5,
  interval: 0,
  ...overrides,
})

const reviewVerse = (overrides: Record<string, unknown> = {}) => verse({
  id: 'voice-review',
  reference: 'Psalm 1:1',
  content: 'Alpha beta gamma',
  memorizationStatus: 'mastered',
  reviewCount: 1,
  // Yesterday, so the app counts this as a new review for the day.
  lastReviewed: new Date(Date.now() - 86400000).toISOString(),
  nextReviewDate: new Date(Date.now() - 86400000).toISOString(),
  easeFactor: 2.5,
  interval: 1,
  ...overrides,
})

const collections = [{
  id: 'c1',
  name: 'Test',
  description: '',
  createdAt: now(),
  lastModified: now(),
}]

const voiceButton = (page: Page) => page.getByRole('button', { name: 'Voice practice' })
const voicePanel = (page: Page) => page.getByTestId('voice-practice-panel')
const voiceStatus = (page: Page) => voicePanel(page).getByRole('status')

async function openLearnVerse(page: Page, target = learnVerse()) {
  await seedStorage(page, [target], collections)
  await page.reload()
  await gotoApp(page, '?view=collections')
  await page.getByText('All Verses').click()
  await page.getByText(target.reference).first().click()
  await expect(page.locator('#letter-input-memorize')).toBeAttached()
}

async function openReviewVerse(page: Page, target = reviewVerse()) {
  await seedStorage(page, [target], collections)
  await page.reload()
  await gotoApp(page, '?view=review-list')
  await page.getByText(target.reference).first().click()
  await expect(page.locator('#letter-input-review')).toBeAttached()
}

/** Select the microphone control and wait until the fake engine is decoding. */
async function startVoice(page: Page, speech: LocalSpeech) {
  const before = await speech.instances()
  await voiceButton(page).click()
  await expect(voiceStatus(page)).toHaveText('Recite from the highlighted position.')
  await expect.poll(() => speech.instances()).toBeGreaterThan(before)
  await expect.poll(() => speech.calls().then(calls => calls.started)).toBeGreaterThan(0)
  // The decoder can confirm before getUserMedia resolves, so wait for the
  // microphone itself rather than assuming it is already open.
  await expect.poll(() => speech.tracksLive()).toBe(1)
}

const wordText = async (page: Page, index: number) =>
  (await page.locator(`#practice-word-${index}`).innerText()).trim()

/** The memorization/review completion tray title, ignoring the voice panel heading. */
const completionTitle = (page: Page) =>
  page.locator('.completion-tray:not(.voice-panel) .completion-tray__title')

test.beforeEach(async ({ page }) => {
  await gotoApp(page)
  await clearAppStorage(page)
  await page.reload()
})

test.describe('voice practice availability', () => {
  test('hides the microphone control when the browser cannot run local recognition', async ({ page }) => {
    await disableVoiceCapability(page, 'audio-worklet')
    await openLearnVerse(page)

    await expect(voiceButton(page)).toHaveCount(0)
    await expect(voicePanel(page)).toHaveCount(0)
  })

  test('hides the microphone control when WebAssembly is unavailable', async ({ page }) => {
    await disableVoiceCapability(page, 'wasm')
    await openLearnVerse(page)

    await expect(voiceButton(page)).toHaveCount(0)
  })

  test('shows the microphone control when the browser can run local recognition', async ({ page }) => {
    await installFakeSpeech(page)
    await openLearnVerse(page)

    await expect(voiceButton(page)).toBeVisible()
    await expect(voiceButton(page)).toHaveAttribute('aria-pressed', 'false')
  })

  test('offers the model download instead of listening before the model is present', async ({ page }) => {
    const speech = await installFakeSpeechWithoutModel(page)
    await openLearnVerse(page)

    await voiceButton(page).click()

    // No silent 200 MB download, and no recognizer started behind the user's back.
    await expect(voicePanel(page).getByRole('button', { name: /Download model/ })).toBeVisible()
    await expect(voiceStatus(page)).toContainText('offline voice model')
    expect(await speech.instances()).toBe(0)
    await expect(voicePanel(page).getByRole('button', { name: 'Start' })).toHaveCount(0)
    // The keyboard stays available.
    await expect(voicePanel(page).getByText('Use keyboard instead')).toBeVisible()
  })
})

test.describe('voice practice capture', () => {
  test('selecting voice starts listening and partial speech only previews', async ({ page }) => {
    const speech = await installFakeSpeech(page)
    await openLearnVerse(page)

    await startVoice(page, speech)
    await expect(voiceButton(page)).toHaveAttribute('aria-pressed', 'true')

    await speech.speak('One two', { final: false })

    await expect(page.locator('#practice-word-0')).toHaveClass(/practice-word--voice-preview/)
    await expect(page.locator('#practice-word-1')).toHaveClass(/practice-word--voice-preview/)
    // Nothing advanced: the cursor is still on the first unit and no tray appeared.
    await expect(page.locator('#practice-word-0')).toHaveClass(/practice-word--current/)
    await expect(completionTitle(page)).toHaveCount(0)
    expect(await wordText(page, 0)).toBe('One')
  })

  test('a final segment advances the display units', async ({ page }) => {
    const speech = await installFakeSpeech(page)
    await openLearnVerse(page)

    await startVoice(page, speech)
    await speech.speak('One two three')

    await expect(completionTitle(page)).toContainText('Learned')
    expect(await wordText(page, 0)).toBe('One')
    expect(await wordText(page, 1)).toBe('two')
    expect(await wordText(page, 2)).toBe('three')
  })

  test('a revised partial advances only when it becomes final', async ({ page }) => {
    const speech = await installFakeSpeech(page)
    await openLearnVerse(page)

    await startVoice(page, speech)
    await speech.replace([['One too', false]])
    await expect(page.locator('#practice-word-0')).toHaveClass(/practice-word--current/)

    await speech.replace([['One two', false]])
    await expect(page.locator('#practice-word-1')).toHaveClass(/practice-word--voice-preview/)
    await expect(page.locator('#practice-word-0')).toHaveClass(/practice-word--current/)

    await speech.replace([['One two', true]])
    await expect(page.locator('#practice-word-2')).toHaveClass(/practice-word--current/)
    // Committing the same words twice must not double-count them.
    await speech.replace([['One two', true]])
    await expect(page.locator('#practice-word-2')).toHaveClass(/practice-word--current/)
    await expect(page.locator('#practice-word-1 .text-word-incorrect')).toHaveCount(0)
  })

  test('treats each decoded segment as separate speech across a long passage', async ({ page }) => {
    const speech = await installFakeSpeech(page)
    const words = 'alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima mike november oscar papa quebec romeo sierra tango'.split(' ')
    await openLearnVerse(page, learnVerse({ content: words.join(' ') }))

    await startVoice(page, speech)
    for (let count = 1; count <= 12; count++) {
      await speech.speak(words.slice(0, count).join(' '))
    }

    await expect(page.locator('#practice-word-12')).toHaveClass(/practice-word--current/)
    await expect(page.locator('.text-word-incorrect')).toHaveCount(0)
    await expect(completionTitle(page)).toHaveCount(0)

    await speech.speak(words.slice(12).join(' '))
    await expect(completionTitle(page)).toContainText('Learned')
    await expect(page.locator('.text-word-incorrect')).toHaveCount(0)
  })

  test('never marks a misheard word as a mistake', async ({ page }) => {
    const speech = await installFakeSpeech(page)
    await openLearnVerse(page)

    await startVoice(page, speech)
    // A substitution the recognizer made, not a memory failure.
    await speech.speak('One wrong three')

    await expect(completionTitle(page)).toContainText('Learned')
    await expect(page.locator('.text-word-incorrect')).toHaveCount(0)
    expect(await wordText(page, 1)).toBe('two')
  })

  test('finishes a spoken reference and completes the verse', async ({ page }) => {
    const speech = await installFakeSpeech(page)
    const target = learnVerse({ id: 'voice-reference', content: 'Alpha beta gamma', reference: 'John 1:1' })
    await seedAppSettings(page, { requireReferenceTyping: true })
    await openLearnVerse(page, target)

    await startVoice(page, speech)
    await expect(voiceStatus(page)).toHaveText('Recite from the highlighted position.')

    await speech.speak('Alpha beta gamma')

    await expect(voiceStatus(page)).toHaveText('Say the reference.')
    await expect(page.locator('#practice-word-3')).toHaveClass(/practice-word--current/)

    await speech.speak('John one one')

    await expect(page.getByRole('button', { name: /Continue to Memorize/i })).toBeVisible()
  })

  test('keeps a spoken reference split across segments', async ({ page }) => {
    const speech = await installFakeSpeech(page)
    await seedAppSettings(page, { requireReferenceTyping: true })
    await openLearnVerse(page, learnVerse({ content: 'Alpha beta gamma' }))

    await startVoice(page, speech)
    await speech.speak('Alpha beta gamma John')
    await expect(page.locator('#practice-word-3')).toHaveClass(/practice-word--current/)
    await expect(completionTitle(page)).toHaveCount(0)

    await speech.speak('one one')
    await expect(page.getByRole('button', { name: /Continue to Memorize/i })).toBeVisible()
    for (const index of [3, 4, 5]) {
      await expect(page.locator(`#practice-word-${index} .text-word-incorrect`)).toHaveCount(0)
    }
  })

  test('falls back to the keyboard for an unsupported reference', async ({ page }) => {
    const speech = await installFakeSpeech(page)
    const target = learnVerse({ id: 'voice-unsupported', content: 'Alpha beta', reference: 'Scroll 1:1' })
    await seedAppSettings(page, { requireReferenceTyping: true })
    await openLearnVerse(page, target)

    await startVoice(page, speech)
    await speech.speak('Alpha beta')
    await expect(page.locator('#practice-word-2')).toHaveClass(/practice-word--current/)

    await speech.speak('Scroll one one')

    await expect(voicePanel(page)).toHaveCount(0)
    await expect(voiceButton(page)).toHaveAttribute('aria-pressed', 'false')
    await expect(page.getByText('Use the keyboard for this reference. Your verse progress is preserved.')).toBeVisible()
    await expect(page.locator('#letter-input-memorize')).toBeAttached()
    // Completed units survive the fallback.
    expect(await wordText(page, 0)).toBe('Alpha')
    expect(await wordText(page, 1)).toBe('beta')
  })
})

test.describe('voice practice pausing and errors', () => {
  test('a decoded segment ending mid-verse does not pause capture', async ({ page }) => {
    const speech = await installFakeSpeech(page)
    await openLearnVerse(page)

    await startVoice(page, speech)
    await speech.speak('One')
    await expect(page.locator('#practice-word-1')).toHaveClass(/practice-word--current/)

    // A natural pause in the middle of a verse: the recognizer closed a segment.
    await speech.speak('two three')

    // Still listening, still capturing, and the verse completed from the later words.
    await expect(completionTitle(page)).toContainText('Learned')
    expect(await speech.tracksLive()).toBe(0)
  })

  test('Pause stops the microphone and Resume reopens it', async ({ page }) => {
    const speech = await installFakeSpeech(page)
    await openLearnVerse(page)

    await startVoice(page, speech)
    expect(await speech.tracksLive()).toBe(1)

    await voicePanel(page).getByRole('button', { name: 'Pause' }).click()
    await expect(voiceStatus(page)).toHaveText('Paused. Tap Resume to continue.')
    // The track is released synchronously with the tap, not after a decode flush.
    expect(await speech.tracksLive()).toBe(0)
    expect(await speech.tracksReleased()).toBeGreaterThanOrEqual(1)

    await voicePanel(page).getByRole('button', { name: 'Resume' }).click()
    await expect(voiceStatus(page)).toHaveText('Recite from the highlighted position.')
    expect(await speech.tracksLive()).toBe(1)
  })

  test('reports a denied microphone and offers a retry', async ({ page }) => {
    await installFakeSpeech(page, { micDenied: true })
    await openLearnVerse(page)

    await voiceButton(page).click()

    await expect(voiceStatus(page)).toContainText('Microphone permission was denied.')
    await expect(voicePanel(page).getByRole('button', { name: 'Retry' })).toBeVisible()
  })

  test('a silent microphone never claims the verse was wrong', async ({ page }) => {
    const speech = await installFakeSpeech(page)
    await openLearnVerse(page)

    await startVoice(page, speech)
    // Silence produces no transcript at all.

    await expect(voiceStatus(page)).toHaveText('Recite from the highlighted position.')
    await expect(page.locator('#practice-word-0')).toHaveClass(/practice-word--current/)
    await expect(page.locator('.text-word-incorrect')).toHaveCount(0)
    await expect(completionTitle(page)).toHaveCount(0)
  })

  test('ignores a segment that arrives after switching to the keyboard', async ({ page }) => {
    const speech = await installFakeSpeech(page)
    await openLearnVerse(page)

    await startVoice(page, speech)
    await voiceButton(page).click()
    await expect(voiceButton(page)).toHaveAttribute('aria-pressed', 'false')

    await speech.speak('One two three')

    // The stale callback is dropped, so the verse is untouched and no tray appears.
    await expect(page.locator('#practice-word-0')).toHaveClass(/practice-word--current/)
    await expect(completionTitle(page)).toHaveCount(0)
  })

  test('keeps completed units when the input mode changes', async ({ page }) => {
    const speech = await installFakeSpeech(page)
    await openLearnVerse(page)

    await startVoice(page, speech)
    await speech.speak('One two')
    await expect(page.locator('#practice-word-2')).toHaveClass(/practice-word--current/)

    await voiceButton(page).click()

    expect(await wordText(page, 0)).toBe('One')
    expect(await wordText(page, 1)).toBe('two')
    await expect(page.locator('#practice-word-2')).toHaveClass(/practice-word--current/)
    // Switching away releases the microphone.
    expect(await speech.tracksLive()).toBe(0)
  })
})

test.describe('voice practice completion and saving', () => {
  test('does not change a review or its schedule before the completed voice attempt is confirmed', async ({ page }) => {
    const speech = await installFakeSpeech(page)
    await openReviewVerse(page)
    const [before] = await getStoredVerses(page) as Array<{
      reviewCount: number; lastReviewed: string; nextReviewDate: string; interval: number
    }>

    await startVoice(page, speech)
    await speech.speak('Alpha beta gamma')
    await expect(page.getByRole('button', { name: 'Done' })).toBeVisible()

    const [pending] = await getStoredVerses(page) as typeof before[]
    expect(pending.reviewCount).toBe(before.reviewCount)
    expect(pending.lastReviewed).toBe(before.lastReviewed)
    expect(pending.nextReviewDate).toBe(before.nextReviewDate)
    expect(pending.interval).toBe(before.interval)

    await page.getByRole('button', { name: 'Done' }).click()
    await expect.poll(async () => {
      const [saved] = await getStoredVerses(page) as typeof before[]
      return saved.reviewCount
    }).toBe(before.reviewCount + 1)
  })

  test('Retry discards the unsaved voice attempt and listens again', async ({ page }) => {
    const speech = await installFakeSpeech(page)
    await openLearnVerse(page)

    await startVoice(page, speech)
    await speech.speak('One two three')
    await expect(page.getByRole('button', { name: 'Continue to Memorize' })).toBeVisible()

    const started = (await speech.calls()).started
    await page.getByRole('button', { name: 'Retry' }).click()

    await expect(page.locator('#practice-word-0')).toHaveClass(/practice-word--current/)
    await expect.poll(() => speech.calls().then(calls => calls.started)).toBeGreaterThan(started)

    await speech.speak('One two three')
    await page.getByRole('button', { name: 'Continue to Memorize' }).click()

    const [saved] = await getStoredVerses(page) as Array<{ memorizationStatus: string }>
    expect(saved.memorizationStatus).toBe('learned')
  })

  test('Continue to Memorize saves the attempt and keeps listening', async ({ page }) => {
    const speech = await installFakeSpeech(page)
    await openLearnVerse(page)

    await startVoice(page, speech)
    await speech.speak('One two three')
    await page.getByRole('button', { name: 'Continue to Memorize' }).click()

    await expect(page.locator('.mode-chip[aria-current="step"]')).toContainText('Memorize')
    await expect.poll(() => speech.calls().then(calls => calls.started)).toBeGreaterThan(1)

    const [saved] = await getStoredVerses(page) as Array<{ memorizationStatus: string }>
    expect(saved.memorizationStatus).toBe('learned')
  })

  test('Next Verse saves the review and starts listening on the next verse', async ({ page }) => {
    const speech = await installFakeSpeech(page)
    const first = reviewVerse({ id: 'voice-review-1', reference: 'Psalm 1:1', content: 'Alpha beta' })
    const second = reviewVerse({ id: 'voice-review-2', reference: 'Psalm 1:2', content: 'Gamma delta' })
    await seedStorage(page, [first, second], collections)
    await page.reload()
    await gotoApp(page, '?view=review-list')
    await page.getByText('Psalm 1:1').first().click()
    await expect(page.locator('#letter-input-review')).toBeAttached()

    await startVoice(page, speech)
    await speech.speak('Alpha beta')
    await page.getByRole('button', { name: 'Next Verse' }).click()

    await expect(page.locator('h1')).toContainText('Psalm 1:2')
    await expect.poll(() => speech.calls().then(calls => calls.started)).toBeGreaterThan(1)

    await expect.poll(async () => {
      const stored = await getStoredVerses(page) as Array<{ id: string; reviewCount: number }>
      return stored.find(entry => entry.id === 'voice-review-1')?.reviewCount
    }).toBe(2)

    const saved = await getStoredVerses(page) as Array<{ id: string; reviewCount: number; lastReviewed: string | null }>
    expect(saved.find(entry => entry.id === 'voice-review-1')?.lastReviewed).not.toBeNull()
    expect(saved.find(entry => entry.id === 'voice-review-2')?.reviewCount).toBe(1)
  })

  test('holds both passage segment reviews until the voice result is confirmed', async ({ page }) => {
    const speech = await installFakeSpeech(page)
    const first = reviewVerse({ id: 'voice-passage-1', reference: 'John 3:16', content: 'Alpha beta', collectionIds: ['c1'] })
    const second = reviewVerse({ id: 'voice-passage-2', reference: 'John 3:17', content: 'Gamma delta', collectionIds: ['c1'] })
    await seedStorage(page, [first, second], collections)
    await page.reload()
    await gotoApp(page, '?view=collection&collection=c1')
    await page.getByText('John 3:16').first().click()
    await expect(page.getByTestId('modal-passage-review-offer')).toBeVisible()
    await page.getByTestId('passage-review-start').click()

    await startVoice(page, speech)
    await speech.speak('Alpha beta Gamma delta')
    await expect(page.getByRole('button', { name: 'Done' })).toBeVisible()

    const pending = await getStoredVerses(page) as Array<{ reviewCount: number }>
    expect(pending.map(entry => entry.reviewCount)).toEqual([1, 1])

    await page.getByRole('button', { name: 'Done' }).click()
    await expect.poll(async () => {
      const saved = await getStoredVerses(page) as Array<{ reviewCount: number }>
      return saved.map(entry => entry.reviewCount)
    }).toEqual([2, 2])
  })

  test('Reveal is the only source of a voice mistake, and it can still save a low grade', async ({ page }) => {
    const speech = await installFakeSpeech(page)
    await openReviewVerse(page)

    await startVoice(page, speech)
    await voicePanel(page).getByRole('button', { name: 'Reveal next word' }).click()
    await expect(page.locator('#practice-word-0 .text-word-incorrect').first()).toHaveText('Alpha')
    // Revealing interrupts the session, so the microphone is released until the
    // user resumes.
    await expect(voiceStatus(page)).toHaveText('Paused. Tap Resume to continue.')
    expect(await speech.tracksLive()).toBe(0)

    await voicePanel(page).getByRole('button', { name: 'Resume' }).click()
    await expect.poll(() => speech.tracksLive()).toBe(1)

    await speech.speak('beta gamma')
    await expect(completionTitle(page)).toContainText('Keep practicing')
    await page.getByRole('button', { name: 'Done' }).click()

    await expect.poll(async () => {
      const stored = await getStoredVerses(page) as Array<{ reviewCount: number }>
      return stored[0].reviewCount
    }).toBe(2)
  })

  test('offers Discard and Stay when leaving a completed unsaved voice result', async ({ page }) => {
    const speech = await installFakeSpeech(page)
    await openReviewVerse(page)

    await startVoice(page, speech)
    await speech.speak('Alpha beta gamma')
    await expect(page.getByRole('button', { name: 'Done' })).toBeVisible()

    await page.locator('.practice-session-header button').first().click()

    await expect(page.getByText('Unsaved result')).toBeVisible()
    await page.getByRole('button', { name: 'Stay' }).click()
    await expect(page.getByText('Unsaved result')).toBeHidden()

    const [unchanged] = await getStoredVerses(page) as Array<{ reviewCount: number }>
    expect(unchanged.reviewCount).toBe(1)

    await page.locator('.practice-session-header button').first().click()
    await page.getByRole('button', { name: 'Discard result' }).click()

    const [discarded] = await getStoredVerses(page) as Array<{ reviewCount: number; lastReviewed: string | null }>
    expect(discarded.reviewCount).toBe(1)
  })

  test('replacing a saved voice attempt keeps the first grade', async ({ page }) => {
    const speech = await installFakeSpeech(page)
    await openLearnVerse(page)

    await startVoice(page, speech)
    await speech.speak('One two three')
    await page.getByRole('button', { name: 'Continue to Memorize' }).click()
    await expect(page.locator('.mode-chip[aria-current="step"]')).toContainText('Memorize')

    const [afterMemorize] = await getStoredVerses(page) as Array<{ memorizationStatus: string }>
    expect(afterMemorize.memorizationStatus).toBe('learned')

    await speech.speak('One two three')
    await page.getByRole('button', { name: 'Continue to Master' }).click()
    await expect(page.locator('.mode-chip[aria-current="step"]')).toContainText('Master')

    const [afterMaster] = await getStoredVerses(page) as Array<{ memorizationStatus: string }>
    expect(afterMaster.memorizationStatus).toBe('memorized')

    await speech.speak('One two three')
    await page.getByRole('button', { name: 'Done' }).click()

    // The grade from the first attempt is kept; later voice attempts never downgrade it.
    const [saved] = await getStoredVerses(page) as Array<{ memorizationStatus: string; masteredAt?: string }>
    expect(saved.memorizationStatus).toBe('mastered')
    expect(saved.masteredAt).toBeTruthy()
  })
})
