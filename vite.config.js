import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync, writeFileSync } from 'node:fs'
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

function buildSiteMetadata(env) {
  const productName = 'rum1n8'
  const descriptor = 'Bible memory app'
  const title = `${productName} - Bible Memory App`
  const defaultDescription = `A simple Bible memory app that gives you control of your data.`
  const siteUrl = normalizeSiteUrl(env.VITE_SITE_URL)
  const landingHeading = 'A simple Bible memory app for Scripture memorization and review'
  const landingBody = 'Add verses quickly, practice with first-letter typing, move through Learn, Memorize, and Master, and keep your memorization data under your control.'
  const landingHighlights = [
    'No account required',
    'Fast review with Learn, Memorize, and Master',
    'Portable backups and sync options',
    'Installable offline web app',
  ]

  return {
    productName,
    descriptor,
    title,
    defaultDescription,
    landingHeading,
    landingBody,
    landingHighlights,
    socialPreviewImagePath: '/marketing/og-card.png',
    screenshotPaths: [
      '/marketing/screenshot-empty.png',
      '/marketing/screenshot-practice.png',
      '/marketing/screenshot-review.png',
    ],
    siteUrl,
    rootUrl: siteUrl ? `${siteUrl}/` : null,
    noscriptDescription: `${defaultDescription} Enable JavaScript to use the full app.`,
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
    featureList: siteMetadata.landingHighlights,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
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

function buildOptionalSiteUrlTags(siteMetadata) {
  if (!siteMetadata.rootUrl) return ''

  return [
    `<link rel="canonical" href="${escapeHtml(siteMetadata.rootUrl)}" />`,
    `<meta property="og:url" content="${escapeHtml(siteMetadata.rootUrl)}" />`,
  ].join('\n    ')
}

function renderHtmlTemplate(template, replacements) {
  return Object.entries(replacements).reduce(
    (result, [pattern, value]) => result.replaceAll(pattern, value),
    template
  )
}

function buildIndexHtmlReplacements(siteMetadata) {
  return {
    '%SITE_TITLE%': escapeHtml(siteMetadata.title),
    '%PRODUCT_NAME%': escapeHtml(siteMetadata.productName),
    '%SITE_DESCRIPTION%': escapeHtml(siteMetadata.defaultDescription),
    '%SOCIAL_IMAGE_URL%': escapeHtml(buildSocialImageUrl(siteMetadata)),
    '%SOCIAL_IMAGE_ALT%': escapeHtml(`${siteMetadata.title} preview`),
    '%OPTIONAL_SITE_URL_TAGS%': buildOptionalSiteUrlTags(siteMetadata),
    '%SITE_JSON_LD%': serializeJsonForHtmlScript(buildJsonLd(siteMetadata)),
    '%LANDING_HEADING%': escapeHtml(siteMetadata.landingHeading),
    '%LANDING_BODY%': escapeHtml(siteMetadata.landingBody),
    '%LANDING_HIGHLIGHTS%': siteMetadata.landingHighlights
      .map((highlight) => `<li>${escapeHtml(highlight)}</li>`)
      .join(''),
    '%NOSCRIPT_DESCRIPTION%': escapeHtml(siteMetadata.noscriptDescription),
  }
}

function buildRuntimeIndexHtmlTemplateFromFinal(finalHtml, siteMetadata) {
  let template = finalHtml

  // Replace the social image URL (absolute or relative) with envsubst var
  const socialImageUrl = escapeHtml(buildSocialImageUrl(siteMetadata))
  template = template.replaceAll(socialImageUrl, '${RUM1N8_SOCIAL_IMAGE_URL}')

  // Replace canonical + og:url tags with envsubst var (or insert placeholder if absent)
  const optionalTags = buildOptionalSiteUrlTags(siteMetadata)
  if (optionalTags) {
    template = template.replace(optionalTags, '${RUM1N8_OPTIONAL_SITE_URL_TAGS}')
  } else {
    // No URL tags were generated at build time; insert the placeholder
    // before the closing </head> so the runtime script can inject them
    template = template.replace('</head>', '${RUM1N8_OPTIONAL_SITE_URL_TAGS}\n</head>')
  }

  // Replace JSON-LD: swap the closing } with ${RUM1N8_JSON_LD_URL_FIELDS}}
  // so the runtime script can append URL fields
  const buildJsonLdStr = serializeJsonForHtmlScript(buildJsonLd(siteMetadata))
  const noUrlJsonLdStr = serializeJsonForHtmlScript(buildJsonLd({
    ...siteMetadata,
    siteUrl: null,
    rootUrl: null,
  }))
  const runtimeJsonLdStr = noUrlJsonLdStr.replace(/}$/, '${RUM1N8_JSON_LD_URL_FIELDS}}')
  template = template.replace(buildJsonLdStr, runtimeJsonLdStr)

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
    transformIndexHtml(html) {
      return renderHtmlTemplate(html, buildIndexHtmlReplacements(siteMetadata))
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
      // Read the final index.html (after Vite and VitePWA have written it)
      // and derive the runtime template with envsubst placeholders for
      // URL-specific values. This ensures the template has hashed asset
      // paths and PWA tags that the raw source HTML lacks.
      const outDir = resolve(process.cwd(), 'dist')
      const finalHtml = readFileSync(resolve(outDir, 'index.html'), 'utf-8')
      writeFileSync(
        resolve(outDir, 'index.html.template'),
        buildRuntimeIndexHtmlTemplateFromFinal(finalHtml, siteMetadata),
      )
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const siteMetadata = buildSiteMetadata(env)

  return {
    define: {
      __APP_VERSION__: JSON.stringify(packageJson.version)
    },
    server: {
      port: process.env.PORT ? parseInt(process.env.PORT) : 5173,
      strictPort: !!process.env.PORT,
      // Default to localhost for safer, more portable local development.
      // Set HOST=true or HOST=0.0.0.0 when you explicitly want LAN access.
      host: process.env.HOST === 'true' ? true : (process.env.HOST || '127.0.0.1'),
    },
    test: {
      exclude: ['e2e/**', '**/e2e/**', 'node_modules/**', '.claude/**'],
    },
    plugins: [
      vue(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: 'icons/icon-192x192.png',
        manifest: {
          name: siteMetadata.title,
          short_name: siteMetadata.productName,
          description: siteMetadata.defaultDescription,
          theme_color: '#ffffff',
          background_color: '#1a1a1a',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          scope: '/',
          icons: [
            {
              "src": "icons/icon-48x48.png",
              "sizes": "48x48",
              "type": "image/png",
              "purpose": "any maskable"
            },
            {
              "src": "icons/icon-72x72.png",
              "sizes": "72x72",
              "type": "image/png",
              "purpose": "any maskable"
            },
            {
              "src": "icons/icon-96x96.png",
              "sizes": "96x96",
              "type": "image/png",
              "purpose": "any maskable"
            },
            {
              "src": "icons/icon-128x128.png",
              "sizes": "128x128",
              "type": "image/png",
              "purpose": "any maskable"
            },
            {
              "src": "icons/icon-144x144.png",
              "sizes": "144x144",
              "type": "image/png",
              "purpose": "any maskable"
            },
            {
              "src": "icons/icon-152x152.png",
              "sizes": "152x152",
              "type": "image/png",
              "purpose": "any maskable"
            },
            {
              "src": "icons/icon-192x192.png",
              "sizes": "192x192",
              "type": "image/png",
              "purpose": "any maskable"
            },
            {
              "src": "icons/icon-256x256.png",
              "sizes": "256x256",
              "type": "image/png",
              "purpose": "any maskable"
            },
            {
              "src": "icons/icon-384x384.png",
              "sizes": "384x384",
              "type": "image/png",
              "purpose": "any maskable"
            },
            {
              "src": "icons/icon-512x512.png",
              "sizes": "512x512",
              "type": "image/png",
              "purpose": "any maskable"
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          navigateFallbackDenylist: [/^\/gdrive-callback\.html/, /^\/privacy/],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            }
          ]
        },
        devOptions: {
          enabled: true,
          type: 'module'
        }
      }),
      createSiteMetadataPlugin(siteMetadata),
    ]
  }
})
