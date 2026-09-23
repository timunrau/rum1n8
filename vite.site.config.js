import { resolve } from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import {
  MARKETING_PAGES,
  buildSiteMetadata,
  createHtmlMetadataPlugin,
  createMarketingFilesPlugin,
  createStaticAssetsPlugin,
  serverHost,
} from './build/vite-shared.js'

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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const metadata = buildSiteMetadata(env, mode)

  return {
    root: resolve(process.cwd(), 'site'),
    publicDir: false,
    server: {
      host: serverHost(),
      port: 5174,
      strictPort: true,
      watch: { ignored: ['**/dist-app/**', '**/dist-site/**', '**/dev-dist/**'] },
    },
    build: {
      outDir: resolve(process.cwd(), 'dist-site'),
      emptyOutDir: true,
      rollupOptions: {
        input: Object.fromEntries(MARKETING_PAGES.map(({ inputName, inputFile }) => [
          inputName,
          resolve(process.cwd(), inputFile),
        ])),
      },
    },
    plugins: [
      {
        name: 'marketing-route-canonicalization',
        configureServer(server) {
          const redirects = new Map([
            ['/index.html', '/'], ['/home', '/'], ['/home/', '/'], ['/home/index.html', '/'],
            ['/about', '/'], ['/about/', '/'], ['/about/index.html', '/'],
            ['/memorization-is-a-spiritual-life-hack', '/memorization-is-a-spiritual-life-hack/'],
            ['/memorization-is-a-spiritual-life-hack/index.html', '/memorization-is-a-spiritual-life-hack/'],
            ['/tips-for-memorizing-scripture', '/tips-for-memorizing-scripture/'],
            ['/tips-for-memorizing-scripture/index.html', '/tips-for-memorizing-scripture/'],
            ['/import/biblememory', '/import/biblememory/'],
            ['/import/biblememory/index.html', '/import/biblememory/'],
            ['/privacy', '/privacy/'], ['/privacy.html', '/privacy/'], ['/privacy/index.html', '/privacy/'],
          ])

          server.middlewares.use((req, res, next) => {
            const [pathname, query] = (req.url || '').split('?')
            const target = redirects.get(pathname)
            if (!target) return next()

            res.statusCode = 301
            res.setHeader('Location', `${target}${query ? `?${query}` : ''}`)
            res.end()
          })
        },
      },
      createStaticAssetsPlugin(SITE_STATIC_ASSETS),
      createHtmlMetadataPlugin(metadata, MARKETING_PAGES),
      createMarketingFilesPlugin(metadata),
    ],
  }
})
