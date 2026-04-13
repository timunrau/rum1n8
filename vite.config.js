import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const packageJson = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf-8')
)

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
  const siteUrl = normalizeSiteUrl(env.VITE_SITE_URL)

  return {
    productName,
    title,
    defaultDescription,
    siteUrl,
    rootUrl: siteUrl ? `${siteUrl}/` : null,
    appPath: '/app/',
    aboutPath: '/about/',
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

function buildCanonicalRootTags(siteMetadata) {
  if (!siteMetadata.rootUrl) return ''

  return [
    `<link rel="canonical" href="${escapeHtml(siteMetadata.rootUrl)}" />`,
    `<meta property="og:url" content="${escapeHtml(siteMetadata.rootUrl)}" />`,
  ].join('\n    ')
}

function buildSocialTags(siteMetadata) {
  const socialImageUrl = buildSocialImageUrl(siteMetadata)

  return [
    `<meta property="og:title" content="${escapeHtml(siteMetadata.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(siteMetadata.defaultDescription)}" />`,
    '<meta property="og:type" content="website" />',
    `<meta property="og:site_name" content="${escapeHtml(siteMetadata.productName)}" />`,
    `<meta property="og:image" content="${escapeHtml(socialImageUrl)}" />`,
    `<meta property="og:image:alt" content="${escapeHtml(siteMetadata.socialPreviewImageAlt)}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${escapeHtml(siteMetadata.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(siteMetadata.defaultDescription)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(socialImageUrl)}" />`,
    `<meta name="twitter:image:alt" content="${escapeHtml(siteMetadata.socialPreviewImageAlt)}" />`,
  ].join('\n    ')
}

function detectHtmlPage(ctx) {
  const identifier = `${ctx?.path || ''} ${ctx?.filename || ''}`

  if (identifier.includes('/app/') || identifier.includes('app/index.html')) {
    return 'app'
  }

  if (identifier.includes('/about/') || identifier.includes('about/index.html')) {
    return 'about'
  }

  return 'marketing'
}

function buildHtmlReplacements(siteMetadata, page) {
  const pageTitle = page === 'app' ? `${siteMetadata.productName} App` : siteMetadata.title
  const pageDescription = siteMetadata.defaultDescription
  const robots = page === 'marketing'
    ? 'index,follow'
    : (page === 'about' ? 'noindex,follow' : 'noindex,nofollow')
  const canonicalTags = page === 'app' ? '' : buildCanonicalRootTags(siteMetadata)
  const socialTags = page === 'app' ? '' : buildSocialTags(siteMetadata)
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

function buildRuntimeHtmlTemplateFromFinal(finalHtml, siteMetadata, options = {}) {
  let template = finalHtml

  const socialImageUrl = escapeHtml(buildSocialImageUrl(siteMetadata))
  template = template.replaceAll(socialImageUrl, '${RUM1N8_SOCIAL_IMAGE_URL}')

  const canonicalTags = buildCanonicalRootTags(siteMetadata)
  if (canonicalTags) {
    template = template.replace(canonicalTags, '${RUM1N8_CANONICAL_ROOT_TAGS}')
  } else {
    template = template.replace('</head>', '${RUM1N8_CANONICAL_ROOT_TAGS}\n</head>')
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
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    '  <url>',
    '    <loc>${RUM1N8_ROOT_URL}</loc>',
    '  </url>',
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

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    '  <url>',
    `    <loc>${escapeXml(siteMetadata.rootUrl)}</loc>`,
    '  </url>',
    '</urlset>',
    '',
  ].join('\n')
}

function createSiteMetadataPlugin(siteMetadata) {
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
      const htmlTemplates = [
        { fileName: 'index.html', includeJsonLd: true },
        { fileName: 'about/index.html', includeJsonLd: false },
      ]

      htmlTemplates.forEach(({ fileName, includeJsonLd }) => {
        const filePath = resolve(outDir, fileName)
        if (!existsSync(filePath)) return

        const finalHtml = readFileSync(filePath, 'utf-8')
        writeFileSync(
          resolve(outDir, `${fileName}.template`),
          buildRuntimeHtmlTemplateFromFinal(finalHtml, siteMetadata, { includeJsonLd }),
        )
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const siteMetadata = buildSiteMetadata(env)

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
        input: {
          main: resolve(process.cwd(), 'index.html'),
          about: resolve(process.cwd(), 'about/index.html'),
          app: resolve(process.cwd(), 'app/index.html'),
        },
      },
    },
    plugins: [
      vue(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: 'icons/icon-192x192.png',
        manifest: {
          id: '/',
          name: siteMetadata.title,
          short_name: siteMetadata.productName,
          description: siteMetadata.defaultDescription,
          theme_color: '#ffffff',
          background_color: '#ffffff',
          display: 'standalone',
          orientation: 'portrait',
          start_url: siteMetadata.appPath,
          scope: '/',
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
            /^\/about(?:\/.*)?$/,
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
      createSiteMetadataPlugin(siteMetadata),
    ],
  }
})
