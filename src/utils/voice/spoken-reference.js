import { BIBLE_BOOKS, normalizeBookName, parseVerseSpanReference } from '../bible-reference.js'
import { VOICE_BRIDGED, VOICE_HEARD, VOICE_REPLACED } from './matcher.js'
import { numberAt, rawTokens } from './normalization.js'

const ordinals = { first: '1', second: '2', third: '3', one: '1', two: '2', three: '3' }
function exactBook(text) {
  const name = normalizeBookName(text.replace(/^(first|second|third|one|two|three)\s+/i, word => `${ordinals[word.trim().toLowerCase()]} `))
  return BIBLE_BOOKS.find(book => [book.name, ...book.aliases].some(alias => normalizeBookName(alias) === name))
}
export function supportedSpokenReference(reference) {
  return parseVerseSpanReference(reference.replace(/[–—]/g, '-'))
}

// Nearby numbers are easy for ASR to confuse ("sixteen"/"seventeen"). Only
// count a fully parsed numeric mismatch when the values are far apart and do
// not even share a final digit ("sixteen"/"six" should still be lenient).
function clearNumberMismatch(spoken, expected) {
  const actual = String(Number(spoken))
  const target = String(Number(expected))
  return Math.abs(Number(actual) - Number(target)) >= 10 && actual.at(-1) !== target.at(-1)
}

// Parse the utterance independently. In particular, never split "316" using the answer.
export function parseSpokenReference(text) {
  const tokens = rawTokens(text.replace(/([a-z])(\d)/gi, '$1 $2').replace(/(\d)([a-z])/gi, '$1 $2').replace(/[:]/g, ' verse ').replace(/(?<=\d)\s*[–—-]\s*(?=\d)|\s[–—-]\s/g, ' through '))
  if (ordinals[tokens[0]]) tokens[0] = ordinals[tokens[0]]
  let book = null, offset = 0
  for (let size = Math.min(4, tokens.length); size > 0; size--) {
    book = exactBook(tokens.slice(0, size).join(' '))
    if (book) { offset = size; break }
  }
  if (!book && !tokens.some(token => /^chapters?$|^verses?$/.test(token))) return { pending: true }
  // A speaker may restart the book and reference mid-utterance. Keep the latest
  // explicit occurrence of the same book instead of treating it as extra numbers.
  if (book) {
    for (let start = offset; start < tokens.length; start++) {
      for (let size = Math.min(4, tokens.length - start); size > 0; size--) {
        if (exactBook(tokens.slice(start, start + size).join(' '))?.id === book.id) {
          offset = start + size
          start = offset - 1
          break
        }
      }
    }
  }
  const numbers = [], cues = []
  let cue = null
  for (let i = offset; i < tokens.length;) {
    const token = tokens[i]
    if (/^chapters?$/.test(token)) { cue = 'chapter'; i++; continue }
    if (/^verses?$/.test(token)) { cue = 'verse'; i++; continue }
    if (['to', 'through', 'thru'].includes(token)) { cues.push({ range: numbers.length }); i++; continue }
    const number = numberAt(tokens, i)
    if (!number) { i++; continue }
    if (Number(number.value) > 176 || Number(number.value) < 1) return { ambiguous: true }
    numbers.push({ value: number.value, cue })
    cue = null
    i += number.length
  }
  return { book, numbers, cues, pending: !numbers.length }
}

export function matchSpokenReference(units, startIndex, reference, text) {
  const expected = supportedSpokenReference(reference)
  if (!expected) return { unsupported: true, decisions: [] }
  const parsed = parseSpokenReference(text)
  if (parsed.ambiguous || parsed.pending) return { ...parsed, decisions: [] }
  const allReference = units.filter(unit => unit.isReferenceUnit)
  const numericStart = allReference.findIndex((unit, i) => /^\d+$/.test(unit.text) && (i > 0 || !/^\d/.test(reference)))
  if (numericStart < 0) return { unsupported: true, decisions: [] }
  const numberUnits = allReference.slice(numericStart)
  const rangeAt = parsed.cues.find(cue => cue.range)?.range
  const spoken = parsed.numbers.map((number, index) => ({
    ...number,
    role: number.cue || (index === 0 || (rangeAt === index && (parsed.numbers.length - index === 2 || index === 1)) ? 'chapter' : 'verse'),
    range: rangeAt === index,
  }))
  const referenceTail = expected.canonicalReference.slice(expected.bookName.length).trim()
  const expectedNumbers = [...referenceTail.matchAll(/(\d+)([:–—-]?)/g)]
  const targets = numberUnits.map((unit, index) => ({
    unit,
    role: index === 0 || (expectedNumbers[index - 1]?.[2] !== ':' && expectedNumbers[index]?.[2] === ':') ||
      (expectedNumbers[index - 1]?.[2] === '-' && !referenceTail.includes(':')) ? 'chapter' : 'verse',
    range: /[-–—]/.test(expectedNumbers[index - 1]?.[2] || ''),
  }))
  if (spoken.length > targets.length) return { ambiguous: true, decisions: [] }
  const numericDecisions = []
  let cursor = 0
  for (const number of spoken) {
    const target = targets[cursor]
    if (!target) return { ambiguous: true, decisions: [] }
    if (number.role === target.role && number.range === target.range) {
      const sameValue = number.value === String(Number(target.unit.text))
      const wrong = !sameValue && clearNumberMismatch(number.value, target.unit.text)
      numericDecisions.push({
        index: target.unit.index,
        incorrect: wrong,
        accepted: sameValue ? VOICE_HEARD : (wrong ? VOICE_REPLACED : VOICE_BRIDGED),
      })
      cursor++
      continue
    }
    // Explicit chapter/verse labels can identify an omitted component, but only
    // with a later correct numeric anchor. Never invent absent trailing numbers.
    const anchor = targets.findIndex((candidate, index) => index > cursor && number.cue && candidate.role === number.role && number.value === String(Number(candidate.unit.text)))
    if (anchor < 0) return { ambiguous: true, decisions: [] }
    while (cursor < anchor) {
      numericDecisions.push({ index: targets[cursor++].unit.index, incorrect: false, accepted: VOICE_BRIDGED })
    }
    numericDecisions.push({ index: targets[cursor++].unit.index, incorrect: false, accepted: VOICE_HEARD })
  }
  if (cursor < targets.length) return { pending: true, decisions: [] }
  // An explicit, different book is a mistake; an unrecognized book remains
  // uncertain and keeps the benefit of the doubt.
  const bookWrong = !!parsed.book && parsed.book.id !== expected.bookId
  const bookDecisions = allReference.slice(0, numericStart).map(unit => ({
    index: unit.index,
    incorrect: bookWrong,
    accepted: bookWrong ? VOICE_REPLACED : (parsed.book ? VOICE_HEARD : VOICE_BRIDGED),
  }))
  return { decisions: [...bookDecisions, ...numericDecisions].filter(decision => decision.index >= startIndex) }
}
