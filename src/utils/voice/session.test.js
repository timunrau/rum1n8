import { describe, expect, it } from 'vitest'
import { buildReferencePracticeUnits } from '../reference-typing.js'
import { getVerseWords } from '../verse-words.js'
import { VOICE_BRIDGED, VOICE_HEARD } from './matcher.js'
import { matchVoiceUtterance, resolveVoiceAlternatives } from './session.js'

const heard = index => ({ index, incorrect: false, accepted: VOICE_HEARD })
const bridged = index => ({ index, incorrect: false, accepted: VOICE_BRIDGED })
const heardAll = indices => indices.map(heard)

const practiceUnits = (content, reference) => {
  const words = getVerseWords(content).map((entry, index) => ({ text: entry.text, index }))
  const offset = words.length
  return [...words, ...buildReferencePracticeUnits(reference).map(unit => ({ ...unit, index: offset + unit.index }))]
}

const JOHN = practiceUnits('One two three', 'John 3:16')
const context = (units, startIndex, reference = 'John 3:16', extra = {}) => ({
  units,
  startIndex,
  reference,
  ...extra,
})

describe('matchVoiceUtterance', () => {
  it('accepts nothing when there is no cursor', () => {
    expect(matchVoiceUtterance(context(JOHN, -1), 'one')).toEqual({ decisions: [], remainder: '' })
  })

  it('accepts the content run and the spoken reference in one utterance', () => {
    const result = matchVoiceUtterance(context(JOHN, 0), 'one two three John three sixteen')

    expect(result.decisions).toEqual(heardAll([0, 1, 2, 3, 4, 5]))
    expect(result.remainder).toBe('')
  })

  it('matches the reference when the cursor already sits on it', () => {
    expect(matchVoiceUtterance(context(JOHN, 3), 'John three sixteen').decisions)
      .toEqual(heardAll([3, 4, 5]))
  })

  it('bridges a misheard final content word once a full reference locates the end', () => {
    const units = practiceUnits('Alpha beta gamma', 'John 3:16')
    const result = matchVoiceUtterance(context(units, 0, 'John 3:16'), 'alpha beta blah John three sixteen')

    expect(result.decisions).toEqual([
      heard(0),
      heard(1),
      bridged(2),
      heard(3),
      heard(4),
      heard(5),
    ])
    expect(result.decisions.every(decision => !decision.incorrect)).toBe(true)
  })

  it('leaves a partial reference pending instead of completing the verse', () => {
    const result = matchVoiceUtterance(context(JOHN, 0), 'one two three John three')

    expect(result.pending).toBe(true)
    expect(result.decisions).toEqual(heardAll([0, 1, 2]))
    expect(result.remainder).toBe('John three')
  })

  it('reports an unsupported reference so the caller can fall back to the keyboard', () => {
    const units = practiceUnits('One two', 'Scroll 1:1')
    const result = matchVoiceUtterance({ units, startIndex: 2, reference: 'Scroll 1:1' }, 'one one')

    expect(result.unsupported).toBe(true)
    expect(result.decisions).toEqual([])
  })
})

describe('resolveVoiceAlternatives', () => {
  it('accepts correct words and clears the buffer', () => {
    const result = resolveVoiceAlternatives(context(JOHN, 0), ['one two'])

    expect(result.decisions).toEqual(heardAll([0, 1]))
    expect(result.remainders).toEqual([''])
    expect(result.needsContinuationPrompt).toBe(false)
  })

  it('buffers an unmatched suffix so a later anchor can still locate it', () => {
    // The first result accepts "one", so the buffer keeps only what is left and
    // the caller advances the cursor before the next result is consumed.
    const first = resolveVoiceAlternatives(context(JOHN, 0), ['one'])
    expect(first.remainders).toEqual([''])

    const second = resolveVoiceAlternatives(context(JOHN, 1, 'John 3:16', { buffers: first.remainders }), ['two three'])

    expect(second.decisions).toEqual(heardAll([1, 2]))
    expect(second.remainders).toEqual([''])
  })

  it('keeps a suffix that no later word can locate', () => {
    const first = resolveVoiceAlternatives(context(JOHN, 0), ['one zzz'])
    expect(first.decisions).toEqual([heard(0)])
    expect(first.remainders).toEqual(['zzz'])
    expect(first.needsContinuationPrompt).toBe(false)

    const second = resolveVoiceAlternatives(context(JOHN, 1, 'John 3:16', { buffers: first.remainders }), ['two three'])

    expect(second.decisions).toEqual(heardAll([1, 2]))
  })

  it('asks to continue from the next word only when nothing was accepted', () => {
    const result = resolveVoiceAlternatives(context(JOHN, 0), ['zzz'])

    expect(result.decisions).toEqual([])
    expect(result.waiting).toBe(true)
    expect(result.needsContinuationPrompt).toBe(true)
  })

  it('stays quiet when words were accepted but speech is still buffered', () => {
    const result = resolveVoiceAlternatives(context(JOHN, 0), ['one two zzz'])

    expect(result.decisions).toEqual(heardAll([0, 1]))
    expect(result.waiting).toBe(true)
    expect(result.needsContinuationPrompt).toBe(false)
  })

  it('accepts a clear restart from the cursor after an ambiguous suffix', () => {
    const result = resolveVoiceAlternatives(
      context(JOHN, 0, 'John 3:16', { buffers: ['zzz qqq'], repeatPending: true }),
      ['one two'],
    )

    expect(result.decisions).toEqual(heardAll([0, 1]))
    expect(result.repeatPending).toBe(false)
  })

  it('keeps buffering when the disputed suffix repeats itself', () => {
    const result = resolveVoiceAlternatives(
      context(JOHN, 0, 'John 3:16', { buffers: ['zzz qqq'], repeatPending: true }),
      ['zzz qqq'],
    )

    expect(result.decisions).toEqual([])
    expect(result.remainders).toEqual(['zzz qqq zzz qqq'])
  })

  it('marks a disputed suffix and asks the user to continue', () => {
    const units = practiceUnits('x the the the the the', 'John 1:1')
    const result = resolveVoiceAlternatives({ units, startIndex: 0, reference: 'John 1:1' }, ['the the'])

    expect(result.ambiguous).toBe(true)
    expect(result.decisions).toEqual([])
    expect(result.repeatPending).toBe(true)
    expect(result.needsContinuationPrompt).toBe(true)
  })

  it('drops the buffer and asks to continue when too many suffixes accumulate', () => {
    const utterances = Array.from({ length: 12 }, (_, index) => `one${index} two${index}`)
    const result = resolveVoiceAlternatives(context(JOHN, 0), utterances)

    expect(result.overflow).toBe(true)
    expect(result.remainders).toEqual([''])
    expect(result.repeatPending).toBe(true)
    expect(result.needsContinuationPrompt).toBe(true)
  })

  it('drops the buffer when a single suffix grows too long', () => {
    const result = resolveVoiceAlternatives(context(JOHN, 0), ['x'.repeat(1600)])

    expect(result.overflow).toBe(true)
    expect(result.remainders).toEqual([''])
    expect(result.repeatPending).toBe(true)
  })

  it('passes an unsupported reference through to the caller', () => {
    const units = practiceUnits('One two', 'Scroll 1:1')
    const result = resolveVoiceAlternatives({ units, startIndex: 2, reference: 'Scroll 1:1' }, ['one one'])

    expect(result.unsupported).toBe(true)
    expect(result.decisions).toEqual([])
  })
})
