import { readFileSync } from 'node:fs'
import { escapeHtml } from '../build/vite-shared.js'

const brand = `<a class="brand" href="/" aria-label="Ruminate home">
  <img class="brand__mark" src="/icons/icon-192x192.png" alt="" width="40" height="40" />
  <span class="brand__wordmark">
    <span class="brand__name">Ruminate</span>
    <span class="brand__descriptor">Bible Memory App</span>
  </span>
</a>`

const links = {
  home: '<a href="/">Home</a>',
  why: '<a href="/memorization-is-a-spiritual-life-hack/">Why Memorize?</a>',
  tips: '<a href="/tips-for-memorizing-scripture/">Tips</a>',
  spacing: '<a href="/spaced-repetition/">Spaced repetition</a>',
  import: '<a href="/import/biblememory/">Import</a>',
  privacy: '<a href="/privacy/">Privacy</a>',
  source: '<a href="https://github.com/timunrau/rum1n8" target="_blank" rel="noopener noreferrer" data-marketing-track="marketing_source_code_clicked">GitHub</a>',
  freelyGiven: `<a href="https://freely.giving" target="_blank" rel="noopener noreferrer" data-marketing-track="marketing_freely_given_clicked">
    <img class="footer-meta__badge" src="https://freely.giving/badges/fg_standard_pde.png" alt="Freely given: no conditions" width="150" height="42" />
  </a>`,
}

const backArrow = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
  <path stroke-linecap="round" stroke-linejoin="round" d="M19 12H5m0 0 6-6m-6 6 6 6" />
</svg>`

const homeArrow = '<svg class="home-arrow" aria-hidden="true"><use href="#home-arrow" /></svg>'

function returnBanner(appUrl) {
  return `<div class="app-return app-return--header" data-return-banner hidden>
    <a class="app-return__link" data-return-link href="${escapeHtml(appUrl)}" aria-label="Back to app" title="Back to app">
      ${backArrow}
      <span class="app-return__label">Back to app</span>
    </a>
  </div>`
}

export function header(appUrl) {
  return `<header class="site-header site-container">
    ${returnBanner(appUrl)}
    ${brand}
    <button class="site-menu-toggle" type="button" aria-label="Open navigation menu" aria-controls="site-navigation" aria-expanded="false" hidden>
      <svg class="site-menu-toggle__open" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
      <svg class="site-menu-toggle__close" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg>
    </button>
    <nav class="site-nav" id="site-navigation" aria-label="Main navigation">
      ${[links.why, links.tips, links.import, links.privacy, links.source].join('\n')}
    </nav>
  </header>`
}

export function appButton(appUrl, { label = 'Start memorizing', trackReturn = true, showArrow = false } = {}) {
  const labelAttrs = trackReturn ? ' data-app-link-label' : ''
  return `<a class="button button--primary" data-app-link href="${escapeHtml(appUrl)}"><span${labelAttrs}>${escapeHtml(label)}</span>${showArrow ? homeArrow : ''}</a>`
}

export function footer() {
  return `<footer class="site-footer site-container">
    ${brand}
    <nav class="footer-meta" aria-label="Footer navigation">
      ${Object.values(links).join('\n')}
    </nav>
  </footer>`
}

function callToAction(appUrl, anchor = 'start-today') {
  return `<section class="essay-section essay-section--final" id="${escapeHtml(anchor)}">
    <h2>Start ruminating</h2>
    <p>Pick one verse, practice daily, and gain momentum in your walk with God.</p>
    <p class="essay__action">${appButton(appUrl, { label: 'Try it out', trackReturn: false })}</p>
  </section>\n`
}

const partials = new Set(['biblememory-video', 'biblememory-exporter'])

export function renderPartial(name, { appUrl, file }, anchor) {
  if (name === 'start-ruminating') return callToAction(appUrl, anchor)
  if (name === 'start-memorizing') return `<p class="essay__action">${appButton(appUrl)}</p>\n`

  if (name === 'analytics-preference') {
    return `<label class="analytics-preference" hidden>
      <input type="checkbox" data-marketing-analytics-opt-out>
      <span>Do not load analytics on this marketing site in this browser.</span>
    </label>`
  }
  if (name === 'biblememory-import-action') {
    const target = new URL('?view=collections&import=csv', appUrl)
    return `<p class="essay__action"><a class="button button--primary" href="${escapeHtml(target.href)}">Open CSV Import</a></p>`
  }
  if (!partials.has(name)) throw new Error(`${file}: unknown site component "${name}".`)

  const html = readFileSync(new URL(`./partials/${name}.html`, import.meta.url), 'utf8')
  if (name !== 'biblememory-exporter') return html

  // Keep the exporter's separator as a JavaScript escape in both the link and copyable code.
  const bookmarklet = readFileSync(new URL('../scripts/biblememory-migration/bookmarklet.min.js', import.meta.url), 'utf8')
    .trim()
    .replaceAll('\x1f', '\\x1f')
  return html.replaceAll('@BOOKMARKLET@', () => escapeHtml(bookmarklet))
}
