import { readFileSync } from 'node:fs'
import MarkdownIt from 'markdown-it'
import { buildHtmlReplacements, escapeHtml } from '../build/vite-shared.js'
import { appButton, footer, header, renderPartial } from './components.js'
import { legacyCtaAnchors, legacySectionAnchors } from './section-anchors.js'

const markdown = new MarkdownIt()
const componentPattern = /^:::[ \t]+([a-z][a-z0-9-]*)[ \t]*$/
const standalonePartials = new Set(['start-ruminating', 'start-memorizing'])

// A standalone component line works alongside Markdown and stays literal in code blocks.
markdown.block.ruler.before('paragraph', 'site_component', (state, startLine, _endLine, silent) => {
  if (state.sCount[startLine] - state.blkIndent >= 4) return false
  const start = state.bMarks[startLine] + state.tShift[startLine]
  const match = componentPattern.exec(state.src.slice(start, state.eMarks[startLine]))
  if (!match) return false
  if (silent) return true

  const token = state.push('site_component', '', 0)
  token.content = match[1]
  state.line = startLine + 1
  return true
}, { alt: ['paragraph'] })

markdown.renderer.rules.site_component = (tokens, index, _options, context) => {
  const token = tokens[index]
  return renderPartial(token.content, context, token.meta?.anchor)
}

const renderImage = markdown.renderer.rules.image
markdown.renderer.rules.image = (tokens, index, options, context, renderer) => {
  const image = renderImage(tokens, index, options, context, renderer)
  const source = tokens[index].attrGet('src')
  const darkSource = source?.replace(/\.(?:png|jpe?g|webp|avif|svg)$/i, '-dark$&')
  if (!darkSource || darkSource === source || !context.staticAssets.has(darkSource)) return image

  return `<picture><source srcset="${escapeHtml(darkSource)}" media="(prefers-color-scheme: dark)">${image}</picture>`
}

function formatScriptureQuotes(tokens) {
  for (let index = tokens.length - 1; index >= 0; index--) {
    const opening = tokens[index]
    if (opening.type !== 'blockquote_open') continue

    opening.attrSet('class', 'scripture-quote')
    if (tokens[index + 2]?.content === '[!IMPORTANT]' && tokens[index + 3]?.type === 'paragraph_close') {
      opening.attrJoin('class', 'scripture-quote--major')
      tokens.splice(index + 1, 3)
    }
  }

  for (let index = tokens.length - 1; index >= 3; index--) {
    const close = tokens[index]
    const [paragraph, citation, endParagraph] = tokens.slice(index - 3, index)
    if (close.type !== 'blockquote_close' || paragraph.type !== 'paragraph_open'
      || endParagraph.type !== 'paragraph_close' || !citation.content.startsWith('— ')) continue

    citation.type = 'html_block'
    citation.content = `<footer class="scripture-quote__source"><cite>${escapeHtml(citation.content.slice(2))}</cite></footer>\n`
    tokens.splice(index - 3, 3, citation)
  }
}

function uniqueAnchor(base, anchors) {
  let id = base
  for (let suffix = 2; anchors.has(id); suffix++) id = `${base}-${suffix}`
  anchors.add(id)
  return id
}

function headingId(heading, anchors) {
  const text = heading.children.map((token) => token.content).join('')
  const slug = text.normalize('NFKD')
    .toLowerCase()
    .replace(/^\d+\.\s+/, '')
    .replace(/\p{Mark}/gu, '')
    .replace(/['’]/g, '')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-|-$/g, '')
  const base = /^\p{Letter}/u.test(slug) ? slug : `section${slug ? `-${slug}` : ''}`
  return uniqueAnchor(base, anchors)
}

function renderBody(page, context) {
  const tokens = markdown.parse(page.body, context)
  formatScriptureQuotes(tokens)

  const sections = []
  const aliases = legacySectionAnchors.get(page.slug)
  const anchors = new Set(['main', 'site-navigation', ...(aliases?.values() ?? [])])
  const ctaAnchor = legacyCtaAnchors.get(page.slug) || 'start-today'
  for (const token of tokens) {
    if (token.type === 'site_component' && token.content === 'start-ruminating') {
      token.meta = { anchor: uniqueAnchor(ctaAnchor, anchors) }
    }
  }
  for (const [index, token] of tokens.entries()) {
    if (token.type === 'site_component' && token.level === 0 && standalonePartials.has(token.content)) {
      sections.push({ index, standalone: true })
    }
    if (token.type !== 'heading_open') continue
    const id = headingId(tokens[index + 1], anchors)
    token.attrSet('id', id)
    if (token.level === 0 && token.tag === 'h2') sections.push({ index, alias: aliases?.get(id) })
  }

  const render = (items) => markdown.renderer.render(items, markdown.options, context)
  if (!sections.length) return render(tokens)

  const intro = render(tokens.slice(0, sections[0].index))
  return intro + sections.map(({ index, alias, standalone }, position) => {
    const end = sections[position + 1]?.index ?? tokens.length
    const content = render(tokens.slice(index, end))
    if (standalone) return content
    return `<section class="essay-section"${alias ? ` id="${alias}"` : ''}>
  ${content}
</section>\n`
  }).join('')
}

function article(page, appUrl, staticAssets) {
  const context = { appUrl, file: page.file, staticAssets }
  const body = renderBody(page, context)

  return `<main class="site-main site-main--essay" id="main">
    <article class="essay">
      <header class="essay__hero">
        <h1>${escapeHtml(page.title)}</h1>
      </header>
      <div class="essay__body">
        ${body}
      </div>
    </article>
  </main>`
}

export function renderPage(page, metadata, staticAssets) {
  const isHome = page.path === '/'
  const values = buildHtmlReplacements(metadata, page)
  const lightTheme = isHome ? '#fbf8f2' : '#fbf7ef'
  const darkTheme = isHome ? '#181b17' : '#08101b'
  const content = isHome
    ? readFileSync(new URL('./home.html', import.meta.url), 'utf8')
      .replaceAll('@APP_BUTTON@', () => appButton(metadata.appUrl, { showArrow: true }))
    : article(page, metadata.appUrl, staticAssets)

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="${lightTheme}" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="${darkTheme}" media="(prefers-color-scheme: dark)" />
    <link rel="icon" type="image/png" href="/icons/icon-192x192.png" />
    <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
    <meta name="robots" content="${values['%META_ROBOTS%']}" />
    <meta name="description" content="${values['%PAGE_DESCRIPTION%']}" />
    ${values['%HEAD_CANONICAL_TAGS%']}
    ${values['%HEAD_SOCIAL_TAGS%']}
    ${values['%HEAD_JSON_LD%']}
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&amp;family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,500;0,7..72,600;0,7..72,700;1,7..72,400;1,7..72,500;1,7..72,600&amp;family=Source+Sans+3:wght@400;500;600;700&amp;display=swap" />
    <link rel="stylesheet" href="/marketing.css" />
    ${isHome ? '<link rel="stylesheet" href="/home.css" />' : ''}
    <title>${values['%PAGE_TITLE%']}</title>
  </head>
  <body${isHome ? ' class="site-home"' : ''} data-app-url="${escapeHtml(metadata.appUrl)}">
    <a class="site-skip-link" href="#main">Skip to content</a>
    ${isHome ? `<svg class="home-icon-definitions" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <symbol id="home-arrow" viewBox="0 0 24 24">
        <path d="M4 12h16m-7-7 7 7-7 7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
      </symbol>
    </svg>` : ''}
    <div class="site-shell">
      ${header(metadata.appUrl)}
      ${content}
      ${footer()}
    </div>
    <script type="module" src="/marketing.js"></script>
  </body>
</html>
`
}
