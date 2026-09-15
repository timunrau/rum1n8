import { execFileSync } from 'node:child_process'
import { chromium } from '@playwright/test'

const oldImage = process.env.OLD_APP_IMAGE || 'ghcr.io/timunrau/rum1n8:latest'
const newImage = process.env.NEW_APP_IMAGE || 'rum1n8-app:local'
const proxyImage = process.env.PROXY_IMAGE || 'rum1n8-proxy:local'
const port = Number(process.env.UPGRADE_TEST_PORT || 18082)
const origin = `http://127.0.0.1:${port}`
const suffix = process.pid
const networkName = `rum1n8-upgrade-${suffix}`
const proxyName = `rum1n8-upgrade-proxy-${suffix}`
const appName = `rum1n8-upgrade-app-${suffix}`
const sentinel = JSON.stringify([{
  id: 'pwa-upgrade-sentinel',
  reference: 'Psalm 119:11',
  content: 'PWA upgrade test data',
  bibleVersion: 'TEST',
  createdAt: '2026-01-01T00:00:00.000Z',
  lastModified: '2026-01-01T00:00:00.000Z',
  memorizationStatus: 'unmemorized',
  reviewCount: 0,
  lastReviewed: null,
  nextReviewDate: null,
  easeFactor: 2.5,
  interval: 0,
  reviewHistory: [],
  collectionIds: [],
}])

const marketingPaths = new Set([
  '/',
  '/index.html',
  '/home/',
  '/about/',
  '/memorization-is-a-spiritual-life-hack/',
  '/tips-for-memorizing-scripture/',
  '/import/biblememory/',
  '/privacy.html',
  '/privacy/',
])

function docker(args, { tolerateFailure = false } = {}) {
  try {
    return execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  } catch (error) {
    if (tolerateFailure) return ''
    const detail = error.stderr?.toString().trim() || error.message
    throw new Error(`docker ${args.join(' ')} failed: ${detail}`)
  }
}

function startApp(image, platform) {
  const args = ['run', '--rm', '-d']
  if (platform) args.push('--platform', platform)
  args.push(
    '--network', networkName,
    '--name', appName,
    '-p', `${port}:80`,
    '-e', `VITE_SITE_URL=${origin}`,
    image,
  )
  docker(args)
}

async function waitForServer() {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${origin}/health`, { cache: 'no-store' })
      if (response.ok) return
    } catch {
      // The container may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`Timed out waiting for ${origin}/health`)
}

async function cacheUrls(page) {
  return page.evaluate(async () => {
    const urls = []
    for (const cacheName of await caches.keys()) {
      const cache = await caches.open(cacheName)
      for (const request of await cache.keys()) urls.push(request.url)
    }
    return urls
  })
}

function marketingCacheUrls(urls) {
  return urls.filter((url) => marketingPaths.has(new URL(url).pathname))
}

async function waitForNewWorkerCache(page, assetPath) {
  const deadline = Date.now() + 45_000
  while (Date.now() < deadline) {
    try {
      const urls = await cacheUrls(page)
      if (urls.some((url) => new URL(url).pathname === assetPath)) return urls
    } catch {
      // The existing update flow reloads the page after controllerchange.
    }
    await page.waitForTimeout(250)
  }
  throw new Error(`New service worker did not cache ${assetPath}`)
}

let browser
try {
  const newAssetPath = docker([
    'run', '--rm', '--entrypoint', 'sh', newImage,
    '-c', "find /usr/share/nginx/html/assets -maxdepth 1 -name 'app-*.js' -print -quit",
  ]).replace('/usr/share/nginx/html', '')
  if (!newAssetPath) throw new Error(`No app JavaScript asset found in ${newImage}`)

  docker(['network', 'create', networkName])
  docker([
    'run', '--rm', '-d',
    '--network', networkName,
    '--network-alias', 'webdav-proxy',
    '--name', proxyName,
    proxyImage,
  ])
  startApp(oldImage, process.env.OLD_APP_PLATFORM || 'linux/amd64')
  await waitForServer()

  browser = await chromium.launch()
  const context = await browser.newContext({ serviceWorkers: 'allow' })
  const page = await context.newPage()
  await page.goto(`${origin}/app/`, { waitUntil: 'networkidle' })
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller))

  await page.evaluate((value) => localStorage.setItem('rum1n8-verses', value), sentinel)
  await page.reload({ waitUntil: 'networkidle' })
  const oldUrls = await cacheUrls(page)
  const oldMarketingUrls = marketingCacheUrls(oldUrls)
  if (oldMarketingUrls.length === 0) {
    throw new Error('Released worker did not expose an obsolete marketing cache entry to test')
  }

  docker(['stop', appName])
  startApp(newImage)
  await waitForServer()

  await page.getByTestId('hamburger-button').click()
  await page.getByRole('button', { name: /^v\d/ }).click()
  const newUrls = await waitForNewWorkerCache(page, newAssetPath)
  await page.waitForLoadState('domcontentloaded')

  const retained = await page.evaluate(() => localStorage.getItem('rum1n8-verses'))
  const retainedVerse = JSON.parse(retained || '[]')
    .find((verse) => verse.id === 'pwa-upgrade-sentinel')
  if (retainedVerse?.reference !== 'Psalm 119:11' || retainedVerse?.content !== 'PWA upgrade test data') {
    throw new Error('Recognizable local app data did not survive the image upgrade')
  }

  const remainingMarketingUrls = marketingCacheUrls(newUrls)
  if (remainingMarketingUrls.length > 0) {
    throw new Error(`Obsolete marketing cache entries remain: ${remainingMarketingUrls.join(', ')}`)
  }

  await context.setOffline(true)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByTestId('hamburger-button').waitFor({ state: 'visible' })

  console.log(JSON.stringify({
    oldImage,
    newImage,
    oldMarketingEntriesRemoved: oldMarketingUrls.length,
    localDataRetained: true,
    offlineAppLoaded: true,
  }, null, 2))
} finally {
  await browser?.close()
  docker(['stop', appName], { tolerateFailure: true })
  docker(['stop', proxyName], { tolerateFailure: true })
  docker(['network', 'rm', networkName], { tolerateFailure: true })
}
