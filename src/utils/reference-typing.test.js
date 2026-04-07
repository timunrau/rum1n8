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
        text: '3:16',
        requiredLetters: ['3', '1', '6'],
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
        text: '4:19',
        requiredLetters: ['4', '1', '9'],
      }),
    ])
  })

  it('keeps verse ranges as one visible token but requires each digit in order', () => {
    expect(buildReferencePracticeUnits('Philippians 4:6-7')).toEqual([
      expect.objectContaining({
        text: 'Philippians',
        requiredLetters: ['p'],
      }),
      expect.objectContaining({
        text: '4:6-7',
        requiredLetters: ['4', '6', '7'],
      }),
    ])
  })
})
