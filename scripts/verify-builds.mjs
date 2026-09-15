import { readdir, readFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'

const appDir = resolve('dist-app')
const siteDir = resolve('dist-site')
const failures = []

function check(condition, message) {
  if (!condition) failures.push(message)
}

async function exists(path) {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

async function readText(path, label) {
  try {
    return await readFile(path, 'utf8')
  } catch (error) {
    failures.push(`${label} is missing or unreadable: ${error.message}`)
    return ''
  }
}

async function listFiles(root) {
  const files = []

  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name)
      if (entry.isDirectory()) await walk(path)
      else if (entry.isFile()) files.push(path)
    }
  }

  await walk(root)
  return files
}

for (const path of [
  'app/index.html',
  'manifest.webmanifest',
  'sw.js',
  'registerSW.js',
  'gdrive-callback.html',
  '.well-known/assetlinks.json',
  'health',
]) {
  check(await exists(resolve(appDir, path)), `App build is missing ${path}.`)
}

for (const path of [
  'index.html',
  'memorization-is-a-spiritual-life-hack/index.html',
  'tips-for-memorizing-scripture/index.html',
  'import/biblememory/index.html',
  'privacy/index.html',
  'marketing/screenshot-empty.png',
  'robots.txt',
  'sitemap.xml',
  'health',
]) {
  check(await exists(resolve(siteDir, path)), `Marketing build is missing ${path}.`)
}

for (const path of [
  'app/index.html',
  'manifest.webmanifest',
  'sw.js',
  'registerSW.js',
  'gdrive-callback.html',
  '.well-known/assetlinks.json',
]) {
  check(!(await exists(resolve(siteDir, path))), `Marketing build must not contain ${path}.`)
}

for (const path of [
  'index.html',
  'memorization-is-a-spiritual-life-hack/index.html',
  'tips-for-memorizing-scripture/index.html',
  'import/biblememory/index.html',
  'privacy/index.html',
  'robots.txt',
  'sitemap.xml',
]) {
  check(!(await exists(resolve(appDir, path))), `App build must not contain marketing artifact ${path}.`)
}

const manifest = JSON.parse(await readText(resolve(appDir, 'manifest.webmanifest'), 'App manifest') || '{}')
check(manifest.id === '/', 'Manifest id must be /.')
check(manifest.scope === '/', 'Manifest scope must be /.')
check(manifest.start_url === '/app/', 'Manifest start_url must be /app/.')
check(manifest.screenshots?.length === 3, 'Manifest must retain exactly three screenshots.')

const sw = await readText(resolve(appDir, 'sw.js'), 'App service worker')
check(sw.includes('/app/index.html'), 'Service worker must navigate-fallback to /app/index.html.')
check(sw.includes('allowlist:[/^\\/app'), 'Service worker fallback must be allowlisted to /app/.')
for (const route of ['memorization-is-a-spiritual-life-hack', 'tips-for-memorizing-scripture', 'import/biblememory', 'privacy/index.html']) {
  check(!sw.includes(route), `Service worker must not precache marketing route ${route}.`)
}

const expectedPages = [
  ['index.html', '/'],
  ['memorization-is-a-spiritual-life-hack/index.html', '/memorization-is-a-spiritual-life-hack/'],
  ['tips-for-memorizing-scripture/index.html', '/tips-for-memorizing-scripture/'],
  ['import/biblememory/index.html', '/import/biblememory/'],
  ['privacy/index.html', '/privacy/'],
]
const marketingRoot = process.env.VITE_MARKETING_URL
if (marketingRoot) {
  for (const [file, path] of expectedPages) {
    const html = await readText(resolve(siteDir, file), file)
    const canonical = new URL(path.replace(/^\//, ''), marketingRoot).toString()
    check(html.includes(`<link rel="canonical" href="${canonical}"`), `${file} has the wrong canonical URL.`)
    check(html.includes(`<meta property="og:url" content="${canonical}"`), `${file} has the wrong og:url.`)
    check(html.includes('<meta property="og:title"'), `${file} is missing og:title.`)
    check(html.includes('<meta name="twitter:card"'), `${file} is missing Twitter metadata.`)
  }
}

const rootHtml = await readText(resolve(siteDir, 'index.html'), 'Marketing homepage')
check(rootHtml.includes('application/ld+json'), 'Marketing homepage is missing JSON-LD.')
if (marketingRoot) {
  const screenshotUrl = new URL('marketing/screenshot-empty.png', marketingRoot).toString()
  check(rootHtml.includes(screenshotUrl), 'Marketing homepage JSON-LD has the wrong screenshot URL.')
}
const sitemap = await readText(resolve(siteDir, 'sitemap.xml'), 'Marketing sitemap')
for (const [, path] of expectedPages) {
  if (marketingRoot) check(sitemap.includes(new URL(path.replace(/^\//, ''), marketingRoot).toString()), `Sitemap is missing ${path}.`)
}

const siteTextFiles = (await listFiles(siteDir)).filter((path) => /\.(?:html|js|css|txt|xml|json)$/.test(path))
const siteText = (await Promise.all(siteTextFiles.map((path) => readFile(path, 'utf8')))).join('\n')
check(!/\$\{RUM1N8_|%[A-Z][A-Z_]+%|__MARKETING_ORIGIN__/.test(siteText), 'Marketing build contains an unresolved placeholder.')
check(!siteText.includes('createApp('), 'Marketing build unexpectedly contains the Vue application.')
check(!siteText.includes('vite-plugin-pwa'), 'Marketing build unexpectedly contains PWA code.')

const appTextFiles = (await listFiles(appDir)).filter((path) => /\.(?:html|js|css|json|webmanifest)$/.test(path))
const appText = (await Promise.all(appTextFiles.map((path) => readFile(path, 'utf8')))).join('\n')
const appAnalyticsId = process.env.VITE_UMAMI_WEBSITE_ID
const marketingAnalyticsId = process.env.VITE_UMAMI_MARKETING_WEBSITE_ID
if (appAnalyticsId) check(appText.includes(appAnalyticsId), 'App build does not contain its configured analytics ID.')
if (marketingAnalyticsId) check(!appText.includes(marketingAnalyticsId), 'App build contains the marketing analytics ID.')
if (marketingAnalyticsId) check(siteText.includes(marketingAnalyticsId), 'Marketing build does not contain its configured analytics ID.')
if (appAnalyticsId) check(!siteText.includes(appAnalyticsId), 'Marketing build contains the app analytics ID.')

if (failures.length) {
  console.error('Build verification failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('App and marketing build boundaries verified.')
