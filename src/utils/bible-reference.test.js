import { describe, expect, it } from 'vitest'
import { findReferenceMatches, formatReferenceMatchSummary, parseSimpleVerseReference } from './bible-reference.js'

describe('parseSimpleVerseReference', () => {
  it('parses abbreviated book names and numbered books', () => {
    expect(parseSimpleVerseReference('Jn 3:16')).toMatchObject({
      bookId: 'jhn',
      chapter: 3,
      verseStart: 16,
      verseEnd: 16,
      normalized: 'jhn 3:16'
    })

    expect(parseSimpleVerseReference('1 John 1:9')).toMatchObject({
      bookId: '1jn',
      chapter: 1,
      verseStart: 9,
      verseEnd: 9,
      normalized: '1jn 1:9'
    })
  })
})

describe('findReferenceMatches', () => {
  const verses = [
    { id: 'exact', reference: 'John 3:16', bibleVersion: 'ESV' },
    { id: 'overlap', reference: 'John 3:16-17', bibleVersion: 'NIV' },
    { id: 'other', reference: 'Psalm 23:1', bibleVersion: 'BSB' },
  ]

  it('returns exact and overlapping matches across normalized references', () => {
    expect(findReferenceMatches('Jn 3:16', verses)).toEqual([
      { id: 'exact', reference: 'John 3:16', bibleVersion: 'ESV', matchType: 'exact' },
      { id: 'overlap', reference: 'John 3:16-17', bibleVersion: 'NIV', matchType: 'overlap' }
    ])
  })

  it('detects overlap in the wider-reference direction too', () => {
    expect(findReferenceMatches('John 3:16-17', [{ id: 'single', reference: 'Jn 3:16', bibleVersion: 'ESV' }])).toEqual([
      { id: 'single', reference: 'Jn 3:16', bibleVersion: 'ESV', matchType: 'overlap' }
    ])
  })

  it('excludes the verse being edited', () => {
    expect(findReferenceMatches('John 3:16', verses, { excludeVerseId: 'exact' })).toEqual([
      { id: 'overlap', reference: 'John 3:16-17', bibleVersion: 'NIV', matchType: 'overlap' }
    ])
  })
})

describe('formatReferenceMatchSummary', () => {
  it('includes every matching reference with its Bible version', () => {
    expect(formatReferenceMatchSummary([
      { reference: 'John 3:16', bibleVersion: 'ESV' },
      { reference: 'John 3:16-17', bibleVersion: 'NIV' },
      { reference: 'Psalm 23:1', bibleVersion: '' }
    ])).toBe('Already in your library: John 3:16 (ESV); John 3:16-17 (NIV); Psalm 23:1 (no version)')
  })
})
