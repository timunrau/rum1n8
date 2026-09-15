import { describe, expect, it } from 'vitest'
import { buildHtmlReplacements, buildSiteMetadata, resolvePublicUrls } from './vite-shared.js'

const productionEnv = {
  VITE_APP_URL: 'https://rum1n8.unrau.xyz/app/',
  VITE_MARKETING_URL: 'https://remember.example/',
}

describe('public URL validation', () => {
  it('accepts the permanent app path and a root marketing origin', () => {
    expect(resolvePublicUrls(productionEnv, 'production')).toEqual({
      appUrl: 'https://rum1n8.unrau.xyz/app/',
      marketingUrl: 'https://remember.example/',
    })
  })

  it.each([
    [{ ...productionEnv, VITE_APP_URL: '' }, 'VITE_APP_URL is required'],
    [{ ...productionEnv, VITE_MARKETING_URL: '' }, 'VITE_MARKETING_URL is required'],
    [{ ...productionEnv, VITE_APP_URL: 'http://rum1n8.unrau.xyz/app/' }, 'must use HTTPS'],
    [{ ...productionEnv, VITE_APP_URL: 'https://rum1n8.unrau.xyz/' }, 'must use the path /app/'],
    [{ ...productionEnv, VITE_MARKETING_URL: 'https://remember.example/site/' }, 'must use the path /'],
  ])('rejects invalid production URLs', (env, message) => {
    expect(() => resolvePublicUrls(env, 'production')).toThrow(message)
  })
})

describe('marketing metadata', () => {
  const metadata = buildSiteMetadata(productionEnv, 'production')

  it('uses a unique canonical URL and description for Privacy', () => {
    const replacements = buildHtmlReplacements(metadata, 'privacy')

    expect(replacements['%PAGE_TITLE%']).toBe('Privacy Policy - rum1n8')
    expect(replacements['%PAGE_DESCRIPTION%']).toContain('analytics preference')
    expect(replacements['%HEAD_CANONICAL_TAGS%']).toContain('https://remember.example/privacy/')
    expect(replacements['%HEAD_SOCIAL_TAGS%']).toContain('twitter:card')
  })

  it('keeps the app noindex without marketing social metadata', () => {
    const replacements = buildHtmlReplacements(metadata, 'app')

    expect(replacements['%META_ROBOTS%']).toBe('noindex,nofollow')
    expect(replacements['%HEAD_CANONICAL_TAGS%']).toBe('')
    expect(replacements['%HEAD_SOCIAL_TAGS%']).toBe('')
  })
})
