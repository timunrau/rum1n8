import { PassageReference } from '@gracious.tech/bible-references'

export const BIBLE_BOOKS = [
  { id: 'gen', name: 'Genesis', aliases: ['gen', 'ge', 'gn'] },
  { id: 'exo', name: 'Exodus', aliases: ['exod', 'exo', 'ex'] },
  { id: 'lev', name: 'Leviticus', aliases: ['lev', 'lv'] },
  { id: 'num', name: 'Numbers', aliases: ['num', 'numb', 'nu', 'nm'] },
  { id: 'deu', name: 'Deuteronomy', aliases: ['deut', 'deu', 'dt'] },
  { id: 'jos', name: 'Joshua', aliases: ['josh', 'jos'] },
  { id: 'jdg', name: 'Judges', aliases: ['judg', 'jdg', 'jg'] },
  { id: 'rut', name: 'Ruth', aliases: ['ruth', 'rut', 'ru', 'rth'] },
  { id: '1sa', name: '1 Samuel', aliases: ['1samuel', '1sam', '1sa', '1sm', 'firstsamuel', 'firstsam', 'isamuel', 'isam'] },
  { id: '2sa', name: '2 Samuel', aliases: ['2samuel', '2sam', '2sa', '2sm', 'secondsamuel', 'secondsam', 'iisamuel', 'iisam'] },
  { id: '1ki', name: '1 Kings', aliases: ['1kings', '1kgs', '1ki', '1kg', 'firstkings', 'firstkgs', 'ikings', 'ikgs'] },
  { id: '2ki', name: '2 Kings', aliases: ['2kings', '2kgs', '2ki', '2kg', 'secondkings', 'secondkgs', 'iikings', 'iikgs'] },
  { id: '1ch', name: '1 Chronicles', aliases: ['1chronicles', '1chron', '1chr', '1ch', 'firstchronicles', 'firstchron', 'ichronicles', 'ichron'] },
  { id: '2ch', name: '2 Chronicles', aliases: ['2chronicles', '2chron', '2chr', '2ch', 'secondchronicles', 'secondchron', 'iichronicles', 'iichron'] },
  { id: 'ezr', name: 'Ezra', aliases: ['ezra', 'ezr'] },
  { id: 'neh', name: 'Nehemiah', aliases: ['neh', 'ne'] },
  { id: 'est', name: 'Esther', aliases: ['esther', 'esth', 'est'] },
  { id: 'job', name: 'Job', aliases: ['job'] },
  { id: 'psa', name: 'Psalms', aliases: ['psalm', 'psalms', 'psa', 'ps', 'pss'] },
  { id: 'pro', name: 'Proverbs', aliases: ['proverbs', 'prov', 'pro', 'prv'] },
  { id: 'ecc', name: 'Ecclesiastes', aliases: ['ecclesiastes', 'eccl', 'ecc', 'qoheleth'] },
  { id: 'sng', name: 'Song of Solomon', aliases: ['songofsolomon', 'songofsongs', 'song', 'sos', 'sng', 'canticles'] },
  { id: 'isa', name: 'Isaiah', aliases: ['isaiah', 'isa', 'is'] },
  { id: 'jer', name: 'Jeremiah', aliases: ['jeremiah', 'jer'] },
  { id: 'lam', name: 'Lamentations', aliases: ['lamentations', 'lam'] },
  { id: 'ezk', name: 'Ezekiel', aliases: ['ezekiel', 'ezek', 'ezk', 'eze'] },
  { id: 'dan', name: 'Daniel', aliases: ['daniel', 'dan', 'dn'] },
  { id: 'hos', name: 'Hosea', aliases: ['hosea', 'hos'] },
  { id: 'jol', name: 'Joel', aliases: ['joel', 'jol', 'joe'] },
  { id: 'amo', name: 'Amos', aliases: ['amos', 'amo', 'am'] },
  { id: 'oba', name: 'Obadiah', aliases: ['obadiah', 'obad', 'oba'] },
  { id: 'jon', name: 'Jonah', aliases: ['jonah', 'jon'] },
  { id: 'mic', name: 'Micah', aliases: ['micah', 'mic'] },
  { id: 'nam', name: 'Nahum', aliases: ['nahum', 'nah', 'nam'] },
  { id: 'hab', name: 'Habakkuk', aliases: ['habakkuk', 'hab'] },
  { id: 'zep', name: 'Zephaniah', aliases: ['zephaniah', 'zeph', 'zep'] },
  { id: 'hag', name: 'Haggai', aliases: ['haggai', 'hag'] },
  { id: 'zec', name: 'Zechariah', aliases: ['zechariah', 'zech', 'zec'] },
  { id: 'mal', name: 'Malachi', aliases: ['malachi', 'mal'] },
  { id: 'mat', name: 'Matthew', aliases: ['matthew', 'matt', 'mat', 'mt'] },
  { id: 'mrk', name: 'Mark', aliases: ['mark', 'mrk', 'mk', 'mar'] },
  { id: 'luk', name: 'Luke', aliases: ['luke', 'luk', 'lk'] },
  { id: 'jhn', name: 'John', aliases: ['john', 'jhn', 'jn'] },
  { id: 'act', name: 'Acts', aliases: ['acts', 'act', 'ac'] },
  { id: 'rom', name: 'Romans', aliases: ['romans', 'rom', 'ro'] },
  { id: '1co', name: '1 Corinthians', aliases: ['1corinthians', '1cor', '1co', 'firstcorinthians', 'firstcor', 'icorinthians', 'icor'] },
  { id: '2co', name: '2 Corinthians', aliases: ['2corinthians', '2cor', '2co', 'secondcorinthians', 'secondcor', 'iicorinthians', 'iicor'] },
  { id: 'gal', name: 'Galatians', aliases: ['galatians', 'gal'] },
  { id: 'eph', name: 'Ephesians', aliases: ['ephesians', 'eph'] },
  { id: 'php', name: 'Philippians', aliases: ['philippians', 'php'] },
  { id: 'col', name: 'Colossians', aliases: ['colossians', 'col'] },
  { id: '1th', name: '1 Thessalonians', aliases: ['1thessalonians', '1thess', '1th', 'firstthessalonians', 'firstthess', 'ithessalonians', 'ithess'] },
  { id: '2th', name: '2 Thessalonians', aliases: ['2thessalonians', '2thess', '2th', 'secondthessalonians', 'secondthess', 'iithessalonians', 'iithess'] },
  { id: '1ti', name: '1 Timothy', aliases: ['1timothy', '1tim', '1ti', 'firsttimothy', 'firsttim', 'itimothy', 'itim'] },
  { id: '2ti', name: '2 Timothy', aliases: ['2timothy', '2tim', '2ti', 'secondtimothy', 'secondtim', 'iitimothy', 'iitim'] },
  { id: 'tit', name: 'Titus', aliases: ['titus', 'tit'] },
  { id: 'phm', name: 'Philemon', aliases: ['philemon', 'phm', 'phlm'] },
  { id: 'heb', name: 'Hebrews', aliases: ['hebrews', 'heb'] },
  { id: 'jas', name: 'James', aliases: ['james', 'jas', 'jam'] },
  { id: '1pe', name: '1 Peter', aliases: ['1peter', '1pet', '1pe', 'firstpeter', 'firstpet', 'ipeter', 'ipet'] },
  { id: '2pe', name: '2 Peter', aliases: ['2peter', '2pet', '2pe', 'secondpeter', 'secondpet', 'iipeter', 'iipet'] },
  { id: '1jn', name: '1 John', aliases: ['1john', '1jhn', '1jn', 'firstjohn', 'firstjn', 'ijohn', 'ijn'] },
  { id: '2jn', name: '2 John', aliases: ['2john', '2jhn', '2jn', 'secondjohn', 'secondjn', 'iijohn', 'iijn'] },
  { id: '3jn', name: '3 John', aliases: ['3john', '3jhn', '3jn', 'thirdjohn', 'thirdjn', 'iiijohn', 'iiijn'] },
  { id: 'jud', name: 'Jude', aliases: ['jude', 'jud'] },
  { id: 'rev', name: 'Revelation', aliases: ['revelation', 'rev', 're'] }
]

const BOOKS_BY_ID = new Map(BIBLE_BOOKS.map((book) => [book.id, book]))
const BOOK_NAMES_BY_ID = Object.fromEntries(BIBLE_BOOKS.map((book) => [book.id, book.name]))
const ALIASES_BY_NORMALIZED_NAME = BIBLE_BOOKS.reduce((aliases, book) => {
  const names = [book.name, ...book.aliases]
  names.forEach((name) => {
    const normalizedName = normalizeBookName(name)
    if (!normalizedName) return
    if (!aliases.has(normalizedName)) {
      aliases.set(normalizedName, new Set())
    }
    aliases.get(normalizedName).add(book.id)
  })
  return aliases
}, new Map())

export function normalizeBookName(bookName = '') {
  return bookName.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function formatBibleVersionLabel(version = '') {
  return version?.trim() ? version.trim().toUpperCase() : 'no version'
}

function getExactBookMatch(normalizedName) {
  const matchingIds = ALIASES_BY_NORMALIZED_NAME.get(normalizedName)
  if (!matchingIds || matchingIds.size !== 1) return null
  return BOOKS_BY_ID.get([...matchingIds][0]) || null
}

function getPrefixBookMatches(normalizedName) {
  if (!normalizedName) return []

  return BIBLE_BOOKS.filter((book) => {
    const names = [book.name, ...book.aliases]
    return names.some((name) => normalizeBookName(name).startsWith(normalizedName))
  })
}

export function getBibleBook(bookName = '') {
  const normalizedName = normalizeBookName(bookName)
  if (!normalizedName) return null

  const exactMatch = getExactBookMatch(normalizedName)
  if (exactMatch) return exactMatch

  const prefixMatches = getPrefixBookMatches(normalizedName)
  return prefixMatches.length === 1 ? prefixMatches[0] : null
}

export function getBibleBookId(bookName = '') {
  return getBibleBook(bookName)?.id || ''
}

function hasStartedChapter(reference = '') {
  const trimmed = reference.trim()
  if (!trimmed || trimmed.includes(':') || trimmed.includes('-') || trimmed.includes(',')) return true

  const parts = trimmed.split(/\s+/)
  if (parts.length < 2) return false

  const lastPart = parts[parts.length - 1]
  return /^\d+$/.test(lastPart) && !!getBibleBook(parts.slice(0, -1).join(' '))
}

export function getBibleBookSuggestion(reference = '') {
  if (/\s$/.test(reference)) return null

  const fragment = reference.trim()
  if (!fragment || hasStartedChapter(fragment)) return null

  const normalizedName = normalizeBookName(fragment)
  const book = getBibleBook(fragment)
  if (!book) return null

  const canonicalName = normalizeBookName(book.name)
  if (normalizedName === canonicalName || !canonicalName.startsWith(normalizedName)) return null

  return book
}

export function parseSimpleVerseReference(reference = '') {
  const trimmed = reference.trim().replace(/\s+/g, ' ')
  if (!trimmed) return null

  const match = trimmed.match(/^(.+?)\s+(\d+)\s*:\s*(\d+)(?:\s*-\s*(\d+))?$/)
  if (!match) return null

  const book = getBibleBook(match[1])
  const chapter = parseInt(match[2], 10)
  const verseStart = parseInt(match[3], 10)
  const verseEnd = match[4] ? parseInt(match[4], 10) : verseStart

  if (!book || chapter < 1 || verseStart < 1 || verseEnd < verseStart) {
    return null
  }

  const canonicalReference = `${book.name} ${chapter}:${verseStart}${verseEnd > verseStart ? `-${verseEnd}` : ''}`

  return {
    bookName: book.name,
    bookId: book.id,
    chapter,
    verseStart,
    verseEnd,
    canonicalReference,
    normalized: `${book.id} ${chapter}:${verseStart}${verseEnd > verseStart ? `-${verseEnd}` : ''}`
  }
}

export function normalizeVerseReference(reference = '') {
  return parseVerseSpanReference(reference)?.canonicalReference || ''
}

export function parseVerseSpanReference(reference = '') {
  const trimmed = reference.trim().replace(/\s+/g, ' ')
  if (!trimmed || trimmed.includes(',')) return null

  const match = trimmed.match(/^(.+?)\s+(\d+)\s*:\s*(\d+)(?:\s*-\s*(?:(\d+)\s*:\s*)?(\d+))?$/)
  if (!match) return null

  const book = getBibleBook(match[1])
  const startChapter = parseInt(match[2], 10)
  const startVerse = parseInt(match[3], 10)
  const endChapter = match[4] ? parseInt(match[4], 10) : startChapter
  const endVerse = match[5] ? parseInt(match[5], 10) : startVerse

  if (!book || startChapter < 1 || startVerse < 1 || endChapter < 1 || endVerse < 1) {
    return null
  }

  const passage = new PassageReference({
    book: book.id,
    start_chapter: startChapter,
    start_verse: startVerse,
    end_chapter: endChapter,
    end_verse: endVerse
  })

  if (!passage.args_valid || !['verse', 'range_verses', 'range_multi'].includes(passage.type)) {
    return null
  }

  const canonicalReference = passage.toString(BOOK_NAMES_BY_ID)
  const normalizedVerses = passage.get_verses_string()

  return {
    bookName: book.name,
    bookId: book.id,
    chapter: passage.start_chapter,
    verseStart: passage.start_verse,
    verseEnd: passage.end_verse,
    startChapter: passage.start_chapter,
    startVerse: passage.start_verse,
    endChapter: passage.end_chapter,
    endVerse: passage.end_verse,
    canonicalReference,
    normalized: `${book.id} ${normalizedVerses}`,
    totalVerses: passage.total_verses(),
    passage
  }
}

export function areVerseSpansContiguous(referenceA, referenceB) {
  const parsedA = typeof referenceA === 'string' ? parseVerseSpanReference(referenceA) : referenceA
  const parsedB = typeof referenceB === 'string' ? parseVerseSpanReference(referenceB) : referenceB
  if (!parsedA || !parsedB || parsedA.bookId !== parsedB.bookId) return false

  const nextVerse = parsedA.passage.get_next_verse(true)
  return !!(
    nextVerse &&
    nextVerse.start_chapter === parsedB.startChapter &&
    nextVerse.start_verse === parsedB.startVerse
  )
}

export function combineVerseSpans(references = []) {
  const parsedReferences = references
    .map((reference) => (typeof reference === 'string' ? parseVerseSpanReference(reference) : reference))
    .filter(Boolean)

  if (!parsedReferences.length) return null

  const first = parsedReferences[0]
  const last = parsedReferences[parsedReferences.length - 1]
  if (parsedReferences.some((reference) => reference.bookId !== first.bookId)) return null

  const passage = PassageReference.from_refs(first.passage, last.passage)
  const book = BOOKS_BY_ID.get(first.bookId)
  if (!book) return null

  return {
    bookName: book.name,
    bookId: book.id,
    chapter: passage.start_chapter,
    verseStart: passage.start_verse,
    verseEnd: passage.end_verse,
    startChapter: passage.start_chapter,
    startVerse: passage.start_verse,
    endChapter: passage.end_chapter,
    endVerse: passage.end_verse,
    canonicalReference: passage.toString(BOOK_NAMES_BY_ID),
    normalized: `${book.id} ${passage.get_verses_string()}`,
    totalVerses: passage.total_verses(),
    passage
  }
}

function referencesOverlap(referenceA, referenceB) {
  return (
    referenceA.bookId === referenceB.bookId &&
    !referenceA.passage.is_before(referenceB.startChapter, referenceB.startVerse) &&
    !referenceA.passage.is_after(referenceB.endChapter, referenceB.endVerse)
  )
}

export function findReferenceMatches(reference = '', verses = [], options = {}) {
  const parsedReference = parseVerseSpanReference(reference)
  if (!parsedReference) return []

  const excludeVerseId = options.excludeVerseId || null

  return verses
    .map((verse) => {
      if (!verse || (excludeVerseId && verse.id === excludeVerseId)) return null

      const parsedExisting = parseVerseSpanReference(verse.reference || '')
      if (!parsedExisting) return null

      const exact = parsedReference.normalized === parsedExisting.normalized
      const overlap = !exact && referencesOverlap(parsedReference, parsedExisting)
      if (!exact && !overlap) return null

      return {
        id: verse.id,
        reference: typeof verse.reference === 'string' ? verse.reference.trim() : '',
        bibleVersion: typeof verse.bibleVersion === 'string' ? verse.bibleVersion.trim().toUpperCase() : '',
        matchType: exact ? 'exact' : 'overlap'
      }
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.matchType !== b.matchType) {
        return a.matchType === 'exact' ? -1 : 1
      }

      return a.reference.localeCompare(b.reference) || a.bibleVersion.localeCompare(b.bibleVersion)
    })
}

export function formatReferenceMatchSummary(matches = []) {
  if (!matches.length) return ''

  const labels = matches.map(match => `${match.reference} (${formatBibleVersionLabel(match.bibleVersion)})`)
  return `Already in your library: ${labels.join('; ')}`
}
