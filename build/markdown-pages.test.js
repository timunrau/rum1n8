import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readMarkdownPages } from '../site/content.js'
import { renderPage } from '../site/templates.js'
import { buildSiteMetadata, createMarketingFilesPlugin, homePageMetadata } from './vite-shared.js'

const metadata = buildSiteMetadata({
  VITE_APP_URL: 'https://app.example.test/app/',
  VITE_MARKETING_URL: 'https://site.example.test/',
}, 'production')

const sample = `---
slug: learning/a-new-page
title: Reading & recall
description: 'A guide to "daily review".'
structuredData: article
---

An opening paragraph with **emphasis**.

## 1. Choose a passage

![Study notes](/images/study-notes.svg)

::: start-ruminating

## 2. Choose a passage

~~~text
::: start-ruminating
~~~
`

describe('Markdown page generation', () => {
  let directory

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'rum1n8-markdown-'))
    mkdirSync(join(directory, 'drafts'))
    writeFileSync(join(directory, 'drafts', 'sample.md'), sample)
  })

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true })
  })

  it('discovers and renders a new page with shared structure and escaped metadata', () => {
    const pages = readMarkdownPages(directory)
    expect([...pages.keys()]).toEqual(['/learning/a-new-page/'])
    const html = renderPage(pages.values().next().value, metadata, new Set())

    expect(html).toContain('<header class="site-header site-container">')
    expect(html).toContain('<article class="essay">')
    expect(html).toContain('<footer class="site-footer site-container">')
    expect(html).toContain('<script type="module" src="/marketing.js"></script>')
    expect(html).toContain('<h1>Reading &amp; recall</h1>')
    expect(html).toContain('content="A guide to &quot;daily review&quot;."')
    expect(html).toContain('<link rel="canonical" href="https://site.example.test/learning/a-new-page/"')
    expect(html).toContain('"@type":"Article"')
    expect(html).toContain('<p>An opening paragraph with <strong>emphasis</strong>.</p>')
    expect(html).toContain('<h2 id="choose-a-passage">1. Choose a passage</h2>')
    expect(html).toContain('<h2 id="choose-a-passage-2">2. Choose a passage</h2>')
    expect(html).toContain('<img src="/images/study-notes.svg" alt="Study notes">')
    expect(html).toMatch(/<\/section>\s*<section class="essay-section essay-section--final" id="start-today">/)
    expect(html).toContain('<code class="language-text">::: start-ruminating')
  })

  it('adds a registered dark variant without custom Markdown image syntax', () => {
    const page = readMarkdownPages(directory).values().next().value
    const html = renderPage(page, metadata, new Set(['/images/study-notes-dark.svg']))
    expect(html).toContain('<picture><source srcset="/images/study-notes-dark.svg" media="(prefers-color-scheme: dark)"><img src="/images/study-notes.svg" alt="Study notes"></picture>')
  })

  it('includes newly discovered pages in the sitemap', () => {
    const pages = [homePageMetadata(metadata), ...readMarkdownPages(directory).values()]
    const emitFile = vi.fn()
    createMarketingFilesPlugin(metadata, pages).generateBundle.call({ emitFile })

    expect(emitFile).toHaveBeenCalledWith(expect.objectContaining({
      fileName: 'sitemap.xml',
      source: expect.stringContaining('<loc>https://site.example.test/learning/a-new-page/</loc>'),
    }))
  })

  it('rejects duplicate slugs across content folders', () => {
    writeFileSync(join(directory, 'duplicate.md'), sample)
    expect(() => readMarkdownPages(directory)).toThrow('duplicate slug "learning/a-new-page"')
  })

  it('rejects slugs that can escape the page directory', () => {
    writeFileSync(join(directory, 'unsafe.md'), sample.replace('learning/a-new-page', '../outside'))
    expect(() => readMarkdownPages(directory)).toThrow('invalid or reserved slug "../outside"')
  })
})
