import { parseVerseSpanReference } from './bible-reference.js'

const SMALL_NUMBERS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen',
]
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']
const BOOK_ORDINALS = { 1: 'First', 2: 'Second', 3: 'Third' }

// Valid Bible chapter and verse numbers are all below one thousand.
function numberForSpeech(number) {
  if (number < 20) return SMALL_NUMBERS[number]
  if (number < 100) {
    const tens = TENS[Math.floor(number / 10)]
    return number % 10 ? `${tens}-${SMALL_NUMBERS[number % 10]}` : tens
  }
  const hundreds = `${SMALL_NUMBERS[Math.floor(number / 100)]} hundred`
  return number % 100 ? `${hundreds} ${numberForSpeech(number % 100)}` : hundreds
}

export function formatReferenceForSpeech(reference = '') {
  const parsed = parseVerseSpanReference(reference.replace(/[–—]/g, '-'))
  if (!parsed) return reference

  const { bookId, startChapter, endChapter, startVerse, endVerse, passage, isWholeChapter } = parsed
  let bookName = parsed.bookName.replace(/^([123])\s/, (_, number) => `${BOOK_ORDINALS[number]} `)
  if (bookId === 'psa' && startChapter === endChapter) bookName = 'Psalm'

  const opening = `${bookName} ${numberForSpeech(startChapter)}`
  if (isWholeChapter) return opening
  if (passage.type === 'range_chapters') return `${opening} to ${numberForSpeech(endChapter)}`
  if (startChapter !== endChapter) {
    return `${opening} verse ${numberForSpeech(startVerse)} to chapter ${numberForSpeech(endChapter)} verse ${numberForSpeech(endVerse)}`
  }
  if (startVerse === endVerse) return `${opening} verse ${numberForSpeech(startVerse)}`
  return `${opening} verses ${numberForSpeech(startVerse)} to ${numberForSpeech(endVerse)}`
}
