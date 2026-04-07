export function normalizeReferenceForTyping(reference = '') {
  const trimmed = reference.trim()
  if (!trimmed) return ''

  const chapterVerseMatch = trimmed.match(/(\d[\d:,\-\s]*)$/)
  const chapterVersePart = chapterVerseMatch ? chapterVerseMatch[1] : ''
  const bookPart = chapterVerseMatch ? trimmed.slice(0, trimmed.length - chapterVersePart.length).trim() : trimmed

  const numericPrefixMatch = bookPart.match(/^\d+/)
  const numericPrefix = numericPrefixMatch ? numericPrefixMatch[0] : ''
  const bookInitials = bookPart
    .replace(/^\d+\s*/, '')
    .split(/\s+/)
    .map(part => (part.match(/[a-zA-Z]/) || [''])[0].toLowerCase())
    .join('')
  const numericReference = chapterVersePart.replace(/\D/g, '')

  return `${numericPrefix}${bookInitials}${numericReference}`
}

export function buildReferencePracticeUnits(reference = '') {
  const tokens = reference.trim().split(/\s+/).filter(Boolean)

  return tokens.map((token, index) => {
    const alphanumericChars = token.match(/[a-zA-Z0-9]/g) || []
    const hasLetters = /[a-zA-Z]/.test(token)
    const requiredLetters = hasLetters
      ? [(token.match(/[a-zA-Z0-9]/) || [''])[0].toLowerCase()]
      : alphanumericChars.map(char => char.toLowerCase())

    return {
      text: token,
      separatorAfter: '',
      firstLetter: requiredLetters[0],
      requiredLetters,
      typedLettersIndex: 0,
      revealed: false,
      visible: false,
      incorrect: false,
      index,
      isReferenceUnit: true,
      isReferenceStart: index === 0
    }
  })
}
