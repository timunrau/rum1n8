import { test, expect, type Locator, type Page } from '@playwright/test'
import { clearAppStorage, seedStorage } from '../helpers/storage'
import { gotoApp } from '../helpers/navigation'

const dueVerse = {
  id: 'due-verse',
  reference: 'Psalms 15:1-3',
  content: 'LORD, who may abide in Your tent? Who may dwell on Your holy mountain?',
  bibleVersion: 'BSB',
  createdAt: '2024-01-01T00:00:00.000Z',
  lastModified: '2024-01-01T00:00:00.000Z',
  memorizationStatus: 'mastered',
  reviewCount: 3,
  lastReviewed: '2024-01-15T00:00:00.000Z',
  nextReviewDate: '2023-12-01T00:00:00.000Z',
  easeFactor: 2.5,
  interval: 7,
  reviewHistory: [],
  collectionIds: ['master-list'],
}

const learningVerse = {
  ...dueVerse,
  id: 'learning-verse',
  reference: 'Joshua 1:9',
  content: 'Be strong and courageous.',
  memorizationStatus: 'unmemorized',
  reviewCount: 0,
  lastReviewed: null,
  nextReviewDate: null,
  interval: 0,
}

test.beforeEach(async ({ page }) => {
  await gotoApp(page)
  await clearAppStorage(page)
  await page.reload()
})

async function openSeededVerseList(page: Page) {
  await seedStorage(page, [dueVerse, learningVerse], [])
  await gotoApp(page, '?view=collection&collection=master-list')
}

function verseCard(page: Page, reference: string) {
  return page.locator('.verse-card').filter({ hasText: reference }).first()
}

async function centeredHeaderLayout(card: Locator) {
  return card.evaluate((element) => {
    const summary = element.querySelector('.verse-card__summary-row')
    const version = element.querySelector('.verse-card__version')
    const status = element.querySelector('.pos-badge-el, .verse-card__meta')

    if (!(summary instanceof HTMLElement) || !(version instanceof HTMLElement) || !(status instanceof HTMLElement)) {
      throw new Error('Verse list item structure is incomplete')
    }

    const cardRect = element.getBoundingClientRect()
    const summaryRect = summary.getBoundingClientRect()
    const versionRect = version.getBoundingClientRect()
    const statusRect = status.getBoundingClientRect()

    return {
      cardCenter: (cardRect.top + cardRect.bottom) / 2,
      summaryCenter: (summaryRect.top + summaryRect.bottom) / 2,
      versionCenter: (versionRect.top + versionRect.bottom) / 2,
      statusCenter: (statusRect.top + statusRect.bottom) / 2,
    }
  })
}

function expectCenteredHeader(layout: Awaited<ReturnType<typeof centeredHeaderLayout>>) {
  expect(Math.abs(layout.summaryCenter - layout.cardCenter)).toBeLessThan(0.75)
  expect(Math.abs(layout.versionCenter - layout.summaryCenter)).toBeLessThan(0.75)
  expect(Math.abs(layout.statusCenter - layout.summaryCenter)).toBeLessThan(0.75)
}

async function chevronLayout(card: Locator) {
  return card.evaluate((element) => {
    const summary = element.querySelector('.verse-card__summary-row')
    const control = element.querySelector('.verse-card__leading-control')

    if (!(summary instanceof HTMLElement) || !(control instanceof HTMLElement)) {
      throw new Error('Verse list item chevron structure is incomplete')
    }

    const cardRect = element.getBoundingClientRect()
    const summaryRect = summary.getBoundingClientRect()
    const controlRect = control.getBoundingClientRect()

    return {
      summaryTopWithinCard: summaryRect.top - cardRect.top,
      controlLeftWithinSummary: controlRect.left - summaryRect.left,
      controlCenterWithinSummary: (controlRect.top + controlRect.bottom - summaryRect.top - summaryRect.bottom) / 2,
    }
  })
}

test('collection and review screens share the same centered verse item header', async ({ page }) => {
  await openSeededVerseList(page)

  const collectionCard = verseCard(page, dueVerse.reference)
  await expect(collectionCard.locator(':scope > .verse-card__summary-row')).toBeVisible()
  expectCenteredHeader(await centeredHeaderLayout(collectionCard))

  await gotoApp(page, '?view=review-list')

  const reviewCard = verseCard(page, dueVerse.reference)
  await expect(reviewCard.locator(':scope > .verse-card__summary-row')).toBeVisible()
  expectCenteredHeader(await centeredHeaderLayout(reviewCard))
})

test('desktop collection header and verse list share the app content width', async ({ page }) => {
  await openSeededVerseList(page)

  for (const width of [800, 1280]) {
    await page.setViewportSize({ width, height: 800 })

    const header = page.locator('.app-view-header .app-content-header__inner')
    const card = verseCard(page, dueVerse.reference)
    await expect(header).toBeVisible()
    await expect(card).toBeVisible()

    const [headerBox, cardBox] = await Promise.all([
      header.boundingBox(),
      card.boundingBox(),
    ])

    expect(headerBox).not.toBeNull()
    expect(cardBox).not.toBeNull()
    expect(Math.abs(headerBox!.x - cardBox!.x)).toBeLessThan(1)
    expect(Math.abs(headerBox!.width - cardBox!.width)).toBeLessThan(1)
    expect(Math.abs((headerBox!.x + headerBox!.width) - (cardBox!.x + cardBox!.width))).toBeLessThan(1)
  }
})

test('expanding a verse keeps the chevron fixed and avoids inline height animation', async ({ page }) => {
  await openSeededVerseList(page)

  const card = verseCard(page, dueVerse.reference)
  const button = card.getByRole('button', { name: 'Expand verse' })
  const bodyGrid = card.locator('.verse-card__body-grid')
  const before = await chevronLayout(card)

  await button.click()

  await page.waitForTimeout(60)
  const during = await chevronLayout(card)
  await page.waitForTimeout(220)
  const after = await chevronLayout(card)

  for (const layout of [during, after]) {
    expect(Math.abs(layout.summaryTopWithinCard - before.summaryTopWithinCard)).toBeLessThan(0.1)
    expect(Math.abs(layout.controlLeftWithinSummary - before.controlLeftWithinSummary)).toBeLessThan(0.1)
    expect(Math.abs(layout.controlCenterWithinSummary - before.controlCenterWithinSummary)).toBeLessThan(0.1)
  }

  const animation = await bodyGrid.evaluate((element) => ({
    transitionProperty: getComputedStyle(element).transitionProperty,
    inlineHeight: (element as HTMLElement).style.height,
    ariaHidden: element.getAttribute('aria-hidden'),
  }))

  expect(animation.transitionProperty).toContain('grid-template-rows')
  expect(animation.inlineHeight).toBe('')
  expect(animation.ariaHidden).toBe('false')
})

function channelValues(color: string) {
  const values = color.match(/[\d.]+/g)?.slice(0, 3).map(Number)
  if (!values || values.length !== 3) throw new Error(`Unsupported colour: ${color}`)
  return values
}

function relativeLuminance(color: string) {
  const [red, green, blue] = channelValues(color).map((channel) => {
    const value = channel / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

function contrastRatio(foreground: string, background: string) {
  const foregroundLuminance = relativeLuminance(foreground)
  const backgroundLuminance = relativeLuminance(background)
  return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05)
    / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
}

test('due and learning statuses use distinct readable colours and weights', async ({ page }) => {
  await openSeededVerseList(page)

  const dueStatus = verseCard(page, dueVerse.reference).locator('.pos-badge-el')
  const learningStatus = verseCard(page, learningVerse.reference).locator('.pos-badge-el')

  await expect(dueStatus).toHaveText('due')
  await expect(learningStatus).toHaveText('learn')

  const [dueStyle, learningStyle] = await Promise.all([
    dueStatus.evaluate((element) => ({
      color: getComputedStyle(element).color,
      background: getComputedStyle(element.closest('.verse-card')!).backgroundColor,
      weight: Number(getComputedStyle(element).fontWeight),
    })),
    learningStatus.evaluate((element) => ({
      color: getComputedStyle(element).color,
      background: getComputedStyle(element.closest('.verse-card')!).backgroundColor,
      weight: Number(getComputedStyle(element).fontWeight),
    })),
  ])

  const dueChannels = channelValues(dueStyle.color)
  const learningChannels = channelValues(learningStyle.color)
  const colourDistance = Math.hypot(...dueChannels.map((channel, index) => channel - learningChannels[index]))

  expect(colourDistance).toBeGreaterThan(80)
  expect(dueStyle.weight).toBeGreaterThan(learningStyle.weight)
  expect(contrastRatio(dueStyle.color, dueStyle.background)).toBeGreaterThanOrEqual(4.5)
  expect(contrastRatio(learningStyle.color, learningStyle.background)).toBeGreaterThanOrEqual(4.5)
})
