import { describe, expect, it, vi } from 'vitest'
import { completePracticeUnit } from './practice-operations.js'

const word = (overrides = {}) => ({
  index: 2,
  text: 'Word',
  requiredLetters: ['w'],
  typedLettersIndex: 0,
  revealed: false,
  visible: false,
  incorrect: false,
  incorrectLetterIndices: [],
  ...overrides,
})

const operations = () => ({
  recordMistake: vi.fn(),
  advance: vi.fn(),
  completed: vi.fn(),
  scroll: vi.fn(),
})

describe('completePracticeUnit', () => {
  it('reveals the word and advances the cursor', () => {
    const unit = word()
    const ops = operations()

    completePracticeUnit(unit, {}, ops)

    expect(unit).toMatchObject({ revealed: true, visible: true, typedLettersIndex: 1 })
    expect(ops.advance).toHaveBeenCalledWith(2)
    expect(ops.completed).toHaveBeenCalledWith(unit)
    expect(ops.scroll).toHaveBeenCalledTimes(1)
    expect(ops.recordMistake).not.toHaveBeenCalled()
  })

  it('fills every required letter when completing a multi-part word', () => {
    const unit = word({ requiredLetters: ['p', 'e', 'a', 'c', 'e'] })

    completePracticeUnit(unit, {}, operations())

    expect(unit.typedLettersIndex).toBe(5)
  })

  it('records the mistake before the unit can complete a segment', () => {
    const calls = []
    const unit = word()
    const ops = {
      recordMistake: vi.fn(() => calls.push('recordMistake')),
      advance: vi.fn(() => calls.push('advance')),
      completed: vi.fn(() => calls.push('completed')),
      scroll: vi.fn(),
    }

    completePracticeUnit(unit, { incorrect: true }, ops)

    expect(calls).toEqual(['recordMistake', 'advance', 'completed'])
    expect(ops.recordMistake).toHaveBeenCalledWith(unit)
    expect(unit.incorrect).toBe(true)
  })

  it('keeps an earlier mistake recorded on the same word', () => {
    const unit = word({ incorrect: true })

    completePracticeUnit(unit, { incorrect: false }, operations())

    expect(unit.incorrect).toBe(true)
    expect(unit.revealed).toBe(true)
  })

  it('does nothing for an already revealed word', () => {
    const unit = word({ revealed: true, visible: true })
    const ops = operations()

    completePracticeUnit(unit, { incorrect: true }, ops)

    expect(ops.recordMistake).not.toHaveBeenCalled()
    expect(ops.advance).not.toHaveBeenCalled()
    expect(unit.typedLettersIndex).toBe(0)
  })

  it('does nothing without a word', () => {
    const ops = operations()

    completePracticeUnit(null, { incorrect: true }, ops)
    completePracticeUnit(undefined, {}, ops)

    expect(ops.advance).not.toHaveBeenCalled()
  })
})
