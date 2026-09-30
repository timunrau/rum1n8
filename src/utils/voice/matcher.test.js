import { describe, expect, it } from 'vitest'
import { buildReferencePracticeUnits } from '../reference-typing.js'
import { getVerseWords } from '../verse-words.js'
import { matchAlternatives, matchSpeech, resolveSpeechAlternatives, VOICE_BRIDGED, VOICE_HEARD, VOICE_REPLACED } from './matcher.js'

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

const heard = index => ({ index, incorrect: false, accepted: VOICE_HEARD })
const bridged = index => ({ index, incorrect: false, accepted: VOICE_BRIDGED })
const replaced = index => ({ index, incorrect: true, accepted: VOICE_REPLACED })
const heardAll = indices => indices.map(heard)

describe('matchSpeech accepting correct words', () => {
  it('advances one display unit per matching word and reports the next index', () => {
    const result = matchSpeech(john(), 0, 'In the beginning')

    expect(result.decisions).toEqual(heardAll([0, 1, 2]))
    expect(result.nextIndex).toBe(3)
    expect(result.consumed).toBe(3)
    expect(result.remainder).toBe('')
    expect(result.ambiguous).toBe(false)
    expect(result.waiting).toBe(false)
  })

  it('continues from a mid-verse cursor', () => {
    expect(matchSpeech(john(), 3, 'was the Word').decisions).toEqual(heardAll([3, 4, 5]))
  })

  it('ignores fillers and treats them as consumed speech', () => {
    const result = matchSpeech(john(), 0, 'In the um beginning was the Word')

    expect(result.decisions).toEqual(heardAll([0, 1, 2, 3, 4, 5]))
    expect(result.consumed).toBe(7)
  })

  it('matches a contraction that covers a single display unit', () => {
    expect(matchSpeech(contentUnits("I'll go now"), 0, "I'll now").decisions).toEqual([
      heard(0),
      bridged(1),
      heard(2),
    ])
  })

  it('stops at a reference unit and buffers the spoken reference for later', () => {
    const result = matchSpeech(practiceUnits('One two three', 'John 3:16'), 0, 'One two three John')

    expect(result.decisions).toEqual(heardAll([0, 1, 2]))
    expect(result.nextIndex).toBe(3)
    expect(result.remainder).toBe('John')
  })
})

describe('matchSpeech distinguishes clear replacements from uncertain speech', () => {
  it('marks a distinct spoken replacement when both sides align', () => {
    const result = matchSpeech(john(), 0, 'In the start was the Word')

    expect(result.decisions).toEqual([heard(0), heard(1), replaced(2), heard(3), heard(4), heard(5)])
    expect(matchSpeech(contentUnits('One two three'), 0, 'One wrong three').decisions)
      .toEqual([heard(0), replaced(1), heard(2)])
  })

  it('does not penalize a close recognition guess or a filler', () => {
    expect(matchSpeech(john(), 0, 'In the begining was the Word').decisions)
      .toEqual([heard(0), heard(1), bridged(2), heard(3), heard(4), heard(5)])
    expect(matchSpeech(john(), 0, 'In the uh was the Word').decisions)
      .toEqual([heard(0), heard(1), bridged(2), heard(3), heard(4), heard(5)])
    expect(matchSpeech(john(), 0, 'In the the was the Word').decisions)
      .toEqual([heard(0), heard(1), bridged(2), heard(3), heard(4), heard(5)])
  })

  it('does not penalize an unmatched word at an utterance boundary', () => {
    expect(matchSpeech(john(), 0, 'start the beginning was the Word').decisions)
      .toEqual([bridged(0), ...heardAll([1, 2, 3, 4, 5])])
  })

  it('bridges every skipped unit when a later two-unit anchor locates the resume point', () => {
    const result = matchSpeech(john(), 0, 'In the Word')

    expect(result.decisions).toEqual([heard(0), heard(1), bridged(2), bridged(3), bridged(4), heard(5)])
    expect(result.nextIndex).toBe(6)
  })

  it('leaves a misheard final word undecided instead of counting it as a mistake', () => {
    const result = matchSpeech(john(), 0, 'In the beginning was the Wordd')

    expect(result.decisions).toEqual(heardAll([0, 1, 2, 3, 4]))
    expect(result.nextIndex).toBe(5)
    expect(result.remainder).toBe('Wordd')
  })

  it('does not count a repeated previous word at the end as a mistake', () => {
    const result = matchSpeech(contentUnits('In the beginning was the'), 0, 'In the beginning was the the')

    expect(result.decisions).toEqual(heardAll([0, 1, 2, 3, 4]))
    expect(result.remainder).toBe('the')
  })

  it('credits words the speaker started past as bridged progress', () => {
    const result = matchSpeech(john(), 0, 'beginning was')

    expect(result.decisions).toEqual([bridged(0), bridged(1), heard(2), heard(3)])
    expect(result.decisions.every(decision => !decision.incorrect)).toBe(true)
  })

  it('stays pending when a lone distant word would need an unbounded bridge', () => {
    const result = matchSpeech(contentUnits('one two three four five six seven eight nine ten eleven twelve'), 0, 'one twelve')

    expect(result.decisions).toEqual(heardAll([0]))
    expect(result.nextIndex).toBe(1)
    expect(result.waiting).toBe(true)
    expect(result.remainder).toBe('twelve')
  })

  it('bridges at most the bound when a two-word anchor confirms the resume point', () => {
    const result = matchSpeech(contentUnits('a b c d e f g h i j k l'), 0, 'a i j')

    expect(result.decisions).toEqual([heard(0), ...[1, 2, 3, 4, 5, 6, 7].map(bridged), heard(8), heard(9)])
    expect(result.nextIndex).toBe(10)
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

    expect(result.decisions).toEqual(heardAll([0, 1, 2, 3, 4]))
  })

  it('tolerates an inserted phrase without flagging the recitation', () => {
    const result = matchSpeech(contentUnits('one two three four five'), 0, 'one two one two three four five')

    expect(result.decisions).toEqual(heardAll([0, 1, 2, 3, 4]))
  })
})

describe('resolveSpeechAlternatives', () => {
  it('returns an empty result for no alternatives', () => {
    expect(resolveSpeechAlternatives([])).toEqual({
      decisions: [],
      remainders: [''],
      ambiguous: false,
      waiting: false,
      bridged: false,
      unsupported: false,
    })
  })

  it('accepts a correct match found only in a later alternative', () => {
    const result = matchAlternatives(contentUnits('In the beginning'), 0, ['In the begining', 'In the beginning'])

    expect(result.decisions).toEqual(heardAll([0, 1, 2]))
    expect(result.ambiguous).toBe(false)
  })

  it('does not let a worse alternative veto a clean recitation', () => {
    const result = matchAlternatives(john(), 0, ['In the start was the Word', 'In the beginning was the Word'])

    expect(result.decisions).toEqual(heardAll([0, 1, 2, 3, 4, 5]))
  })

  it('prefers a clean shorter alternative over a longer bridging one', () => {
    const result = matchAlternatives(john(), 0, ['In the start was the Word', 'In the beginning was the'])

    expect(result.decisions).toEqual(heardAll([0, 1, 2, 3, 4]))
  })

  it('prefers a clean alternative over one that guesses a replacement', () => {
    const result = matchAlternatives(john(), 0, ['In the start was the Word', 'In the beginning was the Word'])

    expect(result.decisions).toEqual(heardAll([0, 1, 2, 3, 4, 5]))
  })

  it('reports the whole remainder list as unsupported only when no alternative parsed', () => {
    const result = resolveSpeechAlternatives([
      { decisions: [], unsupported: true },
      { decisions: [], unsupported: true },
    ])

    expect(result).toEqual({
      decisions: [],
      remainders: [''],
      ambiguous: false,
      waiting: false,
      bridged: false,
      unsupported: true,
    })
  })
})
