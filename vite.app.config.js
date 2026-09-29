import { readFileSync, statSync, createReadStream } from 'node:fs'
import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig, loadEnv } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import {
  APP_PATH,
  buildSiteMetadata,
  createHealthFilePlugin,
  createHtmlMetadataPlugin,
  createStaticAssetsPlugin,
  serverHost,
} from './build/vite-shared.js'
import { VOICE_MODEL_ASSETS, VOICE_MODEL_BASE_PATH, VOICE_MODEL_NOTICE_FILE } from './build/voice-model.mjs'

const packageJson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

const APP_PAGE = Object.freeze({
  page: 'app',
  inputName: 'app',
  inputFile: 'app/index.html',
  path: APP_PATH,
})

const ICON_SIZES = [48, 72, 96, 128, 144, 152, 192, 256, 384, 512]
const ICONS = ICON_SIZES.flatMap((size) => [
  { src: `icons/icon-${size}x${size}.png`, purpose: 'any' },
  { src: `icons/icon-maskable-${size}x${size}.png`, purpose: 'maskable' },
])

const APP_STATIC_ASSETS = [
  ...ICONS.map(({ src }) => src),
  '.well-known/assetlinks.json',
  'gdrive-callback.html',
  'marketing/screenshot-empty.png',
  'marketing/screenshot-practice.png',
  'marketing/screenshot-review.png',
]

const VOICE_MODEL_DEV_TYPES = {
  '.js': 'text/javascript',
  '.wasm': 'application/wasm',
  '.data': 'application/octet-stream',
  '.md': 'text/markdown',
}

// Serve the exact bytes `npm run voice-model:prepare` staged, so `npm run
// dev:app` exercises the real payload without a production deploy. A missing
// model file must 404 here exactly as it does behind nginx; the app shell is a
// wrong answer for a model request because it would fail as a Wasm fetch.
function createVoiceModelDevPlugin() {
  const root = resolve(process.cwd(), `dist-app${VOICE_MODEL_BASE_PATH}`)
  return {
    name: 'rum1n8-voice-model-dev',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const [pathname, query] = (req.url || '').split('?')
        if (!pathname.startsWith(`${VOICE_MODEL_BASE_PATH}/`)) return next()

        const name = pathname.slice(VOICE_MODEL_BASE_PATH.length + 1)
        const allowed = new Set([...VOICE_MODEL_ASSETS.map(asset => asset.file), VOICE_MODEL_NOTICE_FILE])
        if (!allowed.has(name)) {
          res.statusCode = 404
          res.setHeader('Content-Type', 'text/plain')
          res.end('voice model asset not found')
          return
        }

        const file = resolve(root, name)
        if (!file.startsWith(root) || !statSync(file, { throwIfNoEntry: false })) {
          res.statusCode = 404
          res.setHeader('Content-Type', 'text/plain')
          res.end('run: npm run voice-model:prepare')
          return
        }

        res.statusCode = 200
        res.setHeader('Content-Type', VOICE_MODEL_DEV_TYPES[name.slice(name.lastIndexOf('.'))] || 'application/octet-stream')
        res.setHeader('Content-Length', statSync(file).size)
        res.setHeader('Cache-Control', 'no-store')
        res.setHeader('X-Content-Type-Options', 'nosniff')
        createReadStream(file).pipe(res)
      })
    },
  }
}


export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const metadata = buildSiteMetadata(env, mode)

  return {
    publicDir: false,
    define: {
      __APP_VERSION__: JSON.stringify(packageJson.version),
    },
    server: {
      host: serverHost(),
      port: 5173,
      strictPort: true,
      watch: { ignored: ['**/dist-app/**', '**/dist-site/**', '**/dev-dist/**'] },
      proxy: {
        '/api/webdav': {
          target: 'http://127.0.0.1:3001',
          changeOrigin: true,
        },
      },
    },
    test: {
      exclude: ['e2e/**', '**/e2e/**', 'node_modules/**', 'android-twa/**', '.claude/**'],
    },
    build: {
      outDir: 'dist-app',
      emptyOutDir: true,
      rollupOptions: {
        input: { app: resolve(process.cwd(), APP_PAGE.inputFile) },
      },
    },
    plugins: [
      {
        name: 'app-route-canonicalization',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            const [pathname, query] = (req.url || '').split('?')
            if (pathname === '/' || pathname === '/index.html') {
              const params = new URLSearchParams(query || '')
              const legacyAppQuery = [...params.keys()].some((name) => (
                ['view', 'collection', 'verse', 'mode'].includes(name.toLowerCase())
              ))
              const target = legacyAppQuery ? '/app/' : metadata.marketingUrl

              res.statusCode = 301
              res.setHeader('Location', `${target}${query ? `?${query}` : ''}`)
              res.end()
              return
            }

            if (pathname !== '/app' && pathname !== '/app/index.html') return next()

            res.statusCode = 301
            res.setHeader('Location', `/app/${query ? `?${query}` : ''}`)
            res.end()
          })
        },
      },
      createStaticAssetsPlugin(APP_STATIC_ASSETS),
      createVoiceModelDevPlugin(),
      createHealthFilePlugin(),
      tailwindcss(),
      vue(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icons/icon-192x192.png'],
        manifest: {
          id: '/',
          name: metadata.applicationName,
          short_name: metadata.shortName,
          description: metadata.defaultDescription,
          theme_color: '#F1EEE8',
          background_color: '#F1EEE8',
          display: 'standalone',
          display_override: ['standalone', 'minimal-ui', 'browser'],
          orientation: 'portrait',
          start_url: APP_PATH,
          scope: '/',
          categories: ['education', 'lifestyle', 'productivity'],
          screenshots: [
            { src: 'marketing/screenshot-empty.png', sizes: '1080x1920', type: 'image/png', form_factor: 'narrow', label: 'Verse library view' },
            { src: 'marketing/screenshot-practice.png', sizes: '1080x1920', type: 'image/png', form_factor: 'narrow', label: 'Practice mode view' },
            { src: 'marketing/screenshot-review.png', sizes: '1080x1920', type: 'image/png', form_factor: 'narrow', label: 'Review list view' },
          ],
          shortcuts: [
            { name: 'Collections', short_name: 'Collections', description: 'Open your verse library', url: '/app/?view=collections', icons: [{ src: 'icons/icon-192x192.png', sizes: '192x192', type: 'image/png' }] },
            { name: 'Review', short_name: 'Review', description: 'Open verses due for review', url: '/app/?view=review-list', icons: [{ src: 'icons/icon-192x192.png', sizes: '192x192', type: 'image/png' }] },
            { name: 'Stats', short_name: 'Stats', description: 'Open memorization stats', url: '/app/?view=stats', icons: [{ src: 'icons/icon-192x192.png', sizes: '192x192', type: 'image/png' }] },
          ],
          icons: ICONS.map(({ src, purpose }) => ({
            src,
            sizes: src.match(/(\d+x\d+)/)[1],
            type: 'image/png',
            purpose,
          })),
        },
        workbox: {
          cleanupOutdatedCaches: true,
          // The voice model is ~195 MiB and is fetched on demand into its own
          // Cache Storage bucket (see src/utils/voice/model-store.js). It must
          // never join the install precache, or every app install would pay for
          // a download that most users never ask for.
          globPatterns: ['app/**/*.html', 'assets/*.{js,css}', 'icons/*.png'],
          globIgnores: ['**/voice-model/**'],
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
          navigateFallback: '/app/index.html',
          navigateFallbackAllowlist: [/^\/app(?:\/.*)?$/],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
        devOptions: { enabled: true, type: 'module' },
      }),
      createHtmlMetadataPlugin(metadata, [APP_PAGE]),
    ],
  }
})
