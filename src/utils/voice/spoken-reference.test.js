import { describe, expect, it } from 'vitest'
import { buildReferencePracticeUnits } from '../reference-typing.js'
import { getVerseWords } from '../verse-words.js'
import { VOICE_BRIDGED, VOICE_HEARD, VOICE_REPLACED } from './matcher.js'
import { matchSpokenReference, parseSpokenReference, supportedSpokenReference } from './spoken-reference.js'

const heard = index => ({ index, incorrect: false, accepted: VOICE_HEARD })
const bridged = index => ({ index, incorrect: false, accepted: VOICE_BRIDGED })
const replaced = index => ({ index, incorrect: true, accepted: VOICE_REPLACED })
const heardAll = indices => indices.map(heard)

const referenceUnits = reference => buildReferencePracticeUnits(reference)

const practiceUnits = (content, reference) => {
  const words = getVerseWords(content).map((entry, index) => ({ text: entry.text, index }))
  const offset = words.length
  return [...words, ...referenceUnits(reference).map(unit => ({ ...unit, index: offset + unit.index }))]
}

const numbers = (text) => parseSpokenReference(text).numbers.map(number => number.value)
const bookId = text => parseSpokenReference(text).book?.id

describe('supportedSpokenReference', () => {
  it('accepts verse and chapter references and exposes the canonical form', () => {
    expect(supportedSpokenReference('John 3:16')).toMatchObject({ bookId: 'jhn', canonicalReference: 'John 3:16' })
    expect(supportedSpokenReference('John 3')).toMatchObject({ bookId: 'jhn', isWholeChapter: true })
    expect(supportedSpokenReference('1 Corinthians 12:13')).toMatchObject({ bookId: '1co' })
  })

  it('accepts a verse range and en-dash spelling', () => {
    expect(supportedSpokenReference('John 3:16-18')).toMatchObject({ verseStart: 16, verseEnd: 18 })
    expect(supportedSpokenReference('Psalm 119:105–106')).toMatchObject({ verseStart: 105, verseEnd: 106 })
  })

  it('rejects a non-Bible or blank reference', () => {
    expect(supportedSpokenReference('Scroll 1:1')).toBeNull()
    expect(supportedSpokenReference('')).toBeNull()
  })
})

describe('parseSpokenReference', () => {
  it('parses a book with spoken chapter and verse numbers', () => {
    expect(bookId('John three sixteen')).toBe('jhn')
    expect(numbers('John three sixteen')).toEqual(['3', '16'])
  })

  it('parses a numeric digit run without splitting it from the expected answer', () => {
    expect(numbers('John 3 16')).toEqual(['3', '16'])
  })

  it('is case insensitive and accepts typed punctuation', () => {
    expect(numbers('john three: sixteen')).toEqual(['3', '16'])
  })

  it('resolves a numbered book from its ordinal spoken name', () => {
    expect(bookId('First Corinthians twelve thirteen')).toBe('1co')
    expect(numbers('First Corinthians twelve thirteen')).toEqual(['12', '13'])
    expect(bookId('1 John 4 nineteen')).toBe('1jn')
  })

  it('keeps a multi-digit chapter together when it is spoken as one number', () => {
    expect(numbers('Psalm one hundred nineteen one five through one six'))
      .toEqual(['119', '1', '5', '1', '6'])
  })

  it('records a range marker between the numbers it separates', () => {
    expect(parseSpokenReference('John three sixteen through eighteen').cues).toEqual([{ range: 2 }])
    expect(parseSpokenReference('john three sixteen to eighteen').cues).toEqual([{ range: 2 }])
  })

  it('records explicit chapter and verse cues', () => {
    expect(parseSpokenReference('John chapter three verse sixteen').numbers)
      .toEqual([{ value: '3', cue: 'chapter' }, { value: '16', cue: 'verse' }])
    expect(parseSpokenReference('John verse sixteen').numbers).toEqual([{ value: '16', cue: 'verse' }])
  })

  it('keeps the latest occurrence when the book is restarted mid-utterance', () => {
    const parsed = parseSpokenReference('John three sixteen John three sixteen')

    expect(parsed.book.id).toBe('jhn')
    expect(numbers('John three sixteen John three sixteen')).toEqual(['3', '16'])
  })

  it('stays pending when the utterance has no book and no structural cue', () => {
    expect(parseSpokenReference('three sixteen')).toEqual({ pending: true })
    expect(parseSpokenReference('blah blah three sixteen')).toEqual({ pending: true })
    expect(parseSpokenReference('John').pending).toBe(true)
  })

  it('refuses a number outside Bible chapter or verse range', () => {
    expect(parseSpokenReference('John three one hundred seventy seven')).toEqual({ ambiguous: true })
  })
})

describe('matchSpokenReference', () => {
  it('accepts every unit of a correctly spoken reference', () => {
    const result = matchSpokenReference(practiceUnits('', 'John 3:16'), 0, 'John 3:16', 'John three sixteen')

    expect(result.decisions).toEqual(heardAll([0, 1, 2]))
  })

  it('accepts a numbered book spoken as an ordinal', () => {
    const units = practiceUnits('', '1 Corinthians 12:13')
    const result = matchSpokenReference(units, 0, '1 Corinthians 12:13', 'first corinthians twelve thirteen')

    expect(result.decisions).toEqual(heardAll([0, 1, 2, 3]))
  })

  it('gives a nearby number the benefit of the doubt', () => {
    const result = matchSpokenReference(practiceUnits('', 'John 3:16'), 0, 'John 3:16', 'John three seventeen')

    expect(result.decisions).toEqual([heard(0), heard(1), bridged(2)])
    expect(result.decisions.every(decision => !decision.incorrect)).toBe(true)
    expect(matchSpokenReference(practiceUnits('', 'John 3:16'), 0, 'John 3:16', 'John three six').decisions)
      .toEqual([heard(0), heard(1), bridged(2)])
  })

  it('marks an explicit different book as a mistake without flagging matching numbers', () => {
    const result = matchSpokenReference(practiceUnits('', 'John 3:16'), 0, 'John 3:16', 'Mark three sixteen')

    expect(result.decisions).toEqual([replaced(0), heard(1), heard(2)])
  })

  it('marks a distant spoken number as a mistake', () => {
    const result = matchSpokenReference(practiceUnits('', 'John 3:16'), 0, 'John 3:16', 'John three ninety nine')

    expect(result.decisions).toEqual([heard(0), heard(1), replaced(2)])
  })

  it('returns only decisions at or after the supplied start index', () => {
    const units = practiceUnits('One two three', 'John 3:16')
    const result = matchSpokenReference(units, 3, 'John 3:16', 'John three sixteen')

    expect(result.decisions).toEqual(heardAll([3, 4, 5]))
  })

  it('accepts an explicit chapter and verse cue', () => {
    const result = matchSpokenReference(practiceUnits('', 'John 3:16'), 0, 'John 3:16', 'John chapter three verse sixteen')

    expect(result.decisions).toEqual(heardAll([0, 1, 2]))
  })

  it('locates an omitted chapter from an explicit verse cue and bridges the missing unit', () => {
    const result = matchSpokenReference(practiceUnits('', 'John 3:16'), 0, 'John 3:16', 'John verse sixteen')

    expect(result.decisions).toEqual([heard(0), bridged(1), heard(2)])
    expect(result.decisions.every(decision => !decision.incorrect)).toBe(true)
  })

  it('accepts a verse range', () => {
    const result = matchSpokenReference(practiceUnits('', 'John 3:16-18'), 0, 'John 3:16-18', 'john three sixteen to eighteen')

    expect(result.decisions).toEqual(heardAll([0, 1, 2, 3]))
  })

  it('stays pending on a partial reference rather than completing the verse', () => {
    expect(matchSpokenReference(practiceUnits('', 'John 3:16'), 0, 'John 3:16', 'John three'))
      .toEqual({ pending: true, decisions: [] })
  })

  it('refuses more numbers than the reference has units', () => {
    expect(matchSpokenReference(practiceUnits('', 'John 3:16'), 0, 'John 3:16', 'John three sixteen seventeen'))
      .toEqual({ ambiguous: true, decisions: [] })
  })

  it('reports an unsupported reference instead of matching digits', () => {
    expect(matchSpokenReference(practiceUnits('', 'Scroll 1:1'), 0, 'Scroll 1:1', 'one one'))
      .toEqual({ unsupported: true, decisions: [] })
  })

  it('never records a mistake for a multi-digit number it cannot parse structurally', () => {
    const result = matchSpokenReference(
      practiceUnits('', 'Psalm 119:105-106'),
      0,
      'Psalm 119:105-106',
      'psalm one hundred nineteen one five through one six',
    )

    expect(result).toEqual({ ambiguous: true, decisions: [] })
  })
})
