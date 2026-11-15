import { describe, expect, it } from 'vitest'
import { formatReferenceForSpeech } from './reference-speech.js'

describe('formatReferenceForSpeech', () => {
  it.each([
    ['1 Corinthians 6:4-11', 'First Corinthians six verses four to eleven'],
    ['Psalm 1:1', 'Psalm one verse one'],
    ['Psalm 1', 'Psalm one'],
    ['Psalm 1-3', 'Psalms one to three'],
    ['John 3:36-4:2', 'John three verse thirty-six to chapter four verse two'],
    ['John 1:1', 'John one verse one'],
    ['John 3:16-16', 'John three verse sixteen'],
    ['2 Timothy 3:16-17', 'Second Timothy three verses sixteen to seventeen'],
    ['3 John 1:4', 'Third John one verse four'],
    ['1 Cor 13:4', 'First Corinthians thirteen verse four'],
    ['ii john 1:6', 'Second John one verse six'],
    ['jn 3:16', 'John three verse sixteen'],
    ['  psalm   1 : 1  ', 'Psalm one verse one'],
    ['1 Corinthians 6:4–11', 'First Corinthians six verses four to eleven'],
    ['1 Corinthians 6:4—11', 'First Corinthians six verses four to eleven'],
    ['John 3:36 – 4 : 2', 'John three verse thirty-six to chapter four verse two'],
    ['Psalm 1—3', 'Psalms one to three'],
    ['Psalms 23:1-3', 'Psalm twenty-three verses one to three'],
    ['Psalms 100', 'Psalm one hundred'],
    ['Psalm 119:101-104', 'Psalm one hundred nineteen verses one hundred one to one hundred four'],
    ['Psalm 119:176', 'Psalm one hundred nineteen verse one hundred seventy-six'],
    ['Psalm 149-150', 'Psalms one hundred forty-nine to one hundred fifty'],
    ['Genesis 1-3', 'Genesis one to three'],
    ['Jude 1', 'Jude one'],
  ])('formats %s for speech', (reference, expected) => {
    expect(formatReferenceForSpeech(reference)).toBe(expected)
  })

  it.each([
    '', 'A custom reference', 'Foo 1:1', 'Phil 1:6', 'John', 'John 3:16,18',
    'John 0:1', 'John 3:0', 'John 3:18-16', 'John 4:2-3:36', 'John 99:1',
    'Psalm 151', 'Psalm 119:177', 'Psalm 3-1', 'John 3:16—18,20',
    '  Unrecognized 1:1–3  ',
  ])('preserves unsupported or invalid reference %j verbatim', reference => {
    expect(formatReferenceForSpeech(reference)).toBe(reference)
  })
})
