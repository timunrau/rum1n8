import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const packageJson = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf-8')
)

const PUBLIC_PAGES = Object.freeze([
  {
    page: 'marketing',
    inputName: 'marketing',
    inputFile: 'index.html',
    path: '/',
    includeJsonLd: true,
    canonicalPlaceholder: '${RUM1N8_CANONICAL_ROOT_TAGS}',
  },
  {
    page: 'memorizationBenefits',
    inputName: 'memorizationBenefits',
    inputFile: 'memorization-is-a-spiritual-life-hack/index.html',
    path: '/memorization-is-a-spiritual-life-hack/',
    includeJsonLd: false,
    canonicalPlaceholder: '${RUM1N8_CANONICAL_MEMORIZATION_BENEFITS_TAGS}',
  },
  {
    page: 'scriptureTips',
    inputName: 'scriptureTips',
    inputFile: 'tips-for-memorizing-scripture/index.html',
    path: '/tips-for-memorizing-scripture/',
    includeJsonLd: false,
    canonicalPlaceholder: '${RUM1N8_CANONICAL_SCRIPTURE_TIPS_TAGS}',
  },
])

const APP_PAGE = Object.freeze({
  page: 'app',
  inputName: 'app',
  inputFile: 'app/index.html',
  path: '/app/',
})

const HTML_PAGES = Object.freeze([
  ...PUBLIC_PAGES,
  APP_PAGE,
])

const PUBLIC_PAGE_NAMES = new Set(PUBLIC_PAGES.map(({ page }) => page))

function normalizeSiteUrl(value) {
  if (!value?.trim()) return null

  try {
    const normalized = new URL(value.trim())
    normalized.hash = ''
    normalized.search = ''
    normalized.pathname = normalized.pathname.replace(/\/+$/, '') || '/'
    return normalized.toString().replace(/\/$/, '')
  } catch (error) {
    throw new Error(`Invalid VITE_SITE_URL value "${value}": ${error.message}`)
  }
}

function withLeadingSlash(path) {
  return path.startsWith('/') ? path : `/${path}`
}

function getAbsoluteSitePath(siteUrl, path) {
  return `${siteUrl}${withLeadingSlash(path)}`
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

function serializeJsonForHtmlScript(value) {
  return JSON.stringify(value).replaceAll('<', '\\u003c')
}

function renderHtmlTemplate(template, replacements) {
  return Object.entries(replacements).reduce(
    (result, [pattern, value]) => result.replaceAll(pattern, value),
    template
  )
}

function buildSiteMetadata(env) {
  const productName = 'rum1n8'
  const title = `${productName} - Bible Memory App`
  const defaultDescription = 'A simple Bible memory app that gives you control of your data.'
  const memorizationBenefitsTitle = 'Memorization Is A Spiritual Life-Hack'
  const memorizationBenefitsDescription = "A short case for why Scripture memorization unlocks real growth in your walk with God."
  const scriptureTipsTitle = 'Tips For Memorizing Scripture'
  const scriptureTipsDescription = 'Practical tips for starting small, building a daily Scripture memorization habit, and reviewing consistently.'
  const siteUrl = normalizeSiteUrl(env.VITE_SITE_URL)

  return {
    productName,
    title,
    defaultDescription,
    memorizationBenefitsTitle,
    memorizationBenefitsDescription,
    scriptureTipsTitle,
    scriptureTipsDescription,
    siteUrl,
    rootUrl: siteUrl ? `${siteUrl}/` : null,
    appPath: '/app/',
    memorizationBenefitsPath: '/memorization-is-a-spiritual-life-hack/',
    scriptureTipsPath: '/tips-for-memorizing-scripture/',
    socialPreviewImagePath: '/marketing/og-card.png',
    socialPreviewImageAlt: 'rum1n8 app preview',
    screenshotPaths: [
      '/marketing/screenshot-empty.png',
      '/marketing/screenshot-practice.png',
      '/marketing/screenshot-review.png',
    ],
  }
}

function buildJsonLd(siteMetadata) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: siteMetadata.title,
    alternateName: siteMetadata.productName,
    description: siteMetadata.defaultDescription,
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'Web Browser',
    isAccessibleForFree: true,
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

  if (siteMetadata.rootUrl) {
    jsonLd.url = siteMetadata.rootUrl
    jsonLd.image = getAbsoluteSitePath(siteMetadata.siteUrl, siteMetadata.socialPreviewImagePath)
    jsonLd.screenshot = siteMetadata.screenshotPaths.map((path) => (
      getAbsoluteSitePath(siteMetadata.siteUrl, path)
    ))
  }

  return jsonLd
}

function buildSocialImageUrl(siteMetadata) {
  return siteMetadata.siteUrl
    ? getAbsoluteSitePath(siteMetadata.siteUrl, siteMetadata.socialPreviewImagePath)
    : siteMetadata.socialPreviewImagePath
}

function buildCanonicalTags(siteMetadata, path) {
  if (!siteMetadata.siteUrl) return ''

  const canonicalUrl = getAbsoluteSitePath(siteMetadata.siteUrl, path)

  return [
    `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`,
    `<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`,
  ].join('\n    ')
}

function buildSocialTags(siteMetadata, pageMetadata = {}) {
  const socialImageUrl = buildSocialImageUrl(siteMetadata)
  const title = pageMetadata.title || siteMetadata.title
  const description = pageMetadata.description || siteMetadata.defaultDescription

  return [
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    '<meta property="og:type" content="website" />',
    `<meta property="og:site_name" content="${escapeHtml(siteMetadata.productName)}" />`,
    `<meta property="og:image" content="${escapeHtml(socialImageUrl)}" />`,
    `<meta property="og:image:alt" content="${escapeHtml(siteMetadata.socialPreviewImageAlt)}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(socialImageUrl)}" />`,
    `<meta name="twitter:image:alt" content="${escapeHtml(siteMetadata.socialPreviewImageAlt)}" />`,
  ].join('\n    ')
}

function detectHtmlPage(ctx) {
  const path = ctx?.path || ''
  const page = HTML_PAGES.find((candidate) => {
    const inputPath = `/${candidate.inputFile}`
    const cleanPathIndex = candidate.path === '/'
      ? '/index.html'
      : `${candidate.path}index.html`

    return path === candidate.path || path === inputPath || path === cleanPathIndex
  })

  return page?.page || 'marketing'
}

function buildHtmlReplacements(siteMetadata, page) {
  const pageMetadataByPage = {
    memorizationBenefits: {
      title: siteMetadata.memorizationBenefitsTitle,
      description: siteMetadata.memorizationBenefitsDescription,
      canonicalPath: siteMetadata.memorizationBenefitsPath,
    },
    scriptureTips: {
      title: siteMetadata.scriptureTipsTitle,
      description: siteMetadata.scriptureTipsDescription,
      canonicalPath: siteMetadata.scriptureTipsPath,
    },
  }
  const pageMetadata = pageMetadataByPage[page] || {
    title: page === 'app' ? `${siteMetadata.productName} App` : siteMetadata.title,
    description: siteMetadata.defaultDescription,
    canonicalPath: '/',
  }
  const pageTitle = pageMetadata.title
  const pageDescription = pageMetadata.description
  const robots = PUBLIC_PAGE_NAMES.has(page)
    ? 'index,follow'
    : 'noindex,nofollow'
  const canonicalTags = page === 'app' ? '' : buildCanonicalTags(siteMetadata, pageMetadata.canonicalPath)
  const socialTags = page === 'app' ? '' : buildSocialTags(siteMetadata, pageMetadata)
  const jsonLdTag = page === 'marketing'
    ? `<script type="application/ld+json">${serializeJsonForHtmlScript(buildJsonLd(siteMetadata))}</script>`
    : ''

  return {
    '%PAGE_TITLE%': escapeHtml(pageTitle),
    '%PAGE_DESCRIPTION%': escapeHtml(pageDescription),
    '%META_ROBOTS%': escapeHtml(robots),
    '%HEAD_CANONICAL_TAGS%': canonicalTags,
    '%HEAD_SOCIAL_TAGS%': socialTags,
    '%HEAD_JSON_LD%': jsonLdTag,
  }
}

export {
  buildHtmlReplacements,
  buildSiteMetadata,
}

function buildRuntimeHtmlTemplateFromFinal(finalHtml, siteMetadata, options = {}) {
  let template = finalHtml

  const socialImageUrl = escapeHtml(buildSocialImageUrl(siteMetadata))
  template = template.replaceAll(socialImageUrl, '${RUM1N8_SOCIAL_IMAGE_URL}')

  const canonicalPlaceholder = options.canonicalPlaceholder || '${RUM1N8_CANONICAL_ROOT_TAGS}'
  const canonicalPath = options.canonicalPath || '/'
  const canonicalTags = buildCanonicalTags(siteMetadata, canonicalPath)
  if (canonicalTags) {
    template = template.replace(canonicalTags, canonicalPlaceholder)
  } else {
    template = template.replace('</head>', `${canonicalPlaceholder}\n</head>`)
  }

  if (options.includeJsonLd) {
    const buildJsonLdStr = serializeJsonForHtmlScript(buildJsonLd(siteMetadata))
    const noUrlJsonLdStr = serializeJsonForHtmlScript(buildJsonLd({
      ...siteMetadata,
      siteUrl: null,
      rootUrl: null,
    }))
    const runtimeJsonLdStr = noUrlJsonLdStr.replace(/}$/, '${RUM1N8_JSON_LD_URL_FIELDS}}')
    template = template.replace(buildJsonLdStr, runtimeJsonLdStr)
  }

  return template
}

function buildRuntimeRobotsTxtTemplate() {
  return [
    'User-agent: *',
    'Allow: /',
    '${RUM1N8_SITEMAP_LINE}',
    '',
  ].join('\n')
}

function buildRuntimeSitemapXmlTemplate() {
  const sitemapUrls = PUBLIC_PAGES.flatMap(({ path }) => {
    const loc = path === '/'
      ? '${RUM1N8_ROOT_URL}'
      : `\${RUM1N8_ROOT_URL}${path.replace(/^\//, '')}`

    return [
      '  <url>',
      `    <loc>${loc}</loc>`,
      '  </url>',
    ]
  })

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...sitemapUrls,
    '</urlset>',
    '',
  ].join('\n')
}

function buildRobotsTxt(siteMetadata) {
  const lines = [
    'User-agent: *',
    'Allow: /',
  ]

  if (siteMetadata.siteUrl) {
    lines.push('', `Sitemap: ${getAbsoluteSitePath(siteMetadata.siteUrl, '/sitemap.xml')}`)
  }

  return `${lines.join('\n')}\n`
}

function buildSitemapXml(siteMetadata) {
  if (!siteMetadata.rootUrl) return null

  const sitemapUrls = PUBLIC_PAGES.flatMap(({ path }) => [
    '  <url>',
    `    <loc>${escapeXml(getAbsoluteSitePath(siteMetadata.siteUrl, path))}</loc>`,
    '  </url>',
  ])

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...sitemapUrls,
    '</urlset>',
    '',
  ].join('\n')
}

function buildPrivacyAnalyticsSection(analyticsEnabled) {
  if (!analyticsEnabled) return null

  return [
    '<h2>Third-Party Services</h2>',
    '    <p>This build of rum1n8 uses a self-hosted instance of <a href="https://umami.is" target="_blank" rel="noopener noreferrer">Umami</a>, a privacy-friendly analytics tool, to measure aggregate usage. No personal data is collected, no third-party tracking cookies are set, and no data is shared with advertisers. You can turn analytics off for your own device at any time from the app\'s Settings.</p>',
    '    <p>The external requests the app makes are:</p>',
    '    <ul>',
    '      <li>Bible text imports via the <a href="https://fetch.bible" target="_blank" rel="noopener noreferrer">fetch.bible</a> API (when you import verse content)</li>',
    '      <li>Your configured sync provider (only if you set one up)</li>',
    '      <li>The self-hosted Umami analytics endpoint for this deployment (unless you opt out in Settings)</li>',
    '    </ul>',
  ].join('\n    ')
}

function rewritePrivacyHtml(html, analyticsEnabled) {
  const section = buildPrivacyAnalyticsSection(analyticsEnabled)
  if (!section) return html

  return html.replace(
    /<!--ANALYTICS_SECTION_START-->[\s\S]*?<!--ANALYTICS_SECTION_END-->/,
    `<!--ANALYTICS_SECTION_START-->\n    ${section}\n    <!--ANALYTICS_SECTION_END-->`
  )
}

function createSiteMetadataPlugin(siteMetadata, { analyticsEnabled = false } = {}) {
  return {
    name: 'rum1n8-site-metadata',
    transformIndexHtml(html, ctx) {
      return renderHtmlTemplate(
        html,
        buildHtmlReplacements(siteMetadata, detectHtmlPage(ctx))
      )
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: buildRobotsTxt(siteMetadata),
      })

      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt.template',
        source: buildRuntimeRobotsTxtTemplate(),
      })

      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml.template',
        source: buildRuntimeSitemapXmlTemplate(),
      })

      const sitemapXml = buildSitemapXml(siteMetadata)
      if (sitemapXml) {
        this.emitFile({
          type: 'asset',
          fileName: 'sitemap.xml',
          source: sitemapXml,
        })
      }
    },
    closeBundle() {
      const outDir = resolve(process.cwd(), 'dist')

      const privacyPath = resolve(outDir, 'privacy.html')
      if (analyticsEnabled && existsSync(privacyPath)) {
        writeFileSync(
          privacyPath,
          rewritePrivacyHtml(readFileSync(privacyPath, 'utf-8'), true)
        )
      }

      PUBLIC_PAGES.forEach(({ inputFile, includeJsonLd, path, canonicalPlaceholder }) => {
        const filePath = resolve(outDir, inputFile)
        if (!existsSync(filePath)) return

        const finalHtml = readFileSync(filePath, 'utf-8')
        writeFileSync(
          resolve(outDir, `${inputFile}.template`),
          buildRuntimeHtmlTemplateFromFinal(finalHtml, siteMetadata, {
            includeJsonLd,
            canonicalPath: path,
            canonicalPlaceholder,
          }),
        )
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const siteMetadata = buildSiteMetadata(env)
  const analyticsEnabled = Boolean(env.VITE_UMAMI_SCRIPT_URL && env.VITE_UMAMI_WEBSITE_ID)

  return {
    define: {
      __APP_VERSION__: JSON.stringify(packageJson.version),
    },
    server: {
      port: process.env.PORT ? parseInt(process.env.PORT) : 5173,
      strictPort: !!process.env.PORT,
      host: process.env.HOST === 'true' ? true : (process.env.HOST || '127.0.0.1'),
    },
    test: {
      exclude: ['e2e/**', '**/e2e/**', 'node_modules/**', '.claude/**'],
    },
    build: {
      rollupOptions: {
        input: Object.fromEntries(
          HTML_PAGES.map(({ inputName, inputFile }) => [
            inputName,
            resolve(process.cwd(), inputFile),
          ])
        ),
      },
    },
    plugins: [
      {
        name: 'dev-static-route-canonicalization',
        configureServer(server) {
          const redirects = new Map([
            ['/about', '/'],
            ['/about/', '/'],
            ['/about/index.html', '/'],
            ['/home', '/'],
            ['/home/', '/'],
            ['/home/index.html', '/'],
            ['/index.html', '/'],
            ['/app/index.html', '/app/'],
            ['/memorization-is-a-spiritual-life-hack/index.html', '/memorization-is-a-spiritual-life-hack/'],
            ['/tips-for-memorizing-scripture/index.html', '/tips-for-memorizing-scripture/'],
          ])

          server.middlewares.use((req, res, next) => {
            const [pathname, query] = (req.url || '').split('?')
            const redirectTarget = redirects.get(pathname)
            if (redirectTarget) {
              res.statusCode = 301
              res.setHeader('Location', `${redirectTarget}${query ? `?${query}` : ''}`)
              res.end()
              return
            }

            if (pathname === '/privacy' || pathname === '/privacy/') {
              req.url = `/privacy.html${query ? `?${query}` : ''}`
            }
            next()
          })
        },
      },
      vue(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: 'icons/icon-192x192.png',
        manifest: {
          id: '/',
          name: siteMetadata.title,
          short_name: siteMetadata.productName,
          description: siteMetadata.defaultDescription,
          theme_color: '#F1EEE8',
          background_color: '#F1EEE8',
          display: 'standalone',
          display_override: ['standalone', 'minimal-ui', 'browser'],
          orientation: 'portrait',
          start_url: siteMetadata.appPath,
          scope: '/',
          categories: ['education', 'lifestyle', 'productivity'],
          screenshots: [
            {
              src: 'marketing/screenshot-empty.png',
              sizes: '1080x1920',
              type: 'image/png',
              form_factor: 'narrow',
              label: 'Verse library view',
            },
            {
              src: 'marketing/screenshot-practice.png',
              sizes: '1080x1920',
              type: 'image/png',
              form_factor: 'narrow',
              label: 'Practice mode view',
            },
            {
              src: 'marketing/screenshot-review.png',
              sizes: '1080x1920',
              type: 'image/png',
              form_factor: 'narrow',
              label: 'Review list view',
            },
          ],
          shortcuts: [
            {
              name: 'Collections',
              short_name: 'Collections',
              description: 'Open your verse library',
              url: '/app/?view=collections',
              icons: [
                {
                  src: 'icons/icon-192x192.png',
                  sizes: '192x192',
                  type: 'image/png',
                },
              ],
            },
            {
              name: 'Review',
              short_name: 'Review',
              description: 'Open verses due for review',
              url: '/app/?view=review-list',
              icons: [
                {
                  src: 'icons/icon-192x192.png',
                  sizes: '192x192',
                  type: 'image/png',
                },
              ],
            },
            {
              name: 'Stats',
              short_name: 'Stats',
              description: 'Open memorization stats',
              url: '/app/?view=stats',
              icons: [
                {
                  src: 'icons/icon-192x192.png',
                  sizes: '192x192',
                  type: 'image/png',
                },
              ],
            },
          ],
          icons: [
            {
              src: 'icons/icon-48x48.png',
              sizes: '48x48',
              type: 'image/png',
              purpose: 'any maskable',
            },
            {
              src: 'icons/icon-72x72.png',
              sizes: '72x72',
              type: 'image/png',
              purpose: 'any maskable',
            },
            {
              src: 'icons/icon-96x96.png',
              sizes: '96x96',
              type: 'image/png',
              purpose: 'any maskable',
            },
            {
              src: 'icons/icon-128x128.png',
              sizes: '128x128',
              type: 'image/png',
              purpose: 'any maskable',
            },
            {
              src: 'icons/icon-144x144.png',
              sizes: '144x144',
              type: 'image/png',
              purpose: 'any maskable',
            },
            {
              src: 'icons/icon-152x152.png',
              sizes: '152x152',
              type: 'image/png',
              purpose: 'any maskable',
            },
            {
              src: 'icons/icon-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any maskable',
            },
            {
              src: 'icons/icon-256x256.png',
              sizes: '256x256',
              type: 'image/png',
              purpose: 'any maskable',
            },
            {
              src: 'icons/icon-384x384.png',
              sizes: '384x384',
              type: 'image/png',
              purpose: 'any maskable',
            },
            {
              src: 'icons/icon-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          navigateFallback: '/app/index.html',
          navigateFallbackDenylist: [
            /^\/$/,
            /^\/index\.html$/,
            /^\/about(?:\/.*)?$/,
            /^\/home(?:\/.*)?$/,
            /^\/app\/index\.html$/,
            /^\/memorization-is-a-spiritual-life-hack(?:\/.*)?$/,
            /^\/tips-for-memorizing-scripture(?:\/.*)?$/,
            /^\/gdrive-callback\.html/,
            /^\/privacy/,
          ],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
      createSiteMetadataPlugin(siteMetadata, { analyticsEnabled }),
    ],
  }
})
