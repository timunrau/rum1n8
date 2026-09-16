import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const marketingDir = path.join(projectRoot, 'public', 'marketing')
const mobileViewport = { width: 378, height: 672 }
const mobileDeviceScaleFactor = 1080 / 378

const productName = 'Ruminate'
const title = 'Bible Memory App'
const description = 'A simple Bible memory app that gives you control of your data.'
const now = '2026-04-12T12:00:00.000Z'
const yesterday = '2026-04-11T12:00:00.000Z'
const tomorrow = '2026-04-13T12:00:00.000Z'
const twoDaysOut = '2026-04-14T12:00:00.000Z'
const threeDaysOut = '2026-04-15T12:00:00.000Z'
const iosSafariUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'

const baseVerses = {
  joshua: {
    id: 'joshua-1-8',
    reference: 'Joshua 1:8',
    content: 'This Book of the Law must not depart from your mouth; meditate on it day and night, so that you may be careful to do everything written in it. For then you will prosper and succeed in all you do.',
  },
  psalm: {
    id: 'psalm-119-11',
    reference: 'Psalm 119:11',
    content: 'I have hidden Your word in my heart that I might not sin against You.',
  },
  romans: {
    id: 'romans-12-2',
    reference: 'Romans 12:2',
    content: 'Do not be conformed to this world, but be transformed by the renewing of your mind. Then you will be able to test and approve what is the good, pleasing, and perfect will of God.',
  },
  john: {
    id: 'john-3-16',
    reference: 'John 3:16',
    content: 'For God so loved the world that He gave His one and only Son, that everyone who believes in Him shall not perish but have eternal life.',
  },
}

const firstRunVerse = {
  reference: 'John 1:1',
  bibleVersion: 'BSB',
  content: 'In the beginning was the Word, and the Word was with God, and the Word was God.',
}

function buildVerse(baseVerse, overrides = {}) {
  return {
    ...baseVerse,
    bibleVersion: 'BSB',
    createdAt: now,
    lastModified: now,
    memorizationStatus: 'unmemorized',
    reviewCount: 0,
    lastReviewed: null,
    nextReviewDate: null,
    easeFactor: 2.5,
    interval: 0,
    reviewHistory: [],
    collectionIds: [],
    ...overrides,
  }
}

const versesScreenVerses = [
  buildVerse(baseVerses.joshua, {
    memorizationStatus: 'unmemorized',
  }),
  buildVerse(baseVerses.psalm, {
    memorizationStatus: 'learned',
    reviewCount: 1,
    lastReviewed: yesterday,
  }),
  buildVerse(baseVerses.romans, {
    memorizationStatus: 'memorized',
    reviewCount: 2,
    lastReviewed: yesterday,
  }),
  buildVerse(baseVerses.john, {
    memorizationStatus: 'mastered',
    reviewCount: 4,
    lastReviewed: yesterday,
    nextReviewDate: tomorrow,
    interval: 3,
  }),
]

const practiceVerses = [
  buildVerse(baseVerses.joshua, {
    memorizationStatus: 'unmemorized',
  }),
  buildVerse(baseVerses.psalm, {
    memorizationStatus: 'mastered',
    reviewCount: 6,
    lastReviewed: yesterday,
    nextReviewDate: tomorrow,
    interval: 7,
  }),
  buildVerse(baseVerses.romans, {
    memorizationStatus: 'mastered',
    reviewCount: 8,
    lastReviewed: yesterday,
    nextReviewDate: twoDaysOut,
    interval: 10,
  }),
  buildVerse(baseVerses.john, {
    memorizationStatus: 'mastered',
    reviewCount: 4,
    lastReviewed: yesterday,
    nextReviewDate: threeDaysOut,
    interval: 4,
  }),
]

const addVerseCollections = [
  { id: 'col-renewed-mind', name: 'Renewed Mind', description: '', createdAt: now, lastModified: now },
  { id: 'col-the-gospel', name: 'The Gospel', description: '', createdAt: now, lastModified: now },
  { id: 'col-holy-spirit', name: 'Holy Spirit', description: '', createdAt: now, lastModified: now },
]

const memorizeVerses = [
  buildVerse(baseVerses.joshua, {
    memorizationStatus: 'learned',
    reviewCount: 1,
    lastReviewed: yesterday,
  }),
]

const reviewVerses = [
  buildVerse(baseVerses.joshua, {
    memorizationStatus: 'mastered',
    reviewCount: 5,
    lastReviewed: yesterday,
    nextReviewDate: yesterday,
    interval: 7,
  }),
  buildVerse(baseVerses.psalm, {
    memorizationStatus: 'mastered',
    reviewCount: 6,
    lastReviewed: yesterday,
    nextReviewDate: tomorrow,
    interval: 8,
  }),
  buildVerse(baseVerses.romans, {
    memorizationStatus: 'mastered',
    reviewCount: 7,
    lastReviewed: yesterday,
    nextReviewDate: twoDaysOut,
    interval: 10,
  }),
  buildVerse(baseVerses.john, {
    memorizationStatus: 'mastered',
    reviewCount: 8,
    lastReviewed: yesterday,
    nextReviewDate: threeDaysOut,
    interval: 12,
  }),
]

function captureDate(dayOffset = 0) {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() + dayOffset)
  return date.toISOString()
}

function buildReviewHistory(dayOffsets) {
  return dayOffsets.map((dayOffset) => ({
    date: captureDate(dayOffset),
    grade: 5,
    accuracy: 1,
    mistakes: 0,
  }))
}

const statsVerses = [
  buildVerse(baseVerses.joshua, {
    memorizationStatus: 'mastered',
    masteredAt: captureDate(-8),
    reviewCount: 3,
    lastReviewed: captureDate(0),
    nextReviewDate: captureDate(0),
    interval: 7,
    reviewHistory: buildReviewHistory([-6, -3, 0]),
  }),
  buildVerse(baseVerses.psalm, {
    memorizationStatus: 'mastered',
    masteredAt: captureDate(-5),
    reviewCount: 3,
    lastReviewed: captureDate(-1),
    nextReviewDate: captureDate(2),
    interval: 8,
    reviewHistory: buildReviewHistory([-5, -2, -1]),
  }),
  buildVerse(baseVerses.romans, {
    memorizationStatus: 'mastered',
    masteredAt: captureDate(-3),
    reviewCount: 2,
    lastReviewed: captureDate(-2),
    nextReviewDate: captureDate(5),
    interval: 10,
    reviewHistory: buildReviewHistory([-4, -2]),
  }),
  buildVerse(baseVerses.john, {
    memorizationStatus: 'mastered',
    masteredAt: captureDate(-1),
    reviewCount: 2,
    lastReviewed: captureDate(0),
    nextReviewDate: captureDate(8),
    interval: 12,
    reviewHistory: buildReviewHistory([-1, 0]),
  }),
]

function buildStorageState({ verses: verseState = [], collections: collectionState = [] } = {}) {
  return {
    'rum1n8-verses': JSON.stringify(verseState),
    'rum1n8-collections': JSON.stringify(collectionState),
  }
}

function buildOnboardingCompleteStorageState({ verses = [], collections = [] } = {}) {
  return {
    ...buildStorageState({ verses, collections }),
    'rum1n8-ui-state': JSON.stringify({
      onboardingDismissed: true,
      guidedOnboardingStep: 'done',
      guidedOnboardingVerseId: null,
      practiceModeHintsSeen: { learn: true, memorize: true, master: true },
    }),
  }
}

async function createMobilePage(browser, storageState, colorScheme = 'light', options = {}) {
  const {
    standalone = false,
    ...contextOptions
  } = options
  const context = await browser.newContext({
    viewport: mobileViewport,
    deviceScaleFactor: mobileDeviceScaleFactor,
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'reduce',
    ...contextOptions,
  })

  const page = await context.newPage()
  await page.emulateMedia({ colorScheme })
  await page.addInitScript(({ entries, standaloneApp }) => {
    localStorage.clear()
    Object.entries(entries).forEach(([key, value]) => {
      localStorage.setItem(key, value)
    })

    if (standaloneApp) {
      Object.defineProperty(window.navigator, 'standalone', {
        configurable: true,
        value: true,
      })
    }
  }, { entries: storageState, standaloneApp: standalone })

  return { context, page }
}

async function capturePageScreenshot(page, outputPath) {
  // Keep captures from inheriting an incidental hover/pressed state from the
  // interaction that opened the current screen.
  await page.mouse.move(1, 1)
  await page.evaluate(async () => {
    await document.fonts.ready
    await Promise.all(
      Array.from(document.images, (image) => {
        if (image.complete) return Promise.resolve()
        return new Promise((resolve) => {
          image.addEventListener('load', resolve, { once: true })
          image.addEventListener('error', resolve, { once: true })
        })
      })
    )
    await new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    })
  })
  await page.screenshot({
    path: outputPath,
    animations: 'disabled',
  })
}

async function captureFirstRunScreenshot(page, step, name, colorScheme) {
  const suffix = colorScheme === 'dark' ? '-dark' : ''
  await capturePageScreenshot(
    page,
    path.join(marketingDir, `screenshot-first-run-${step}-${name}${suffix}.png`)
  )
}

async function completeFirstRunPracticeStage(page) {
  await completePracticeStage(page, '#letter-input-memorize', firstRunVerse.content)
}

function getFirstLetters(content) {
  return content
    .split(/\s+/)
    .map((word) => word.match(/[A-Za-z]/)?.[0] || '')
    .join('')
    .toLowerCase()
}

async function completePracticeStage(page, inputSelector, content, mistakeCount = 0) {
  const firstLetters = getFirstLetters(content)
  const input = page.locator(inputSelector)

  await input.waitFor({ state: 'attached' })
  await input.focus()

  for (const [index, letter] of Array.from(firstLetters).entries()) {
    const enteredLetter = index < mistakeCount
      ? (letter === 'x' ? 'z' : 'x')
      : letter
    await page.keyboard.type(enteredLetter, { delay: 20 })
    await page.waitForFunction(
      (selector) => document.querySelector(selector)?.value === '',
      inputSelector
    )
  }
}

async function captureCompletionScreenshot(page, step, name, colorScheme) {
  const suffix = colorScheme === 'dark' ? '-dark' : ''
  await capturePageScreenshot(
    page,
    path.join(marketingDir, `screenshot-completion-${step}-${name}${suffix}.png`)
  )
}

function buildCompletionVerse(id, memorizationStatus = 'unmemorized', overrides = {}) {
  return buildVerse({
    id,
    ...firstRunVerse,
  }, {
    memorizationStatus,
    ...overrides,
  })
}

async function captureMemorizationCompletionVariant(
  browser,
  baseUrl,
  colorScheme,
  { step, name, memorizationStatus, title, primaryAction, mistakeCount = 0 }
) {
  const verse = buildCompletionVerse(`completion-${name}`, memorizationStatus)
  const { context, page } = await createMobilePage(
    browser,
    buildOnboardingCompleteStorageState({ verses: [verse] }),
    colorScheme
  )

  try {
    await page.goto(`${baseUrl}/?view=collections`, { waitUntil: 'domcontentloaded' })
    await page.getByText(firstRunVerse.reference).first().click()
    await completePracticeStage(page, '#letter-input-memorize', firstRunVerse.content, mistakeCount)
    await page.getByText(title, { exact: true }).waitFor()
    await page.getByRole('button', { name: primaryAction, exact: true }).waitFor()
    await captureCompletionScreenshot(page, step, name, colorScheme)
  } finally {
    await context.close()
  }
}

async function captureReviewCompletionVariant(
  browser,
  baseUrl,
  colorScheme,
  { step, name, mode = 'master', title, primaryAction, mistakeCount = 0 }
) {
  const firstVerse = buildCompletionVerse(`completion-${name}-first`, 'mastered', {
    reviewCount: 5,
    lastReviewed: yesterday,
    nextReviewDate: yesterday,
    interval: 7,
  })
  const verses = [firstVerse]

  if (primaryAction === 'Next Verse') {
    verses.push(buildVerse(baseVerses.psalm, {
      id: `completion-${name}-next`,
      memorizationStatus: 'mastered',
      reviewCount: 6,
      lastReviewed: yesterday,
      nextReviewDate: tomorrow,
      interval: 8,
    }))
  }

  const { context, page } = await createMobilePage(
    browser,
    buildOnboardingCompleteStorageState({ verses }),
    colorScheme
  )

  try {
    await page.goto(`${baseUrl}/?view=review-list`, { waitUntil: 'domcontentloaded' })
    await page.getByText(firstRunVerse.reference).first().click()
    await page.locator('#letter-input-review').waitFor({ state: 'attached' })

    if (mode !== 'master') {
      const modeLabel = mode === 'learn' ? 'Learn' : 'Memorize'
      await page
        .locator('.practice-swipe-panel--active .mode-chip__label', { hasText: modeLabel })
        .evaluate((element) => element.closest('.mode-chip')?.click())
      await page.locator('#letter-input-review').waitFor({ state: 'attached' })
    }

    await completePracticeStage(page, '#letter-input-review', firstRunVerse.content, mistakeCount)
    await page.getByText(title, { exact: true }).waitFor()
    await page.getByRole('button', { name: primaryAction, exact: true }).waitFor()
    await captureCompletionScreenshot(page, step, name, colorScheme)
  } finally {
    await context.close()
  }
}

async function captureCompletionStates(browser, baseUrl, colorScheme = 'light') {
  const memorizationVariants = [
    {
      step: '01',
      name: 'learned',
      memorizationStatus: 'unmemorized',
      title: 'Learned',
      primaryAction: 'Continue to Memorize',
    },
    {
      step: '02',
      name: 'memorized',
      memorizationStatus: 'learned',
      title: 'Memorized',
      primaryAction: 'Continue to Master',
    },
    {
      step: '03',
      name: 'mastered',
      memorizationStatus: 'memorized',
      title: 'Mastered',
      primaryAction: 'Done',
    },
    {
      step: '04',
      name: 'memorization-retry',
      memorizationStatus: 'unmemorized',
      title: 'Keep practicing',
      primaryAction: 'Try Again',
      mistakeCount: 2,
    },
  ]

  for (const variant of memorizationVariants) {
    await captureMemorizationCompletionVariant(browser, baseUrl, colorScheme, variant)
  }

  const reviewVariants = [
    {
      step: '05',
      name: 'reviewed-next',
      title: 'Reviewed',
      primaryAction: 'Next Verse',
    },
    {
      step: '06',
      name: 'reviewed-done',
      title: 'Reviewed',
      primaryAction: 'Done',
    },
    {
      step: '07',
      name: 'practice-complete-next',
      mode: 'learn',
      title: 'Practice complete',
      primaryAction: 'Next Verse',
    },
    {
      step: '08',
      name: 'practice-complete-done',
      mode: 'memorize',
      title: 'Practice complete',
      primaryAction: 'Done',
    },
    {
      step: '09',
      name: 'review-retry',
      title: 'Keep practicing',
      primaryAction: 'Try Again',
      mistakeCount: 2,
    },
  ]

  for (const variant of reviewVariants) {
    await captureReviewCompletionVariant(browser, baseUrl, colorScheme, variant)
  }
}

async function showKeyboardOverlay(page, colorScheme = 'light') {
  const isDark = colorScheme === 'dark'
  await page.addStyleTag({
    content: `
      .marketing-keyboard-viewport {
        height: auto !important;
      }

      .marketing-keyboard {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        height: 211px;
        z-index: 9999;
        padding: 8px 6px 10px;
        background: ${isDark ? 'linear-gradient(180deg, #2c2c2e 0%, #1c1c1e 100%)' : 'linear-gradient(180deg, #d8dbe2 0%, #c7ccd6 100%)'};
        border-top: 1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.12)'};
        box-shadow: 0 -12px 24px ${isDark ? 'rgba(0, 0, 0, 0.4)' : 'rgba(15, 23, 42, 0.12)'};
      }

      .marketing-keyboard-row {
        display: flex;
        gap: 6px;
        justify-content: center;
        margin-top: 6px;
      }

      .marketing-key {
        min-width: 29px;
        height: 42px;
        border-radius: 8px;
        background: ${isDark ? 'linear-gradient(180deg, #4a4a4e 0%, #3a3a3c 100%)' : 'linear-gradient(180deg, #ffffff 0%, #f4f6fa 100%)'};
        box-shadow:
          inset 0 -1px 0 ${isDark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(15, 23, 42, 0.08)'},
          0 1px 0 ${isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.8)'};
        color: ${isDark ? '#ffffff' : '#111827'};
        display: flex;
        align-items: center;
        justify-content: center;
        font: 500 15px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }

      .marketing-key.wide {
        min-width: 48px;
      }

      .marketing-key.space {
        min-width: 164px;
      }

      .marketing-key.utility {
        background: ${isDark ? 'linear-gradient(180deg, #2c2c2e 0%, #1c1c1e 100%)' : 'linear-gradient(180deg, #b7bec9 0%, #a8b1bf 100%)'};
      }
    `,
  })

  await page.evaluate(() => {
    document.body.classList.add('marketing-keyboard-open')
    document.querySelector('.marketing-keyboard')?.remove()

    const keyboard = document.createElement('div')
    keyboard.className = 'marketing-keyboard'
    keyboard.innerHTML = `
      <div class="marketing-keyboard-row">
        <div class="marketing-key">Q</div><div class="marketing-key">W</div><div class="marketing-key">E</div><div class="marketing-key">R</div><div class="marketing-key">T</div><div class="marketing-key">Y</div><div class="marketing-key">U</div><div class="marketing-key">I</div><div class="marketing-key">O</div><div class="marketing-key">P</div>
      </div>
      <div class="marketing-keyboard-row">
        <div class="marketing-key">A</div><div class="marketing-key">S</div><div class="marketing-key">D</div><div class="marketing-key">F</div><div class="marketing-key">G</div><div class="marketing-key">H</div><div class="marketing-key">J</div><div class="marketing-key">K</div><div class="marketing-key">L</div>
      </div>
      <div class="marketing-keyboard-row">
        <div class="marketing-key utility wide">shift</div><div class="marketing-key">Z</div><div class="marketing-key">X</div><div class="marketing-key">C</div><div class="marketing-key">V</div><div class="marketing-key">B</div><div class="marketing-key">N</div><div class="marketing-key">M</div><div class="marketing-key utility wide">del</div>
      </div>
      <div class="marketing-keyboard-row">
        <div class="marketing-key utility wide">123</div><div class="marketing-key utility wide">emoji</div><div class="marketing-key space"></div><div class="marketing-key utility wide">return</div>
      </div>
    `
    document.body.appendChild(keyboard)

    const practiceViewport = document.querySelector('#letter-input-memorize')
      ?.closest('.fixed.inset-0')
    if (!practiceViewport) {
      throw new Error('Unable to locate the live practice viewport for keyboard capture')
    }

    const keyboardHeight = keyboard.getBoundingClientRect().height
    if (keyboardHeight <= 0) {
      throw new Error('The generated keyboard did not produce a measurable viewport height')
    }

    practiceViewport.classList.add('marketing-keyboard-viewport')
    practiceViewport.style.setProperty('bottom', `${keyboardHeight}px`, 'important')
  })
}

async function hideKeyboardOverlay(page) {
  await page.evaluate(() => {
    document.body.classList.remove('marketing-keyboard-open')
    const practiceViewport = document.querySelector('.marketing-keyboard-viewport')
    practiceViewport?.classList.remove('marketing-keyboard-viewport')
    practiceViewport?.style.removeProperty('bottom')
    document.querySelector('.marketing-keyboard')?.remove()
  })
}

async function orderReferenceCards(page, orderedReferences) {
  await page.evaluate((references) => {
    const findCard = (reference) => {
      const heading = Array.from(document.querySelectorAll('h3')).find(
        (element) => element.textContent?.trim() === reference
      )

      if (!heading) return null

      let node = heading.parentElement
      while (node && node.parentElement) {
        const siblingCards = Array.from(node.parentElement.children).filter((child) => {
          return child instanceof HTMLElement && child.querySelector('h3')
        })

        if (siblingCards.length > 1 && siblingCards.includes(node)) {
          return node
        }

        node = node.parentElement
      }

      return null
    }

    const cards = references.map(findCard).filter(Boolean)
    if (cards.length < 2) return

    const container = cards[0].parentElement
    cards.forEach((card) => container.appendChild(card))
  }, orderedReferences)
}

async function captureVersesState(browser, baseUrl, colorScheme = 'light') {
  const { context, page } = await createMobilePage(browser, buildStorageState({
    verses: versesScreenVerses,
  }), colorScheme)

  const suffix = colorScheme === 'dark' ? '-dark' : ''
  try {
    await page.goto(`${baseUrl}/?view=collections`, { waitUntil: 'domcontentloaded' })
    await page.getByText('Joshua 1:8').waitFor()
    await orderReferenceCards(page, ['Joshua 1:8', 'Psalm 119:11', 'Romans 12:2', 'John 3:16'])
    await capturePageScreenshot(page, path.join(marketingDir, `screenshot-empty${suffix}.png`))
  } finally {
    await context.close()
  }
}

async function capturePracticeState(browser, baseUrl, colorScheme = 'light') {
  const { context, page } = await createMobilePage(browser, buildStorageState({
    verses: practiceVerses,
  }), colorScheme)

  const suffix = colorScheme === 'dark' ? '-dark' : ''
  try {
    await page.goto(`${baseUrl}/?view=collections`, { waitUntil: 'domcontentloaded' })
    await page.getByText('Joshua 1:8').first().click()
    await page.locator('#letter-input-memorize').waitFor({ state: 'attached' })
    await page.locator('#letter-input-memorize').focus()
    await page.keyboard.type('tbotlmndfymmoidan', { delay: 40 })
    await showKeyboardOverlay(page, colorScheme)
    await capturePageScreenshot(page, path.join(marketingDir, `screenshot-practice${suffix}.png`))
  } finally {
    await context.close()
  }
}

async function captureReviewState(browser, baseUrl, colorScheme = 'light') {
  const { context, page } = await createMobilePage(browser, buildStorageState({
    verses: reviewVerses,
  }), colorScheme)

  const suffix = colorScheme === 'dark' ? '-dark' : ''
  try {
    await page.goto(`${baseUrl}/?view=review-list`, { waitUntil: 'domcontentloaded' })
    await page.getByText('Joshua 1:8').waitFor()
    await orderReferenceCards(page, ['Joshua 1:8', 'Psalm 119:11', 'Romans 12:2', 'John 3:16'])
    await capturePageScreenshot(page, path.join(marketingDir, `screenshot-review${suffix}.png`))
  } finally {
    await context.close()
  }
}

async function captureAddVerseState(browser, baseUrl, colorScheme = 'light') {
  const { context, page } = await createMobilePage(browser, {
    ...buildStorageState({ collections: addVerseCollections }),
    'rum1n8-app-settings': JSON.stringify({
      appSettings: { defaultBibleVersion: 'BSB' },
      appSettingsLastModified: now,
    }),
  }, colorScheme)

  const suffix = colorScheme === 'dark' ? '-dark' : ''
  try {
    await page.goto(`${baseUrl}/?view=collections`, { waitUntil: 'domcontentloaded' })
    await page.getByTestId('fab-trigger').waitFor()
    await page.getByTestId('fab-trigger').click()
    await page.getByTestId('fab-new-verse').click()
    await page.getByTestId('modal-add-verse').waitFor()
    await page.fill('#reference', baseVerses.joshua.reference)
    await page.fill('#bible-version', 'BSB')
    await page.fill('#content', baseVerses.joshua.content)
    await page.getByRole('button', { name: 'Renewed Mind' }).click()
    await page
      .getByTestId('modal-add-verse')
      .locator('.overflow-y-auto')
      .evaluate((scrollContainer) => scrollContainer.scrollTo({ top: 0, behavior: 'instant' }))
    await capturePageScreenshot(page, path.join(marketingDir, `screenshot-add-verse${suffix}.png`))
  } finally {
    await context.close()
  }
}

async function captureMemorizeState(browser, baseUrl, colorScheme = 'light') {
  const { context, page } = await createMobilePage(browser, buildStorageState({
    verses: memorizeVerses,
  }), colorScheme)

  const suffix = colorScheme === 'dark' ? '-dark' : ''
  try {
    await page.goto(`${baseUrl}/?view=collections`, { waitUntil: 'domcontentloaded' })
    await page.getByText('Joshua 1:8').first().click()
    await page.locator('#letter-input-memorize').waitFor({ state: 'attached' })
    await page.locator('#letter-input-memorize').focus()
    // In memorize mode, all words (visible and hidden) are typed in order.
    // "This Book of the Law must not depart from your mouth; meditate on it day and night"
    // → t b o t l m n d f y m  m  o  i  d  a  n
    await page.keyboard.type('tbotlmndfymmoidan', { delay: 40 })
    await showKeyboardOverlay(page, colorScheme)
    await capturePageScreenshot(page, path.join(marketingDir, `screenshot-memorize${suffix}.png`))
  } finally {
    await context.close()
  }
}

async function captureSyncState(browser, baseUrl, colorScheme = 'light') {
  const { context, page } = await createMobilePage(browser, buildStorageState(), colorScheme)

  const suffix = colorScheme === 'dark' ? '-dark' : ''
  try {
    await page.goto(`${baseUrl}/?view=collections`, { waitUntil: 'domcontentloaded' })
    await page.getByTestId('hamburger-button').waitFor()
    await page.getByTestId('hamburger-button').click()
    await page.getByTestId('drawer-sync-setup').waitFor()
    await page.getByTestId('drawer-sync-setup').click()
    await page.getByTestId('modal-sync-settings').waitFor()
    await capturePageScreenshot(page, path.join(marketingDir, `screenshot-sync${suffix}.png`))
  } finally {
    await context.close()
  }
}

async function captureStatsState(browser, baseUrl, colorScheme = 'light') {
  const { context, page } = await createMobilePage(
    browser,
    buildOnboardingCompleteStorageState({ verses: statsVerses }),
    colorScheme
  )

  const suffix = colorScheme === 'dark' ? '-dark' : ''
  try {
    await page.goto(`${baseUrl}/?view=stats`, { waitUntil: 'domcontentloaded' })
    await page.getByTestId('nav-stats').waitFor()
    await page.getByText('Daily Activity', { exact: true }).waitFor()
    await page.locator('canvas').first().waitFor()
    await capturePageScreenshot(page, path.join(marketingDir, `screenshot-stats${suffix}.png`))
  } finally {
    await context.close()
  }
}

async function captureSearchState(browser, baseUrl, colorScheme = 'light') {
  const { context, page } = await createMobilePage(
    browser,
    buildOnboardingCompleteStorageState({ verses: versesScreenVerses }),
    colorScheme
  )

  const suffix = colorScheme === 'dark' ? '-dark' : ''
  try {
    await page.goto(`${baseUrl}/?view=collections`, { waitUntil: 'domcontentloaded' })
    await page.getByTestId('search-bar').click()
    const searchScreen = page.getByTestId('search-screen')
    await searchScreen.getByPlaceholder('Search verses...').fill('world')
    await searchScreen.getByText('Romans 12:2', { exact: true }).waitFor()
    await searchScreen.getByText('John 3:16', { exact: true }).waitFor()
    await capturePageScreenshot(page, path.join(marketingDir, `screenshot-search${suffix}.png`))
  } finally {
    await context.close()
  }
}

async function captureFabState(browser, baseUrl, colorScheme = 'light') {
  const { context, page } = await createMobilePage(
    browser,
    buildOnboardingCompleteStorageState({ verses: versesScreenVerses }),
    colorScheme
  )

  const suffix = colorScheme === 'dark' ? '-dark' : ''
  try {
    await page.goto(`${baseUrl}/?view=collections`, { waitUntil: 'domcontentloaded' })
    await page.getByTestId('fab-trigger').click()
    await page.getByTestId('fab-new-verse').waitFor()
    await page.getByTestId('fab-new-collection').waitFor()
    await page.getByTestId('fab-import-csv').waitFor()
    await capturePageScreenshot(page, path.join(marketingDir, `screenshot-fab${suffix}.png`))
  } finally {
    await context.close()
  }
}

async function captureImportCSVState(browser, baseUrl, colorScheme = 'light') {
  const { context, page } = await createMobilePage(
    browser,
    buildOnboardingCompleteStorageState({ verses: versesScreenVerses }),
    colorScheme
  )

  const suffix = colorScheme === 'dark' ? '-dark' : ''
  try {
    await page.goto(`${baseUrl}/?view=collections`, { waitUntil: 'domcontentloaded' })
    await page.getByTestId('fab-trigger').click()
    await page.getByTestId('fab-import-csv').click()
    await page.getByTestId('modal-import-csv').waitFor()
    await capturePageScreenshot(page, path.join(marketingDir, `screenshot-import-csv${suffix}.png`))
  } finally {
    await context.close()
  }
}

async function captureNewCollectionState(browser, baseUrl, colorScheme = 'light') {
  const { context, page } = await createMobilePage(
    browser,
    buildOnboardingCompleteStorageState({ verses: versesScreenVerses }),
    colorScheme
  )

  const suffix = colorScheme === 'dark' ? '-dark' : ''
  try {
    await page.goto(`${baseUrl}/?view=collections`, { waitUntil: 'domcontentloaded' })
    await page.getByTestId('fab-trigger').click()
    await page.getByTestId('fab-new-collection').click()
    await page.getByTestId('modal-add-collection').waitFor()
    await capturePageScreenshot(page, path.join(marketingDir, `screenshot-new-collection${suffix}.png`))
  } finally {
    await context.close()
  }
}

async function captureSidebarState(browser, baseUrl, colorScheme = 'light') {
  const { context, page } = await createMobilePage(
    browser,
    buildOnboardingCompleteStorageState({ verses: versesScreenVerses }),
    colorScheme
  )

  const suffix = colorScheme === 'dark' ? '-dark' : ''
  try {
    await page.goto(`${baseUrl}/?view=collections`, { waitUntil: 'domcontentloaded' })
    await page.getByTestId('hamburger-button').click()
    await page.getByTestId('drawer-sync-status').waitFor()
    await page.getByTestId('settings-backup').waitFor()
    await capturePageScreenshot(page, path.join(marketingDir, `screenshot-sidebar${suffix}.png`))
  } finally {
    await context.close()
  }
}

async function captureSettingsState(browser, baseUrl, colorScheme = 'light') {
  const { context, page } = await createMobilePage(
    browser,
    buildOnboardingCompleteStorageState({ verses: versesScreenVerses }),
    colorScheme
  )

  const suffix = colorScheme === 'dark' ? '-dark' : ''
  try {
    await page.goto(`${baseUrl}/?view=collections`, { waitUntil: 'domcontentloaded' })
    await page.getByTestId('hamburger-button').click()
    await page.getByTestId('settings-practice').click()
    await page.getByTestId('modal-practice-settings').waitFor()
    await capturePageScreenshot(page, path.join(marketingDir, `screenshot-settings${suffix}.png`))
  } finally {
    await context.close()
  }
}

async function captureBackupRestoreState(browser, baseUrl, colorScheme = 'light') {
  const { context, page } = await createMobilePage(
    browser,
    buildOnboardingCompleteStorageState({ verses: versesScreenVerses }),
    colorScheme
  )

  const suffix = colorScheme === 'dark' ? '-dark' : ''
  try {
    await page.goto(`${baseUrl}/?view=collections`, { waitUntil: 'domcontentloaded' })
    await page.getByTestId('hamburger-button').click()
    await page.getByTestId('settings-backup').click()
    await page.getByTestId('modal-backup-restore').waitFor()
    await capturePageScreenshot(page, path.join(marketingDir, `screenshot-backup-restore${suffix}.png`))
  } finally {
    await context.close()
  }
}

async function captureFirstRunOnboardingStates(browser, baseUrl, colorScheme = 'light') {
  const { context, page } = await createMobilePage(browser, {}, colorScheme)

  try {
    await page.goto(`${baseUrl}/app/?view=collections`, { waitUntil: 'domcontentloaded' })
    await page.getByTestId('getting-started-card').waitFor()
    await captureFirstRunScreenshot(page, '01', 'welcome', colorScheme)

    await page.getByRole('button', { name: /Add your first verse/i }).click()
    await page.getByTestId('modal-add-verse').waitFor()
    await page.fill('#reference', firstRunVerse.reference)
    await page.fill('#bible-version', firstRunVerse.bibleVersion)
    await page.fill('#content', firstRunVerse.content)
    await captureFirstRunScreenshot(page, '02', 'add-verse', colorScheme)

    await page.getByRole('button', { name: 'Add Verse' }).click()
    await page.getByText('Tap your verse to start memorizing it.').waitFor()
    await captureFirstRunScreenshot(page, '03', 'tap-verse', colorScheme)

    await page.getByText(firstRunVerse.reference).first().click()
    await page.locator('#letter-input-memorize').waitFor({ state: 'attached' })
    await page.getByText('Type the first letter of each word.').waitFor()
    await showKeyboardOverlay(page, colorScheme)
    await captureFirstRunScreenshot(page, '04', 'learn', colorScheme)

    await completeFirstRunPracticeStage(page)
    await page.getByRole('button', { name: /Continue to Memorize/i }).evaluate((button) => button.click())
    await page.getByText('See if you can still do it with some of the words hidden.').waitFor()
    await captureFirstRunScreenshot(page, '05', 'memorize', colorScheme)

    await completeFirstRunPracticeStage(page)
    await page.getByRole('button', { name: /Continue to Master/i }).evaluate((button) => button.click())
    await page.getByText('Now try it without any words visible.').waitFor()
    await captureFirstRunScreenshot(page, '06', 'master', colorScheme)

    await completeFirstRunPracticeStage(page)
    await hideKeyboardOverlay(page)
    await page.getByRole('button', { name: 'Done' }).click()
    await page.getByText("You've mastered your first verse.").waitFor()
    await captureFirstRunScreenshot(page, '07', 'review', colorScheme)
  } finally {
    await context.close()
  }
}

async function captureFirstRunSyncStates(browser, baseUrl, colorScheme = 'light') {
  const syncPromptVerse = buildVerse({
    id: 'first-run-sync-prompt',
    ...firstRunVerse,
  }, {
    memorizationStatus: 'mastered',
    reviewCount: 1,
    lastReviewed: yesterday,
    nextReviewDate: yesterday,
    interval: 1,
  })
  const storageState = {
    ...buildStorageState({ verses: [syncPromptVerse] }),
    'rum1n8-review-completed-count': '1',
    'rum1n8-ui-state': JSON.stringify({
      onboardingDismissed: true,
      guidedOnboardingStep: 'done',
      guidedOnboardingVerseId: null,
      practiceModeHintsSeen: { learn: true, memorize: true, master: true },
    }),
  }
  const { context, page } = await createMobilePage(browser, storageState, colorScheme)

  try {
    await page.goto(`${baseUrl}/app/?view=review-list`, { waitUntil: 'domcontentloaded' })
    await page.getByTestId('backup-nudge-card').waitFor()
    await captureFirstRunScreenshot(page, '08', 'sync-prompt', colorScheme)

    await page.getByTestId('backup-nudge-sync').click()
    await page.getByTestId('modal-sync-settings').waitFor()
    await captureFirstRunScreenshot(page, '09', 'sync-setup', colorScheme)
  } finally {
    await context.close()
  }
}

async function captureFirstRunIOSStates(browser, baseUrl, colorScheme = 'light') {
  const iosOptions = { userAgent: iosSafariUserAgent }
  const { context, page } = await createMobilePage(
    browser,
    {},
    colorScheme,
    iosOptions
  )

  try {
    await page.goto(`${baseUrl}/app/?view=collections`, { waitUntil: 'domcontentloaded' })
    await page.getByText('Use Ruminate as an app, or keep going in your browser.').waitFor()
    await captureFirstRunScreenshot(page, '10', 'ios-install-prompt', colorScheme)

    await page.getByRole('button', { name: 'Install app' }).click()
    await page.getByRole('heading', { name: 'Add to Home Screen' }).waitFor()
    await captureFirstRunScreenshot(page, '11', 'ios-install-steps', colorScheme)
  } finally {
    await context.close()
  }

  const installed = await createMobilePage(
    browser,
    {},
    colorScheme,
    { ...iosOptions, standalone: true }
  )

  try {
    await installed.page.goto(`${baseUrl}/app/?view=collections`, { waitUntil: 'domcontentloaded' })
    await installed.page.getByText('Looking for verses from Safari?').waitFor()
    await captureFirstRunScreenshot(installed.page, '12', 'ios-sync-restore', colorScheme)
  } finally {
    await installed.context.close()
  }
}

async function captureOgCard(browser, baseUrl) {
  const context = await browser.newContext({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  })
  const page = await context.newPage()

  const screenshotEmptyUrl = `${baseUrl}/marketing/screenshot-empty.png`
  const screenshotPracticeUrl = `${baseUrl}/marketing/screenshot-practice.png`
  const screenshotReviewUrl = `${baseUrl}/marketing/screenshot-review.png`

  try {
    await page.setContent(`
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <style>
            :root {
              color-scheme: light;
              --bg: #EFE9DD;
              --bg-soft: #FBF8F2;
              --bg-sunken: #E7DED0;
              --ink: #1E1E1E;
              --muted: #4F5B54;
              --forest: #1F3D2E;
              --forest-strong: #14291F;
              --gold: #C8A45A;
              --card: #E7DED0;
              --stroke: rgba(30, 30, 30, 0.14);
            }
            * {
              box-sizing: border-box;
            }
            body {
              margin: 0;
              width: 1200px;
              height: 630px;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              color: var(--ink);
              background: linear-gradient(135deg, var(--bg-soft) 0%, var(--bg) 100%);
            }
            .frame {
              position: relative;
              display: grid;
              grid-template-columns: 1.05fr 0.95fr;
              gap: 28px;
              width: 100%;
              height: 100%;
              padding: 42px;
              overflow: hidden;
            }
            .glow {
              display: none;
            }
            .left {
              position: relative;
              z-index: 1;
              display: flex;
              flex-direction: column;
              justify-content: center;
              gap: 28px;
              padding: 18px 10px 18px 8px;
            }
            h1 {
              margin: 0 0 12px;
              font-size: 68px;
              line-height: 0.96;
              letter-spacing: -0.04em;
            }
            h1 span {
              display: block;
              font-size: 30px;
              font-weight: 600;
              letter-spacing: -0.02em;
              color: var(--forest);
              margin-top: 18px;
            }
            p {
              margin: 0;
              font-size: 24px;
              line-height: 1.45;
              color: var(--muted);
              max-width: 540px;
            }
            .chips {
              display: flex;
              flex-wrap: wrap;
              gap: 12px;
              margin-top: 22px;
            }
            .chip {
              padding: 10px 14px;
              border-radius: 12px;
              background: rgba(251, 248, 242, 0.84);
              border: 1px solid rgba(30, 30, 30, 0.10);
              color: var(--ink);
              font-size: 16px;
              font-weight: 600;
            }
            .right {
              position: relative;
              z-index: 1;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .stack {
              position: relative;
              width: 480px;
              height: 540px;
            }
            .phone {
              position: absolute;
              overflow: hidden;
              border-radius: 28px;
              background: var(--card);
              border: 1px solid rgba(30, 30, 30, 0.16);
              box-shadow: 0 1px 1px rgba(30, 30, 30, 0.04), 0 2px 4px rgba(30, 30, 30, 0.05);
            }
            .phone img {
              width: 100%;
              height: 100%;
              object-fit: cover;
              display: block;
              border: 1px solid rgba(30, 30, 30, 0.10);
            }
            .phone.practice {
              left: 92px;
              top: 8px;
              width: 240px;
              height: 426px;
              transform: rotate(-4deg);
              z-index: 3;
            }
            .phone.review {
              right: 4px;
              top: 94px;
              width: 224px;
              height: 398px;
              transform: rotate(7deg);
              z-index: 2;
            }
            .phone.empty {
              left: 12px;
              bottom: 18px;
              width: 212px;
              height: 378px;
              transform: rotate(-9deg);
              z-index: 1;
            }
          </style>
        </head>
        <body>
          <div class="frame">
            <div class="glow"></div>
            <section class="left">
              <div>
                <h1>${productName}<span>${title}</span></h1>
                <p>${description}</p>
                <div class="chips">
                  <span class="chip">Sovereign</span>
                  <span class="chip">Simple</span>
                  <span class="chip">Free</span>
                </div>
              </div>
            </section>
            <section class="right">
              <div class="stack">
                <div class="phone practice"><img src="${screenshotPracticeUrl}" alt="Practice screen" /></div>
                <div class="phone review"><img src="${screenshotReviewUrl}" alt="Review list screen" /></div>
                <div class="phone empty"><img src="${screenshotEmptyUrl}" alt="Verses screen" /></div>
              </div>
            </section>
          </div>
        </body>
      </html>
    `, { waitUntil: 'load' })

    await page.waitForLoadState('networkidle')
    await capturePageScreenshot(page, path.join(marketingDir, 'og-card.png'))
  } finally {
    await context.close()
  }
}

const server = await createServer({
  configFile: path.join(projectRoot, 'vite.app.config.js'),
  server: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
  },
})

await mkdir(marketingDir, { recursive: true })

async function launchBrowser() {
  if (process.env.CI) {
    return chromium.launch()
  }

  try {
    return await chromium.launch({ channel: 'chrome' })
  } catch {
    return chromium.launch()
  }
}

try {
  await server.listen()
  const baseUrl = server.resolvedUrls?.local?.[0]?.replace(/\/$/, '') ?? 'http://127.0.0.1:4173'
  const browser = await launchBrowser()

  try {
    for (const colorScheme of ['light', 'dark']) {
      await captureVersesState(browser, baseUrl, colorScheme)
      await capturePracticeState(browser, baseUrl, colorScheme)
      await captureReviewState(browser, baseUrl, colorScheme)
      await captureAddVerseState(browser, baseUrl, colorScheme)
      await captureMemorizeState(browser, baseUrl, colorScheme)
      await captureSyncState(browser, baseUrl, colorScheme)
      await captureStatsState(browser, baseUrl, colorScheme)
      await captureSearchState(browser, baseUrl, colorScheme)
      await captureFabState(browser, baseUrl, colorScheme)
      await captureImportCSVState(browser, baseUrl, colorScheme)
      await captureNewCollectionState(browser, baseUrl, colorScheme)
      await captureSidebarState(browser, baseUrl, colorScheme)
      await captureSettingsState(browser, baseUrl, colorScheme)
      await captureBackupRestoreState(browser, baseUrl, colorScheme)
      await captureFirstRunOnboardingStates(browser, baseUrl, colorScheme)
      await captureFirstRunSyncStates(browser, baseUrl, colorScheme)
      await captureFirstRunIOSStates(browser, baseUrl, colorScheme)
      await captureCompletionStates(browser, baseUrl, colorScheme)
    }
    await captureOgCard(browser, baseUrl)
  } finally {
    await browser.close()
  }
} finally {
  await server.close()
}
