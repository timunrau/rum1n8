import { describe, expect, it } from 'vitest'
import { normalizeSpeech, numberAt, rawTokens, speechTokensWithOffsets } from './normalization.js'

describe('rawTokens', () => {
  it('lowercases, strips punctuation, and keeps intra-word apostrophes', () => {
    expect(rawTokens("For God's so-loved!")).toEqual(['for', "god's", 'so', 'loved'])
  })

  it('normalizes curly apostrophes to straight ones', () => {
    expect(rawTokens('don’t twisty…')).toEqual(["don't", 'twisty'])
  })

  it('returns an empty list for blank input', () => {
    expect(rawTokens('')).toEqual([])
    expect(rawTokens('   —  ')).toEqual([])
  })
})

describe('numberAt', () => {
  it('reads an explicit digit run as a single number', () => {
    expect(numberAt(['316'], 0)).toEqual({ value: '316', length: 1 })
  })

  it('reads small numbers, teens, and tens', () => {
    expect(numberAt(['zero'], 0)).toEqual({ value: '0', length: 1 })
    expect(numberAt(['nineteen'], 0)).toEqual({ value: '19', length: 1 })
    expect(numberAt(['forty'], 0)).toEqual({ value: '40', length: 1 })
    expect(numberAt(['ninety'], 0)).toEqual({ value: '90', length: 1 })
  })

  it('combines a tens word with a following single digit', () => {
    expect(numberAt(['twenty', 'one'], 0)).toEqual({ value: '21', length: 2 })
    expect(numberAt(['ninety', 'nine'], 0)).toEqual({ value: '99', length: 2 })
    expect(numberAt(['fifty', 'five'], 0)).toEqual({ value: '55', length: 2 })
  })

  it('does not add a following number that is not a single digit', () => {
    expect(numberAt(['twenty', 'ten'], 0)).toEqual({ value: '20', length: 1 })
  })

  it('combines hundreds with an optional "and" remainder', () => {
    expect(numberAt(['one', 'hundred'], 0)).toEqual({ value: '100', length: 2 })
    expect(numberAt(['one', 'hundred', 'and', 'twenty'], 0)).toEqual({ value: '120', length: 4 })
    expect(numberAt(['one', 'hundred', 'one'], 0)).toEqual({ value: '101', length: 3 })
    expect(numberAt(['two', 'hundred', 'fifty', 'five'], 0)).toEqual({ value: '255', length: 4 })
    expect(numberAt(['three', 'hundred', 'sixteen'], 0)).toEqual({ value: '316', length: 3 })
  })

  it('reports a start position for a number inside a larger run', () => {
    expect(numberAt(['three', 'hundred', 'sixteen'], 2)).toEqual({ value: '16', length: 1 })
  })

  it('returns null for anything that is not an explicit number', () => {
    expect(numberAt(['hundred'], 0)).toBeNull()
    expect(numberAt(['a', 'hundred'], 0)).toBeNull()
    expect(numberAt(['beginning'], 0)).toBeNull()
    expect(numberAt([], 0)).toBeNull()
  })
})

describe('speechTokensWithOffsets', () => {
  it('expands contractions into their separate display units', () => {
    expect(speechTokensWithOffsets("I'll").tokens).toEqual(['i', 'will'])
    expect(speechTokensWithOffsets("I'm going").tokens).toEqual(['i', 'am', 'going'])
    expect(speechTokensWithOffsets("don't").tokens).toEqual(['do', 'not'])
  })

  it('folds number words and digit runs to one token', () => {
    expect(speechTokensWithOffsets('forty-two').tokens).toEqual(['42'])
    expect(speechTokensWithOffsets('one hundred and twenty').tokens).toEqual(['120'])
    expect(speechTokensWithOffsets('316').tokens).toEqual(['316'])
    expect(speechTokensWithOffsets('John 3:16').tokens).toEqual(['john', '3', '16'])
  })

  it('applies the explicit homophone table only', () => {
    expect(speechTokensWithOffsets('two to').tokens).toEqual(['2', '2'])
    expect(speechTokensWithOffsets('their there').tokens).toEqual(['there', 'there'])
    expect(speechTokensWithOffsets('reign rain').tokens).toEqual(['rain', 'rain'])
  })

  it('keeps unrecognized words verbatim and never guesses spelling', () => {
    expect(speechTokensWithOffsets('recieve seperate').tokens).toEqual(['recieve', 'seperate'])
  })

  it('splits digits and letters so a chapter stays separate from its book', () => {
    expect(speechTokensWithOffsets('1 Corinthians 12:13').tokens).toEqual(['1', 'corinthians', '12', '13'])
    expect(speechTokensWithOffsets('1213').tokens).toEqual(['1213'])
  })

  it('reports the source end offset of every token', () => {
    expect(speechTokensWithOffsets("I'll go to two").ends).toEqual([4, 4, 7, 10, 14])
  })
})

describe('normalizeSpeech', () => {
  it('treats a dash-joined phrase as separate units', () => {
    expect(normalizeSpeech('One—two')).toEqual(['1', '2'])
  })

  it('normalizes identically for the expected and the spoken side', () => {
    expect(normalizeSpeech('For God so loved')).toEqual(normalizeSpeech('for God so loved'))
  })
})
