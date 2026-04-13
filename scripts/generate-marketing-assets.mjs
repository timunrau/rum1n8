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

const productName = 'rum1n8'
const title = 'Bible Memory App'
const description = 'A simple Bible memory app that gives you control of your data.'
const now = '2026-04-12T12:00:00.000Z'
const yesterday = '2026-04-11T12:00:00.000Z'
const tomorrow = '2026-04-13T12:00:00.000Z'
const twoDaysOut = '2026-04-14T12:00:00.000Z'
const threeDaysOut = '2026-04-15T12:00:00.000Z'

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

function buildStorageState({ verses: verseState = [], collections: collectionState = [] } = {}) {
  return {
    'rum1n8-verses': JSON.stringify(verseState),
    'rum1n8-collections': JSON.stringify(collectionState),
  }
}

async function createMobilePage(browser, storageState) {
  const context = await browser.newContext({
    viewport: mobileViewport,
    deviceScaleFactor: mobileDeviceScaleFactor,
    isMobile: true,
    hasTouch: true,
  })

  const page = await context.newPage()
  await page.emulateMedia({ colorScheme: 'light' })
  await page.addInitScript((entries) => {
    localStorage.clear()
    Object.entries(entries).forEach(([key, value]) => {
      localStorage.setItem(key, value)
    })
  }, storageState)

  return { context, page }
}

async function showKeyboardOverlay(page) {
  await page.addStyleTag({
    content: `
      body.marketing-keyboard-open .my-2.flex-shrink-0 {
        margin-bottom: 228px !important;
        position: relative;
        z-index: 80;
      }

      body.marketing-keyboard-open .marketing-keyboard {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 70;
        padding: 8px 6px 10px;
        background: linear-gradient(180deg, #d8dbe2 0%, #c7ccd6 100%);
        border-top: 1px solid rgba(15, 23, 42, 0.12);
        box-shadow: 0 -12px 24px rgba(15, 23, 42, 0.12);
      }

      body.marketing-keyboard-open .marketing-keyboard-row {
        display: flex;
        gap: 6px;
        justify-content: center;
        margin-top: 6px;
      }

      body.marketing-keyboard-open .marketing-key {
        min-width: 29px;
        height: 42px;
        border-radius: 8px;
        background: linear-gradient(180deg, #ffffff 0%, #f4f6fa 100%);
        box-shadow:
          inset 0 -1px 0 rgba(15, 23, 42, 0.08),
          0 1px 0 rgba(255, 255, 255, 0.8);
        color: #111827;
        display: flex;
        align-items: center;
        justify-content: center;
        font: 500 15px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }

      body.marketing-keyboard-open .marketing-key.wide {
        min-width: 48px;
      }

      body.marketing-keyboard-open .marketing-key.space {
        min-width: 164px;
      }

      body.marketing-keyboard-open .marketing-key.utility {
        background: linear-gradient(180deg, #b7bec9 0%, #a8b1bf 100%);
      }
    `,
  })

  await page.evaluate(() => {
    document.body.classList.add('marketing-keyboard-open')

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

async function captureVersesState(browser, baseUrl) {
  const { context, page } = await createMobilePage(browser, buildStorageState({
    verses: versesScreenVerses,
  }))

  try {
    await page.goto(`${baseUrl}/?view=collections`, { waitUntil: 'domcontentloaded' })
    await page.getByText('Joshua 1:8').waitFor()
    await orderReferenceCards(page, ['Joshua 1:8', 'Psalm 119:11', 'Romans 12:2', 'John 3:16'])
    await page.waitForTimeout(150)
    await page.screenshot({
      path: path.join(marketingDir, 'screenshot-empty.png'),
    })
  } finally {
    await context.close()
  }
}

async function capturePracticeState(browser, baseUrl) {
  const { context, page } = await createMobilePage(browser, buildStorageState({
    verses: practiceVerses,
  }))

  try {
    await page.goto(`${baseUrl}/?view=collections`, { waitUntil: 'domcontentloaded' })
    await page.getByText('Joshua 1:8').first().click()
    await page.locator('#letter-input-memorize').waitFor({ state: 'attached' })
    await page.locator('#letter-input-memorize').focus()
    await page.keyboard.type('tbotlmndfymmoidan', { delay: 40 })
    await showKeyboardOverlay(page)
    await page.waitForTimeout(200)
    await page.screenshot({
      path: path.join(marketingDir, 'screenshot-practice.png'),
    })
  } finally {
    await context.close()
  }
}

async function captureReviewState(browser, baseUrl) {
  const { context, page } = await createMobilePage(browser, buildStorageState({
    verses: reviewVerses,
  }))

  try {
    await page.goto(`${baseUrl}/?view=review-list`, { waitUntil: 'domcontentloaded' })
    await page.getByText('Joshua 1:8').waitFor()
    await orderReferenceCards(page, ['Joshua 1:8', 'Psalm 119:11', 'Romans 12:2', 'John 3:16'])
    await page.waitForTimeout(150)
    await page.screenshot({
      path: path.join(marketingDir, 'screenshot-review.png'),
    })
  } finally {
    await context.close()
  }
}

async function captureAddVerseState(browser, baseUrl) {
  const { context, page } = await createMobilePage(browser, buildStorageState({
    collections: addVerseCollections,
  }))

  try {
    await page.goto(`${baseUrl}/?view=collections`, { waitUntil: 'domcontentloaded' })
    await page.getByTestId('fab-trigger').waitFor()
    await page.getByTestId('fab-trigger').click()
    await page.getByTestId('fab-new-verse').click()
    await page.getByTestId('modal-add-verse').waitFor()
    await page.waitForTimeout(400)
    await page.fill('#reference', baseVerses.joshua.reference)
    await page.fill('#bible-version', 'BSB')
    await page.fill('#content', baseVerses.joshua.content)
    await page.getByRole('button', { name: 'Renewed Mind' }).click()
    await page.waitForTimeout(150)
    await page.screenshot({
      path: path.join(marketingDir, 'screenshot-add-verse.png'),
    })
  } finally {
    await context.close()
  }
}

async function captureMemorizeState(browser, baseUrl) {
  const { context, page } = await createMobilePage(browser, buildStorageState({
    verses: memorizeVerses,
  }))

  try {
    await page.goto(`${baseUrl}/?view=collections`, { waitUntil: 'domcontentloaded' })
    await page.getByText('Joshua 1:8').first().click()
    await page.locator('#letter-input-memorize').waitFor({ state: 'attached' })
    await page.locator('#letter-input-memorize').focus()
    // In memorize mode, all words (visible and hidden) are typed in order.
    // "This Book of the Law must not depart from your mouth; meditate on it day and night"
    // → t b o t l m n d f y m  m  o  i  d  a  n
    await page.keyboard.type('tbotlmndfymmoidan', { delay: 40 })
    await showKeyboardOverlay(page)
    await page.waitForTimeout(200)
    await page.screenshot({
      path: path.join(marketingDir, 'screenshot-memorize.png'),
    })
  } finally {
    await context.close()
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
              --bg: #f4efe7;
              --bg-accent: #dce8f9;
              --ink: #132238;
              --muted: #4f6178;
              --blue: #295ea7;
              --gold: #d3a64f;
              --card: rgba(255, 255, 255, 0.76);
              --stroke: rgba(19, 34, 56, 0.08);
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
              background:
                radial-gradient(circle at top left, rgba(211, 166, 79, 0.28), transparent 36%),
                radial-gradient(circle at bottom right, rgba(41, 94, 167, 0.22), transparent 32%),
                linear-gradient(135deg, var(--bg) 0%, #fbf8f2 46%, var(--bg-accent) 100%);
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
              position: absolute;
              inset: auto auto 30px 36px;
              width: 420px;
              height: 420px;
              border-radius: 999px;
              background: radial-gradient(circle, rgba(41, 94, 167, 0.18), transparent 72%);
              filter: blur(16px);
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
            .badge {
              display: inline-flex;
              align-items: center;
              gap: 12px;
              width: fit-content;
              padding: 10px 16px;
              border-radius: 999px;
              background: rgba(255, 255, 255, 0.8);
              border: 1px solid var(--stroke);
              box-shadow: 0 18px 44px rgba(19, 34, 56, 0.08);
              font-size: 18px;
              font-weight: 700;
              letter-spacing: 0.02em;
            }
            .badge-mark {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              width: 34px;
              height: 34px;
              border-radius: 12px;
              background: linear-gradient(180deg, #2a5eaa, #183f73);
              color: white;
              font-size: 19px;
            }
            h1 {
              margin: 24px 0 12px;
              font-size: 68px;
              line-height: 0.96;
              letter-spacing: -0.04em;
            }
            h1 span {
              display: block;
              font-size: 30px;
              font-weight: 600;
              letter-spacing: -0.02em;
              color: var(--blue);
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
              border-radius: 999px;
              background: rgba(255, 255, 255, 0.84);
              border: 1px solid rgba(19, 34, 56, 0.08);
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
              border: 1px solid rgba(19, 34, 56, 0.12);
              box-shadow: 0 24px 60px rgba(19, 34, 56, 0.18);
              backdrop-filter: blur(6px);
            }
            .phone img {
              width: 100%;
              height: 100%;
              object-fit: cover;
              display: block;
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
                <div class="badge">
                  <span class="badge-mark">r</span>
                  <span>${productName}</span>
                </div>
                <h1>${productName}<span>${title}</span></h1>
                <p>${description}</p>
                <div class="chips">
                  <span class="chip">Fast review</span>
                  <span class="chip">Privacy-first</span>
                  <span class="chip">Own your data</span>
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
    await page.screenshot({
      path: path.join(marketingDir, 'og-card.png'),
    })
  } finally {
    await context.close()
  }
}

const server = await createServer({
  configFile: path.join(projectRoot, 'vite.config.js'),
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
    await captureVersesState(browser, baseUrl)
    await capturePracticeState(browser, baseUrl)
    await captureReviewState(browser, baseUrl)
    await captureAddVerseState(browser, baseUrl)
    await captureMemorizeState(browser, baseUrl)
    await captureOgCard(browser, baseUrl)
  } finally {
    await browser.close()
  }
} finally {
  await server.close()
}
