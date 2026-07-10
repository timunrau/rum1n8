import { describe, expect, it } from 'vitest'
import { buildCollectionCSV } from './collection-csv.js'

const collection = (id, name, parentId = null) => ({ id, name, parentId })

const verse = (id, reference, collectionIds, overrides = {}) => ({
  id,
  reference,
  content: `${reference} content`,
  bibleVersion: 'NIV',
  collectionIds,
  interval: 60,
  nextReviewDate: '2026-08-01T00:00:00.000Z',
  ...overrides,
})

describe('buildCollectionCSV', () => {
  it('exports the selected collection subtree without personal progress or unrelated data', () => {
    const collections = [
      collection('family', 'Family'),
      collection('promises', 'Promises', 'family'),
      collection('empty', 'Empty Child', 'family'),
      collection('outside', 'Outside'),
    ]
    const verses = [
      verse('root', 'Psalm 1:1', ['family']),
      verse('child', 'John 3:16', ['promises']),
      verse('outside', 'Romans 8:28', ['outside']),
    ]

    const exported = buildCollectionCSV(collections, verses, 'family')

    expect(exported.filename).toBe('family-verses.csv')
    expect(exported.verseCount).toBe(2)
    expect(exported.collectionCount).toBe(2)
    expect(exported.rowCount).toBe(2)
    expect(exported.csv).toBe([
      '"Reference","Content","Version","CollectionPath"',
      '"John 3:16","John 3:16 content","NIV","Family/Promises"',
      '"Psalm 1:1","Psalm 1:1 content","NIV","Family"',
    ].join('\r\n'))
    expect(exported.csv).not.toContain('Interval')
    expect(exported.csv).not.toContain('Romans 8:28')
    expect(exported.csv).not.toContain('Empty Child')
  })

  it('writes repeated rows so the importer can preserve multiple collection memberships', () => {
    const collections = [
      collection('family', 'Family'),
      collection('grace', 'Grace', 'family'),
      collection('promises', 'Promises', 'family'),
    ]
    const verses = [verse('shared', 'Ephesians 2:8', ['grace', 'promises'])]

    const exported = buildCollectionCSV(collections, verses, 'family')

    expect(exported.verseCount).toBe(1)
    expect(exported.collectionCount).toBe(3)
    expect(exported.rowCount).toBe(2)
    expect(exported.csv).toContain('"Family/Grace"')
    expect(exported.csv).toContain('"Family/Promises"')
  })

  it('escapes commas, quotes, and newlines as valid CSV fields', () => {
    const collections = [collection('family', 'Family')]
    const verses = [verse('quoted', 'Psalm 23:1', ['family'], {
      content: 'The LORD is my shepherd, "I shall not want."\nHe leads me.',
    })]

    const exported = buildCollectionCSV(collections, verses, 'family')

    expect(exported.csv).toContain(
      '"The LORD is my shepherd, ""I shall not want.""\nHe leads me."'
    )
  })

  it('makes paths relative to the selected collection', () => {
    const collections = [
      collection('family', 'Family'),
      collection('values', 'Values', 'family'),
      collection('grace', 'Grace', 'values'),
    ]
    const verses = [verse('grace-verse', 'Titus 2:11', ['grace'])]

    const exported = buildCollectionCSV(collections, verses, 'values')

    expect(exported.csv).toContain('"Values/Grace"')
    expect(exported.csv).not.toContain('Family/Values/Grace')
  })
})
