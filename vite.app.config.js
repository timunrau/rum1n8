import { readFileSync } from 'node:fs'
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

const packageJson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

const APP_PAGE = Object.freeze({
  page: 'app',
  inputName: 'app',
  inputFile: 'app/index.html',
  path: APP_PATH,
})

const ICONS = [48, 72, 96, 128, 144, 152, 192, 256, 384, 512]
  .map((size) => `icons/icon-${size}x${size}.png`)

const APP_STATIC_ASSETS = [
  ...ICONS,
  '.well-known/assetlinks.json',
  'gdrive-callback.html',
  'marketing/screenshot-empty.png',
  'marketing/screenshot-practice.png',
  'marketing/screenshot-review.png',
]

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
          icons: ICONS.map((path) => ({
            src: path,
            sizes: path.match(/icon-(\d+x\d+)/)[1],
            type: 'image/png',
            purpose: 'any maskable',
          })),
        },
        workbox: {
          cleanupOutdatedCaches: true,
          globPatterns: ['app/**/*.html', 'assets/*.{js,css}', 'icons/*.png'],
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
