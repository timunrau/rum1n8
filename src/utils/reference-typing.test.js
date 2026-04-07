import { describe, expect, it } from 'vitest'
import { normalizeReferenceForTyping, buildReferencePracticeUnits } from './reference-typing.js'

describe('normalizeReferenceForTyping', () => {
  it('normalizes a simple reference to initials plus digits', () => {
    expect(normalizeReferenceForTyping('John 3:16')).toBe('j316')
  })

  it('keeps the numeric book prefix', () => {
    expect(normalizeReferenceForTyping('1 John 4:19')).toBe('1j419')
  })

  it('handles multi-word books', () => {
    expect(normalizeReferenceForTyping('Song of Songs 2:1')).toBe('sos21')
  })
})

describe('buildReferencePracticeUnits', () => {
  it('shows the full reference while requiring shorthand input', () => {
    expect(buildReferencePracticeUnits('John 3:16')).toEqual([
      expect.objectContaining({
        text: 'John',
        requiredLetters: ['j'],
        isReferenceStart: true,
      }),
      expect.objectContaining({
        text: '3',
        separatorAfter: ':',
        requiredLetters: ['3'],
        isReferenceStart: false,
      }),
      expect.objectContaining({
        text: '16',
        separatorAfter: '',
        requiredLetters: ['1', '6'],
        isReferenceStart: false,
      }),
    ])
  })

  it('treats numbered books as a single shorthand token', () => {
    expect(buildReferencePracticeUnits('1 John 4:19')).toEqual([
      expect.objectContaining({
        text: '1',
        requiredLetters: ['1'],
      }),
      expect.objectContaining({
        text: 'John',
        requiredLetters: ['j'],
      }),
      expect.objectContaining({
        text: '4',
        separatorAfter: ':',
        requiredLetters: ['4'],
      }),
      expect.objectContaining({
        text: '19',
        separatorAfter: '',
        requiredLetters: ['1', '9'],
      }),
    ])
  })

  it('splits verse ranges into separate visible placeholders', () => {
    expect(buildReferencePracticeUnits('Philippians 4:6-7')).toEqual([
      expect.objectContaining({
        text: 'Philippians',
        requiredLetters: ['p'],
      }),
      expect.objectContaining({
        text: '4',
        separatorAfter: ':',
        requiredLetters: ['4'],
      }),
      expect.objectContaining({
        text: '6',
        separatorAfter: '-',
        requiredLetters: ['6'],
      }),
      expect.objectContaining({
        text: '7',
        separatorAfter: '',
        requiredLetters: ['7'],
      }),
    ])
  })

  it('splits multi-digit ranges into chapter and verse groups', () => {
    expect(buildReferencePracticeUnits('1 Thessalonians 5:16-22')).toEqual([
      expect.objectContaining({
        text: '1',
        requiredLetters: ['1'],
      }),
      expect.objectContaining({
        text: 'Thessalonians',
        requiredLetters: ['t'],
      }),
      expect.objectContaining({
        text: '5',
        separatorAfter: ':',
        requiredLetters: ['5'],
      }),
      expect.objectContaining({
        text: '16',
        separatorAfter: '-',
        requiredLetters: ['1', '6'],
      }),
      expect.objectContaining({
        text: '22',
        separatorAfter: '',
        requiredLetters: ['2', '2'],
      }),
    ])
  })
})
