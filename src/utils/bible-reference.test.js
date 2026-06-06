import { describe, expect, it } from 'vitest'
import {
  areVerseSpansContiguous,
  combineVerseSpans,
  findReferenceMatches,
  formatReferenceMatchSummary,
  getBibleBookSuggestion,
  normalizeVerseReference,
  parseSimpleVerseReference,
  parseVerseSpanReference
} from './bible-reference.js'

describe('getBibleBookSuggestion', () => {
  it('suggests clear book completions as soon as the prefix is unambiguous', () => {
    expect(getBibleBookSuggestion('joh')).toMatchObject({ name: 'John' })
    expect(getBibleBookSuggestion('ps')).toMatchObject({ name: 'Psalms' })
    expect(getBibleBookSuggestion('1 Cor')).toMatchObject({ name: '1 Corinthians' })
    expect(getBibleBookSuggestion('2 Cor')).toMatchObject({ name: '2 Corinthians' })
  })

  it('does not suggest ambiguous book prefixes', () => {
    expect(getBibleBookSuggestion('j')).toBeNull()
    expect(getBibleBookSuggestion('jo')).toBeNull()
    expect(getBibleBookSuggestion('phil')).toBeNull()
  })

  it('distinguishes Philippians from Philemon once the input is specific enough', () => {
    expect(getBibleBookSuggestion('phili')).toMatchObject({ name: 'Philippians' })
    expect(getBibleBookSuggestion('phile')).toMatchObject({ name: 'Philemon' })
  })

  it('does not autocomplete chapter or verse numbers', () => {
    expect(getBibleBookSuggestion('John 3')).toBeNull()
    expect(getBibleBookSuggestion('John 3:16')).toBeNull()
    expect(getBibleBookSuggestion('John 3:16-17')).toBeNull()
  })

  it('does not suggest aliases or trailing-space input that will normalize later', () => {
    expect(getBibleBookSuggestion('jn')).toBeNull()
    expect(getBibleBookSuggestion('ps ')).toBeNull()
    expect(getBibleBookSuggestion('jn ')).toBeNull()
    expect(getBibleBookSuggestion('1 Cor ')).toBeNull()
  })
})

describe('parseSimpleVerseReference', () => {
  it('parses abbreviated book names and numbered books', () => {
    expect(parseSimpleVerseReference('Jn 3:16')).toMatchObject({
      bookName: 'John',
      bookId: 'jhn',
      chapter: 3,
      verseStart: 16,
      verseEnd: 16,
      canonicalReference: 'John 3:16',
      normalized: 'jhn 3:16'
    })

    expect(parseSimpleVerseReference('1 John 1:9')).toMatchObject({
      bookName: '1 John',
      bookId: '1jn',
      chapter: 1,
      verseStart: 9,
      verseEnd: 9,
      canonicalReference: '1 John 1:9',
      normalized: '1jn 1:9'
    })

    expect(parseSimpleVerseReference('1 Cor 13:4')).toMatchObject({
      bookName: '1 Corinthians',
      bookId: '1co',
      chapter: 13,
      verseStart: 4,
      verseEnd: 4,
      canonicalReference: '1 Corinthians 13:4',
      normalized: '1co 13:4'
    })
  })

  it('rejects ambiguous book names instead of guessing', () => {
    expect(parseSimpleVerseReference('Phil 1:6')).toBeNull()
  })

  it('rejects malformed and unsupported reference formats', () => {
    expect(parseSimpleVerseReference('John')).toBeNull()
    expect(parseSimpleVerseReference('John 3')).toBeNull()
    expect(parseSimpleVerseReference('John :16')).toBeNull()
    expect(parseSimpleVerseReference('Foo 1:1')).toBeNull()
    expect(parseSimpleVerseReference('John 3:16,18')).toBeNull()
    expect(parseSimpleVerseReference('John 3:16-4:2')).toBeNull()
  })
})

describe('normalizeVerseReference', () => {
  it('canonicalizes aliases, casing, and numbered book names', () => {
    expect(normalizeVerseReference('jn 3:16')).toBe('John 3:16')
    expect(normalizeVerseReference('john 3:16')).toBe('John 3:16')
    expect(normalizeVerseReference('1jn 1:9')).toBe('1 John 1:9')
    expect(normalizeVerseReference('first john 1:9')).toBe('1 John 1:9')
  })

  it('normalizes obvious spacing around chapters, verses, and ranges', () => {
    expect(normalizeVerseReference('john   3 : 16')).toBe('John 3:16')
    expect(normalizeVerseReference('john 3:16 - 17')).toBe('John 3:16-17')
    expect(normalizeVerseReference('john 3:36 - 4 : 2')).toBe('John 3:36-4:2')
  })

  it('normalizes only valid supported references', () => {
    expect(normalizeVerseReference('phil 1:6')).toBe('')
    expect(normalizeVerseReference('John 3:16,18')).toBe('')
  })
})

describe('parseVerseSpanReference', () => {
  it('parses same-chapter and cross-chapter verse spans', () => {
    expect(parseVerseSpanReference('John 3:16-18')).toMatchObject({
      bookId: 'jhn',
      startChapter: 3,
      startVerse: 16,
      endChapter: 3,
      endVerse: 18,
      canonicalReference: 'John 3:16-18',
      totalVerses: 3
    })

    expect(parseVerseSpanReference('John 3:36-4:2')).toMatchObject({
      bookId: 'jhn',
      startChapter: 3,
      startVerse: 36,
      endChapter: 4,
      endVerse: 2,
      canonicalReference: 'John 3:36-4:2',
      totalVerses: 3
    })
  })

  it('rejects malformed, non-contiguous, and out-of-bounds spans', () => {
    expect(parseVerseSpanReference('John 3:16,18')).toBeNull()
    expect(parseVerseSpanReference('John 3:36-4')).toBeNull()
    expect(parseVerseSpanReference('John 3:37')).toBeNull()
    expect(parseVerseSpanReference('John 4:2-3:36')).toBeNull()
  })
})

describe('verse span continuity helpers', () => {
  it('detects adjacency inside a chapter and across chapter boundaries', () => {
    expect(areVerseSpansContiguous('John 3:16', 'John 3:17')).toBe(true)
    expect(areVerseSpansContiguous('John 3:16-17', 'John 3:18')).toBe(true)
    expect(areVerseSpansContiguous('John 3:36', 'John 4:1')).toBe(true)
  })

  it('rejects gaps and different books', () => {
    expect(areVerseSpansContiguous('John 3:16', 'John 3:18')).toBe(false)
    expect(areVerseSpansContiguous('John 3:36', 'Romans 4:1')).toBe(false)
  })

  it('combines contiguous spans into one canonical reference', () => {
    expect(combineVerseSpans([
      parseVerseSpanReference('John 3:36'),
      parseVerseSpanReference('John 4:1-2')
    ])).toMatchObject({
      canonicalReference: 'John 3:36-4:2',
      totalVerses: 3
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
