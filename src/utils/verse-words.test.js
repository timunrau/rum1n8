import { describe, expect, it } from 'vitest'
import { getVerseWords } from './verse-words.js'

const texts = content => getVerseWords(content).map(entry => entry.text)
const separators = content => getVerseWords(content).map(entry => entry.separatorAfter)

describe('getVerseWords', () => {
  it('splits plain content on whitespace', () => {
    expect(texts('One two three')).toEqual(['One', 'two', 'three'])
  })

  it('splits a dash-joined phrase into separate units', () => {
    expect(texts('One—two')).toEqual(['One', 'two'])
    expect(texts('peace-loving neighbor')).toEqual(['peace', 'loving', 'neighbor'])
  })

  it('keeps authored spacing around a dash as a trailing separator', () => {
    expect(texts('One - two self-seeking')).toEqual(['One', 'two', 'self', 'seeking'])
    expect(separators('One - two')).toEqual([' - ', ''])
    expect(separators('self-seeking')).toEqual(['-', ''])
  })

  it('keeps every dash variant tight when no spaces were authored', () => {
    expect(texts('One‐two–three')).toEqual(['One', 'two', 'three'])
  })

  it('ignores a leading dash and collapses empty input', () => {
    expect(texts('- leading')).toEqual(['leading'])
    expect(getVerseWords('')).toEqual([])
    expect(getVerseWords()).toEqual([])
  })
})
