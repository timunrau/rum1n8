import { describe, expect, it } from 'vitest'
import { buildHtmlReplacements, buildSiteMetadata } from './vite.config.js'

describe('vite HTML metadata replacements', () => {
  const siteMetadata = buildSiteMetadata({
    VITE_SITE_URL: 'https://rum1n8.example',
  })

  it('sets canonical and indexable metadata for the marketing page', () => {
    const replacements = buildHtmlReplacements(siteMetadata, 'marketing')

    expect(replacements['%META_ROBOTS%']).toBe('index,follow')
    expect(replacements['%HEAD_CANONICAL_TAGS%']).toContain(
      '<link rel="canonical" href="https://rum1n8.example/" />'
    )
    expect(replacements['%HEAD_CANONICAL_TAGS%']).toContain(
      '<meta property="og:url" content="https://rum1n8.example/" />'
    )
    expect(replacements['%HEAD_SOCIAL_TAGS%']).toContain('og:image')
    expect(replacements['%HEAD_JSON_LD%']).toContain('SoftwareApplication')
  })

  it('sets noindex metadata for the about page while keeping the root canonical', () => {
    const replacements = buildHtmlReplacements(siteMetadata, 'about')

    expect(replacements['%META_ROBOTS%']).toBe('noindex,follow')
    expect(replacements['%HEAD_CANONICAL_TAGS%']).toContain(
      '<link rel="canonical" href="https://rum1n8.example/" />'
    )
    expect(replacements['%HEAD_SOCIAL_TAGS%']).toContain('twitter:card')
    expect(replacements['%HEAD_JSON_LD%']).toBe('')
  })

  it('sets noindex metadata for the app page without canonical or social tags', () => {
    const replacements = buildHtmlReplacements(siteMetadata, 'app')

    expect(replacements['%META_ROBOTS%']).toBe('noindex,nofollow')
    expect(replacements['%HEAD_CANONICAL_TAGS%']).toBe('')
    expect(replacements['%HEAD_SOCIAL_TAGS%']).toBe('')
    expect(replacements['%HEAD_JSON_LD%']).toBe('')
  })
})
