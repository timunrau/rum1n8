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
  const units = []

  for (const token of tokens) {
    const hasLetters = /[a-zA-Z]/.test(token)
    if (hasLetters) {
      units.push({
        text: token,
        separatorAfter: '',
        firstLetter: (token.match(/[a-zA-Z0-9]/) || [''])[0].toLowerCase(),
        requiredLetters: [(token.match(/[a-zA-Z0-9]/) || [''])[0].toLowerCase()],
        typedLettersIndex: 0,
        revealed: false,
        visible: false,
        incorrect: false,
        incorrectLetterIndices: [],
        isReferenceUnit: true,
      })
      continue
    }

    const numberParts = [...token.matchAll(/(\d+)([:,-]?)/g)]
    if (numberParts.length > 0) {
      for (const [, digits, separatorAfter] of numberParts) {
        units.push({
          text: digits,
          separatorAfter: separatorAfter || '',
          firstLetter: digits[0].toLowerCase(),
          requiredLetters: digits.split('').map(char => char.toLowerCase()),
          typedLettersIndex: 0,
          revealed: false,
          visible: false,
          incorrect: false,
          incorrectLetterIndices: [],
          isReferenceUnit: true,
        })
      }
      continue
    }

    units.push({
      text: token,
      separatorAfter: '',
      firstLetter: token.charAt(0).toLowerCase(),
      requiredLetters: [token.charAt(0).toLowerCase()],
      typedLettersIndex: 0,
      revealed: false,
      visible: false,
      incorrect: false,
      incorrectLetterIndices: [],
      isReferenceUnit: true,
    })
  }

  return units.map((unit, index) => ({
    ...unit,
    index,
    isReferenceStart: index === 0,
  }))
}
