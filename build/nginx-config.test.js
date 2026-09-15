import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const app = readFileSync(new URL('../nginx.app.conf.template', import.meta.url), 'utf8')
const site = readFileSync(new URL('../nginx.site.conf', import.meta.url), 'utf8')

describe('marketing Nginx boundary', () => {
  it('serves directory indexes with real 404s and no application behavior', () => {
    expect(site).toContain('try_files $uri $uri/ =404;')
    expect(site).toContain('absolute_redirect off;')
    expect(site).not.toContain('proxy_pass')
    expect(site).not.toContain('sub_filter')
    expect(site).not.toContain('/app/index.html')
    expect(site).not.toContain('location = /sw.js')
  })

  it('matches development canonical redirects without generating HTTP locations', () => {
    for (const routeFragment of [
      '/index\\.html',
      '/home',
      '/about',
      '/memorization-is-a-spiritual-life-hack',
      '/tips-for-memorizing-scripture',
      '/import/biblememory',
      '/privacy',
    ]) {
      expect(site).toContain(routeFragment)
    }
    expect(site).toContain('/privacy(?:\\.html|/index\\.html)?')
    expect(site).toContain('return 301 $rum1n8_marketing_canonical_path$is_args$args;')
  })
})

describe('app Nginx boundary', () => {
  it('keeps the SPA fallback scoped to app routes', () => {
    expect(app).toMatch(/location = \/app\/ \{[\s\S]*try_files \/app\/index\.html =404;/)
    expect(app).toMatch(/location \/app\/ \{[\s\S]*try_files \$uri \$uri\/ \/app\/index\.html;/)
    expect(app).toMatch(/location = \/app\/index\.html \{[\s\S]*\$request_uri[\s\S]*return 301 \/app\/\$is_args\$args;/)
    expect(app).toMatch(/location \/ \{[\s\S]*try_files \$uri \$uri\/ =404;/)
  })

  it('keeps required PWA, OAuth, TWA, and WebDAV endpoints', () => {
    for (const endpoint of [
      '/sw.js',
      '/registerSW.js',
      '/manifest.webmanifest',
      '/gdrive-callback.html',
      '/.well-known/assetlinks.json',
      '/api/webdav',
    ]) {
      expect(app).toContain(endpoint)
    }
    expect(app).toContain('resolver 127.0.0.11 valid=30s ipv6=off;')
    expect(app).toContain('proxy_pass $webdav_proxy;')
  })

  it('redirects every old public route with its query string', () => {
    for (const route of [
      '/',
      '/index.html',
      '/home',
      '/about',
      '/memorization-is-a-spiritual-life-hack',
      '/tips-for-memorizing-scripture',
      '/import/biblememory',
      '/privacy',
      '/privacy.html',
    ]) {
      expect(app).toContain(`location = ${route} {`)
    }
    expect(app.match(/\$is_args\$args/g)?.length).toBeGreaterThanOrEqual(9)
  })

  it('preserves legacy root app-navigation queries', () => {
    expect(app).toContain('~*(^|&)(view|collection|verse|mode)(=|&|$) 1;')
    expect(app.match(/return 301 \/app\/\$is_args\$args;/g)?.length).toBeGreaterThanOrEqual(3)
  })
})
