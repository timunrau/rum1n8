import { readFileSync } from 'node:fs'
import { extname, resolve } from 'node:path'

export const APP_PATH = '/app/'

export const MARKETING_PAGES = Object.freeze([
  {
    page: 'marketing',
    inputName: 'marketing',
    inputFile: 'index.html',
    path: '/',
    includeJsonLd: true,
  },
  {
    page: 'memorizationBenefits',
    inputName: 'memorizationBenefits',
    inputFile: 'memorization-is-a-spiritual-life-hack/index.html',
    path: '/memorization-is-a-spiritual-life-hack/',
  },
  {
    page: 'scriptureTips',
    inputName: 'scriptureTips',
    inputFile: 'tips-for-memorizing-scripture/index.html',
    path: '/tips-for-memorizing-scripture/',
  },
  {
    page: 'bibleMemoryImport',
    inputName: 'bibleMemoryImport',
    inputFile: 'import/biblememory/index.html',
    path: '/import/biblememory/',
  },
  {
    page: 'privacy',
    inputName: 'privacy',
    inputFile: 'privacy/index.html',
    path: '/privacy/',
  },
])

const PAGE_NAMES = new Set(MARKETING_PAGES.map(({ page }) => page))

const MIME_TYPES = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
})

function parseConfiguredUrl(name, value, { production, expectedPath }) {
  if (!value?.trim()) {
    if (production) throw new Error(`${name} is required for a production build.`)
    return null
  }

  let url
  try {
    url = new URL(value.trim())
  } catch (error) {
    throw new Error(`${name} is malformed: ${error.message}`)
  }

  if (production && url.protocol !== 'https:') {
    throw new Error(`${name} must use HTTPS in production.`)
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(`${name} must not include credentials, a query string, or a fragment.`)
  }

  const normalizedPath = url.pathname.replace(/\/+$/, '') || '/'
  const normalizedExpectedPath = expectedPath.replace(/\/+$/, '') || '/'
  if (normalizedPath !== normalizedExpectedPath) {
    throw new Error(`${name} must use the path ${expectedPath}`)
  }

  url.pathname = expectedPath
  return url.toString()
}

export function resolvePublicUrls(env, mode) {
  const production = mode === 'production'
  return {
    appUrl: parseConfiguredUrl('VITE_APP_URL', env.VITE_APP_URL, {
      production,
      expectedPath: APP_PATH,
    }) || 'http://127.0.0.1:5173/app/',
    marketingUrl: parseConfiguredUrl(
      'VITE_MARKETING_URL',
      env.VITE_MARKETING_URL || env.VITE_SITE_URL,
      { production, expectedPath: '/' },
    ) || 'http://127.0.0.1:5174/',
  }
}

function withoutTrailingSlash(value) {
  return value.replace(/\/+$/, '')
}

function absoluteUrl(rootUrl, path) {
  return new URL(path.replace(/^\//, ''), rootUrl).toString()
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function escapeXml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function serializeJsonForHtml(value) {
  return JSON.stringify(value).replaceAll('<', '\\u003c')
}

export function buildSiteMetadata(env, mode = 'development') {
  const { appUrl, marketingUrl } = resolvePublicUrls(env, mode)

  return {
    productName: 'rum1n8',
    title: 'rum1n8 - Bible Memory',
    defaultDescription: 'A simple Bible memory app that gives you control of your data.',
    memorizationBenefitsTitle: 'Memorization Is A Spiritual Life-Hack',
    memorizationBenefitsDescription: "A short case for why Scripture memorization unlocks real growth in your walk with God.",
    scriptureTipsTitle: 'Tips For Memorizing Scripture',
    scriptureTipsDescription: 'Practical tips for starting small, building a daily Scripture memorization habit, and reviewing consistently.',
    bibleMemoryImportTitle: 'Import from BibleMemory.com',
    bibleMemoryImportDescription: 'Export your BibleMemory.com verses with a local bookmarklet, download a CSV, and import it into Ruminate.',
    privacyTitle: 'Privacy Policy - rum1n8',
    privacyDescription: 'How rum1n8 stores your data, handles optional sync, and respects your analytics preference.',
    appUrl,
    marketingUrl,
    siteUrl: withoutTrailingSlash(marketingUrl),
    rootUrl: marketingUrl,
    appPath: APP_PATH,
    memorizationBenefitsPath: '/memorization-is-a-spiritual-life-hack/',
    scriptureTipsPath: '/tips-for-memorizing-scripture/',
    bibleMemoryImportPath: '/import/biblememory/',
    privacyPath: '/privacy/',
    socialPreviewImagePath: '/marketing/og-card.png',
    socialPreviewImageAlt: 'rum1n8 app preview',
    screenshotPaths: [
      '/marketing/screenshot-empty.png',
      '/marketing/screenshot-practice.png',
      '/marketing/screenshot-review.png',
    ],
  }
}

function buildJsonLd(metadata) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: metadata.title,
    alternateName: metadata.productName,
    description: metadata.defaultDescription,
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'Web Browser',
    isAccessibleForFree: true,
    url: metadata.rootUrl,
    image: absoluteUrl(metadata.rootUrl, metadata.socialPreviewImagePath),
    screenshot: metadata.screenshotPaths.map((path) => absoluteUrl(metadata.rootUrl, path)),
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    featureList: [
      'No account required',
      'First-letter typing for verse memorization',
      'Spaced repetition review',
      'Portable backups and optional sync',
      'Installable offline web app',
    ],
  }
}

function pageMetadata(metadata, page) {
  const byPage = {
    memorizationBenefits: {
      title: metadata.memorizationBenefitsTitle,
      description: metadata.memorizationBenefitsDescription,
      path: metadata.memorizationBenefitsPath,
    },
    scriptureTips: {
      title: metadata.scriptureTipsTitle,
      description: metadata.scriptureTipsDescription,
      path: metadata.scriptureTipsPath,
    },
    bibleMemoryImport: {
      title: metadata.bibleMemoryImportTitle,
      description: metadata.bibleMemoryImportDescription,
      path: metadata.bibleMemoryImportPath,
    },
    privacy: {
      title: metadata.privacyTitle,
      description: metadata.privacyDescription,
      path: metadata.privacyPath,
    },
  }

  return byPage[page] || {
    title: page === 'app' ? `${metadata.productName} App` : metadata.title,
    description: metadata.defaultDescription,
    path: '/',
  }
}

export function buildHtmlReplacements(metadata, page) {
  const current = pageMetadata(metadata, page)
  const isMarketingPage = PAGE_NAMES.has(page)
  const canonicalUrl = isMarketingPage ? absoluteUrl(metadata.rootUrl, current.path) : null
  const socialImageUrl = absoluteUrl(metadata.rootUrl, metadata.socialPreviewImagePath)

  const canonicalTags = canonicalUrl
    ? [
        `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`,
        `<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`,
      ].join('\n    ')
    : ''

  const socialTags = isMarketingPage
    ? [
        `<meta property="og:title" content="${escapeHtml(current.title)}" />`,
        `<meta property="og:description" content="${escapeHtml(current.description)}" />`,
        '<meta property="og:type" content="website" />',
        `<meta property="og:site_name" content="${escapeHtml(metadata.productName)}" />`,
        `<meta property="og:image" content="${escapeHtml(socialImageUrl)}" />`,
        `<meta property="og:image:alt" content="${escapeHtml(metadata.socialPreviewImageAlt)}" />`,
        '<meta name="twitter:card" content="summary_large_image" />',
        `<meta name="twitter:title" content="${escapeHtml(current.title)}" />`,
        `<meta name="twitter:description" content="${escapeHtml(current.description)}" />`,
        `<meta name="twitter:image" content="${escapeHtml(socialImageUrl)}" />`,
        `<meta name="twitter:image:alt" content="${escapeHtml(metadata.socialPreviewImageAlt)}" />`,
      ].join('\n    ')
    : ''

  return {
    '%PAGE_TITLE%': escapeHtml(current.title),
    '%PAGE_DESCRIPTION%': escapeHtml(current.description),
    '%META_ROBOTS%': isMarketingPage ? 'index,follow' : 'noindex,nofollow',
    '%HEAD_CANONICAL_TAGS%': canonicalTags,
    '%HEAD_SOCIAL_TAGS%': socialTags,
    '%HEAD_JSON_LD%': page === 'marketing'
      ? `<script type="application/ld+json">${serializeJsonForHtml(buildJsonLd(metadata))}</script>`
      : '',
    '%APP_URL%': escapeHtml(metadata.appUrl),
    '%MARKETING_URL%': escapeHtml(metadata.marketingUrl),
  }
}

function detectPage(ctx, pages) {
  const normalized = [ctx?.filename, ctx?.path]
    .filter(Boolean)
    .map((value) => value.replaceAll('\\', '/').replace(process.cwd().replaceAll('\\', '/') + '/', '').replace(/^\/+|\/+$/g, ''))

  return pages.find(({ inputFile, path }) => normalized.some((value) => (
    value === inputFile || value === path.replace(/^\/+|\/+$/g, '') || value === `${path.replace(/^\/+/, '')}index.html`
  )))?.page || pages[0].page
}

function renderTemplate(html, replacements) {
  return Object.entries(replacements).reduce(
    (result, [placeholder, value]) => result.replaceAll(placeholder, value),
    html,
  )
}

export function createHtmlMetadataPlugin(metadata, pages) {
  return {
    name: 'rum1n8-html-metadata',
    transformIndexHtml(html, ctx) {
      return renderTemplate(html, buildHtmlReplacements(metadata, detectPage(ctx, pages)))
    },
  }
}

export function createMarketingFilesPlugin(metadata) {
  return {
    name: 'rum1n8-marketing-files',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: `User-agent: *\nAllow: /\n\nSitemap: ${absoluteUrl(metadata.rootUrl, '/sitemap.xml')}\n`,
      })

      const urls = MARKETING_PAGES.map(({ path }) => [
        '  <url>',
        `    <loc>${escapeXml(absoluteUrl(metadata.rootUrl, path))}</loc>`,
        '  </url>',
      ].join('\n')).join('\n')
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
      })
      this.emitFile({ type: 'asset', fileName: 'health', source: 'healthy\n' })
    },
  }
}

export function createHealthFilePlugin() {
  return {
    name: 'rum1n8-health-file',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'health', source: 'healthy\n' })
    },
  }
}

export function createStaticAssetsPlugin(entries) {
  const assets = new Map(entries.map((entry) => {
    const source = typeof entry === 'string' ? `public/${entry}` : entry.source
    const destination = typeof entry === 'string' ? entry : entry.destination
    return [`/${destination}`, { source: resolve(process.cwd(), source), destination }]
  }))

  return {
    name: 'rum1n8-explicit-static-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const asset = assets.get((req.url || '').split('?')[0])
        if (!asset) return next()

        try {
          res.statusCode = 200
          res.setHeader('Content-Type', MIME_TYPES[extname(asset.source)] || 'application/octet-stream')
          res.end(readFileSync(asset.source))
        } catch {
          next()
        }
      })
    },
    generateBundle() {
      for (const { source, destination } of assets.values()) {
        this.emitFile({ type: 'asset', fileName: destination, source: readFileSync(source) })
      }
    },
  }
}

export function serverHost() {
  return process.env.HOST === 'true' ? true : (process.env.HOST || '127.0.0.1')
}
