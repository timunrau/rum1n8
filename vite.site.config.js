import { resolve } from 'node:path'
import { defineConfig, loadEnv, normalizePath } from 'vite'
import {
  buildSiteMetadata,
  createMarketingFilesPlugin,
  createStaticAssetsPlugin,
  homePageMetadata,
  serverHost,
} from './build/vite-shared.js'
import { readMarkdownPages } from './site/content.js'
import { renderPage } from './site/templates.js'

const SITE_STATIC_ASSETS = [
  'icons/icon-192x192.png',
  'marketing/og-card.png',
  'marketing/screenshot-empty.png',
  'marketing/screenshot-add-verse-dark.png',
  'marketing/screenshot-add-verse.png',
  'marketing/screenshot-memorize-dark.png',
  'marketing/screenshot-memorize.png',
  'marketing/screenshot-practice-dark.png',
  'marketing/screenshot-practice.png',
  'marketing/screenshot-review-dark.png',
  'marketing/screenshot-review.png',
  'marketing/screenshot-sync-dark.png',
  'marketing/screenshot-sync.png',
]
const siteStaticAssetPaths = new Set(SITE_STATIC_ASSETS.map((file) => `/${file}`))

const legacyRedirects = new Map([
  ['/home', '/'], ['/home/', '/'], ['/home/index.html', '/'],
  ['/about', '/'], ['/about/', '/'], ['/about/index.html', '/'],
  ['/privacy.html', '/privacy/'],
])

function createStaticPagesPlugin(metadata, htmlEntries) {
  const home = homePageMetadata(metadata)
  return {
    name: 'ruminate-static-pages',
    enforce: 'pre',

    // Give Vite directory-index HTML entries so its normal asset pipeline can
    // fingerprint the linked CSS and optional browser enhancements.
    resolveId(id) {
      if (htmlEntries.has(id)) return id
    },
    load(id) {
      const page = htmlEntries.get(id)
      if (page) return renderPage(page, metadata, siteStaticAssetPaths)
    },

    configureServer(server) {
      const root = server.config.root
      server.watcher.on('all', (_event, file) => {
        const path = normalizePath(file)
        if (path.startsWith(`${root}/content/`) || path.startsWith(`${root}/partials/`) || path === `${root}/home.html`) {
          server.ws.send({ type: 'full-reload', path: '*' })
        }
      })

      server.middlewares.use(async (req, res, next) => {
        if (!['GET', 'HEAD'].includes(req.method)) return next()

        const url = req.url || '/'
        const pathname = url.split('?')[0]
        if (!/^\/(?:[a-z0-9-]+\/)*([a-z0-9-]+(?:\.html)?)?$/.test(pathname)) return next()

        try {
          const pages = readMarkdownPages()
          const canonical = pathname.endsWith('/index.html')
            ? pathname.slice(0, -'index.html'.length)
            : `${pathname}/`
          const target = legacyRedirects.get(pathname)
            || (canonical === '/' || pages.has(canonical) ? canonical : null)
          if (target) {
            res.statusCode = 301
            res.setHeader('Location', target + url.slice(pathname.length))
            res.end()
            return
          }

          const page = pathname === '/' ? home : pages.get(pathname)
          if (!page) return next()

          const html = await server.transformIndexHtml(
            `${pathname}index.html`, renderPage(page, metadata, siteStaticAssetPaths), url,
          )
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.end(req.method === 'HEAD' ? undefined : html)
        } catch (error) {
          next(error)
        }
      })
    },
  }
}

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const metadata = buildSiteMetadata(env, mode)
  const root = resolve('site')
  const pages = command === 'build' ? [homePageMetadata(metadata), ...readMarkdownPages().values()] : []
  const htmlEntries = new Map(pages.map((page) => [normalizePath(resolve(root, `.${page.path}index.html`)), page]))

  return {
    root,
    appType: 'custom',
    publicDir: false,
    server: {
      host: serverHost(),
      port: 5174,
      strictPort: true,
      watch: { ignored: ['**/dist-app/**', '**/dist-site/**', '**/dev-dist/**'] },
    },
    build: {
      outDir: resolve('dist-site'),
      emptyOutDir: true,
      assetsInlineLimit: file => file.endsWith('.svg') ? false : undefined,
      rollupOptions: { input: [...htmlEntries.keys()] },
    },
    plugins: [
      createStaticPagesPlugin(metadata, htmlEntries),
      createStaticAssetsPlugin(SITE_STATIC_ASSETS),
      createMarketingFilesPlugin(metadata, pages),
    ],
  }
})
