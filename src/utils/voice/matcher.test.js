import { describe, expect, it } from 'vitest'
import { buildReferencePracticeUnits } from '../reference-typing.js'
import { getVerseWords } from '../verse-words.js'
import { matchAlternatives, matchSpeech, resolveSpeechAlternatives } from './matcher.js'

const contentUnits = content => getVerseWords(content).map((entry, index) => ({ text: entry.text, index }))

const practiceUnits = (content, reference) => {
  const words = contentUnits(content)
  const offset = words.length
  return [
    ...words,
    ...buildReferencePracticeUnits(reference).map(unit => ({ ...unit, index: offset + unit.index })),
  ]
}

const JOHN = 'In the beginning was the Word'
const john = () => contentUnits(JOHN)

describe('matchSpeech accepting correct words', () => {
  it('advances one display unit per matching word and reports the next index', () => {
    const result = matchSpeech(john(), 0, 'In the beginning')

    expect(result.decisions).toEqual([
      { index: 0, incorrect: false },
      { index: 1, incorrect: false },
      { index: 2, incorrect: false },
    ])
    expect(result.nextIndex).toBe(3)
    expect(result.consumed).toBe(3)
    expect(result.remainder).toBe('')
    expect(result.ambiguous).toBe(false)
    expect(result.waiting).toBe(false)
  })

  it('continues from a mid-verse cursor', () => {
    expect(matchSpeech(john(), 3, 'was the Word').decisions).toEqual([
      { index: 3, incorrect: false },
      { index: 4, incorrect: false },
      { index: 5, incorrect: false },
    ])
  })

  it('ignores fillers and treats them as consumed speech', () => {
    const result = matchSpeech(john(), 0, 'In the um beginning was the Word')

    expect(result.decisions).toEqual([0, 1, 2, 3, 4, 5].map(index => ({ index, incorrect: false })))
    expect(result.consumed).toBe(7)
  })

  it('matches a contraction that covers a single display unit', () => {
    expect(matchSpeech(contentUnits("I'll go now"), 0, "I'll now").decisions).toEqual([
      { index: 0, incorrect: false },
      { index: 1, incorrect: true, anchorEndIndex: 2 },
      { index: 2, incorrect: false },
    ])
  })

  it('stops at a reference unit and buffers the spoken reference for later', () => {
    const result = matchSpeech(practiceUnits('One two three', 'John 3:16'), 0, 'One two three John')

    expect(result.decisions).toEqual([0, 1, 2].map(index => ({ index, incorrect: false })))
    expect(result.nextIndex).toBe(3)
    expect(result.remainder).toBe('John')
  })
})

describe('matchSpeech recording mistakes', () => {
  it('marks a substituted word when later words anchor the position', () => {
    const result = matchSpeech(john(), 0, 'In the start was the Word')

    expect(result.decisions).toEqual([
      { index: 0, incorrect: false },
      { index: 1, incorrect: false },
      { index: 2, incorrect: true, anchorEndIndex: 4 },
      { index: 3, incorrect: false },
      { index: 4, incorrect: false },
      { index: 5, incorrect: false },
    ])
  })

  it('marks every skipped unit when a later two-unit anchor locates the resume point', () => {
    const result = matchSpeech(john(), 0, 'In the Word')

    expect(result.decisions).toEqual([
      { index: 0, incorrect: false },
      { index: 1, incorrect: false },
      { index: 2, incorrect: true, anchorEndIndex: 5 },
      { index: 3, incorrect: true, anchorEndIndex: 5 },
      { index: 4, incorrect: true, anchorEndIndex: 5 },
      { index: 5, incorrect: false },
    ])
  })

  it('counts a recognizably different final word as missed', () => {
    expect(matchSpeech(john(), 0, 'In the beginning was the Wordd').decisions[5])
      .toEqual({ index: 5, incorrect: true })
  })

  it('does not count a repeated previous word at the end as a mistake', () => {
    const result = matchSpeech(contentUnits('In the beginning was the'), 0, 'In the beginning was the the')

    expect(result.decisions).toEqual([0, 1, 2, 3, 4].map(index => ({ index, incorrect: false })))
    expect(result.remainder).toBe('the')
  })

  it('does not invent omissions when the speech starts later in the verse', () => {
    const result = matchSpeech(john(), 0, 'beginning was')

    expect(result.decisions).toEqual([
      { index: 0, incorrect: true, anchorEndIndex: 3 },
      { index: 1, incorrect: true, anchorEndIndex: 3 },
      { index: 2, incorrect: false },
      { index: 3, incorrect: false },
    ])
  })
})

describe('matchSpeech conservatism', () => {
  it('reports no decisions while the utterance cannot be located', () => {
    const result = matchSpeech(john(), 0, 'aaa bbb ccc ddd eee')

    expect(result.decisions).toEqual([])
    expect(result.nextIndex).toBe(0)
    expect(result.waiting).toBe(true)
    expect(result.remainder).toBe('aaa bbb ccc ddd eee')
  })

  it('does not match a reference unit as verse content', () => {
    const result = matchSpeech(practiceUnits('', 'John 3:16'), 0, 'John three sixteen')

    expect(result.decisions).toEqual([])
  })

  it('marks nothing when two different later anchors both fit', () => {
    const result = matchSpeech(contentUnits('x the the the'), 0, 'the the')

    expect(result.ambiguous).toBe(true)
    expect(result.decisions).toEqual([])
  })

  it('prefers a nearby direct match over inventing omissions for a repeated phrase', () => {
    const result = matchSpeech(contentUnits('one two one two three'), 0, 'one two one two three')

    expect(result.decisions).toEqual([0, 1, 2, 3, 4].map(index => ({ index, incorrect: false })))
  })

  it('tolerates an inserted phrase without flagging the recitation', () => {
    const result = matchSpeech(contentUnits('one two three four five'), 0, 'one two one two three four five')

    expect(result.decisions).toEqual([0, 1, 2, 3, 4].map(index => ({ index, incorrect: false })))
  })
})

describe('resolveSpeechAlternatives', () => {
  it('returns an empty result for no alternatives', () => {
    expect(resolveSpeechAlternatives([])).toEqual({ decisions: [], remainders: [''], ambiguous: false })
  })

  it('accepts a correct match found only in a later alternative', () => {
    const result = matchAlternatives(contentUnits('In the beginning'), 0, ['In the begining', 'In the beginning'])

    expect(result.decisions).toEqual([0, 1, 2].map(index => ({ index, incorrect: false })))
    expect(result.ambiguous).toBe(false)
  })

  it('does not let a worse alternative veto a clean recitation', () => {
    const result = matchAlternatives(john(), 0, ['In the start was the Word', 'In the beginning was the Word'])

    expect(result.decisions).toEqual([0, 1, 2, 3, 4, 5].map(index => ({ index, incorrect: false })))
  })

  it('prefers a longer clean alternative without inventing a missing trailing word', () => {
    const result = matchAlternatives(john(), 0, ['In the start was the Word', 'In the beginning was the'])

    expect(result.decisions).toEqual([0, 1, 2, 3, 4].map(index => ({ index, incorrect: false })))
  })

  it('reports the whole remainder list as unsupported only when no alternative parsed', () => {
    const result = resolveSpeechAlternatives([
      { decisions: [], unsupported: true },
      { decisions: [], unsupported: true },
    ])

    expect(result).toEqual({ decisions: [], remainders: [''], ambiguous: false, waiting: false, unsupported: true })
  })
})
