const BOOK_ID_VARIATIONS = {
  psalm: 'psa', psalms: 'psa', ps: 'psa',
  genesis: 'gen', gen: 'gen',
  exodus: 'exo', exod: 'exo', ex: 'exo',
  leviticus: 'lev', lev: 'lev',
  numbers: 'num', num: 'num',
  deuteronomy: 'deu', deut: 'deu',
  joshua: 'jos', josh: 'jos',
  judges: 'jdg', judg: 'jdg',
  ruth: 'rut',
  '1samuel': '1sa', '1sam': '1sa',
  '2samuel': '2sa', '2sam': '2sa',
  '1kings': '1ki', '1kgs': '1ki',
  '2kings': '2ki', '2kgs': '2ki',
  '1chronicles': '1ch', '1chr': '1ch',
  '2chronicles': '2ch', '2chr': '2ch',
  ezra: 'ezr',
  nehemiah: 'neh', neh: 'neh',
  esther: 'est', esth: 'est',
  job: 'job',
  proverbs: 'pro', prov: 'pro',
  ecclesiastes: 'ecc', eccl: 'ecc',
  songofsolomon: 'sng', songofsongs: 'sng', song: 'sng', sos: 'sng',
  isaiah: 'isa', isa: 'isa',
  jeremiah: 'jer', jer: 'jer',
  lamentations: 'lam', lam: 'lam',
  ezekiel: 'ezk', ezek: 'ezk',
  daniel: 'dan', dan: 'dan',
  hosea: 'hos', hos: 'hos',
  joel: 'jol', joe: 'jol',
  amos: 'amo', amo: 'amo',
  obadiah: 'oba', obad: 'oba',
  jonah: 'jon', jon: 'jon',
  micah: 'mic', mic: 'mic',
  nahum: 'nam', nah: 'nam',
  habakkuk: 'hab', hab: 'hab',
  zephaniah: 'zep', zeph: 'zep',
  haggai: 'hag', hag: 'hag',
  zechariah: 'zec', zech: 'zec',
  malachi: 'mal', mal: 'mal',
  matthew: 'mat', matt: 'mat', mt: 'mat',
  mark: 'mrk', mk: 'mrk', mar: 'mrk',
  luke: 'luk', lk: 'luk',
  john: 'jhn', jn: 'jhn',
  acts: 'act',
  romans: 'rom', rom: 'rom',
  '1corinthians': '1co', '1cor': '1co',
  '2corinthians': '2co', '2cor': '2co',
  galatians: 'gal', gal: 'gal',
  ephesians: 'eph', eph: 'eph',
  philippians: 'php', phil: 'php',
  colossians: 'col', col: 'col',
  '1thessalonians': '1th', '1thess': '1th',
  '2thessalonians': '2th', '2thess': '2th',
  '1timothy': '1ti', '1tim': '1ti',
  '2timothy': '2ti', '2tim': '2ti',
  titus: 'tit', tit: 'tit',
  philemon: 'phm', phlm: 'phm',
  hebrews: 'heb', heb: 'heb',
  james: 'jas', jam: 'jas',
  '1peter': '1pe', '1pet': '1pe',
  '2peter': '2pe', '2pet': '2pe',
  '1john': '1jn', '1jn': '1jn',
  '2john': '2jn', '2jn': '2jn',
  '3john': '3jn', '3jn': '3jn',
  jude: 'jud',
  revelation: 'rev', rev: 'rev'
}

function normalizeBookName(bookName = '') {
  return bookName.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function formatBibleVersionLabel(version = '') {
  return version?.trim() ? version.trim().toUpperCase() : 'no version'
}

export function getBibleBookId(bookName = '') {
  const normalizedName = normalizeBookName(bookName)
  if (!normalizedName) return ''

  if (BOOK_ID_VARIATIONS[normalizedName]) {
    return BOOK_ID_VARIATIONS[normalizedName]
  }

  return normalizedName.substring(0, 3)
}

export function parseSimpleVerseReference(reference = '') {
  const trimmed = reference.trim()
  if (!trimmed) return null

  const match = trimmed.match(/^((?:\d+\s*)?[A-Za-z.]+(?:\s+[A-Za-z.]+)*)\s+(\d+):(\d+)(?:-(\d+))?$/)
  if (!match) return null

  const bookName = match[1].trim().replace(/\s+/g, ' ')
  const chapter = parseInt(match[2], 10)
  const verseStart = parseInt(match[3], 10)
  const verseEnd = match[4] ? parseInt(match[4], 10) : verseStart
  const bookId = getBibleBookId(bookName)

  if (!bookId || chapter < 1 || verseStart < 1 || verseEnd < verseStart) {
    return null
  }

  return {
    bookName,
    bookId,
    chapter,
    verseStart,
    verseEnd,
    normalized: `${bookId} ${chapter}:${verseStart}${verseEnd > verseStart ? `-${verseEnd}` : ''}`
  }
}

function referencesOverlap(referenceA, referenceB) {
  return (
    referenceA.bookId === referenceB.bookId &&
    referenceA.chapter === referenceB.chapter &&
    referenceA.verseStart <= referenceB.verseEnd &&
    referenceB.verseStart <= referenceA.verseEnd
  )
}

export function findReferenceMatches(reference = '', verses = [], options = {}) {
  const parsedReference = parseSimpleVerseReference(reference)
  if (!parsedReference) return []

  const excludeVerseId = options.excludeVerseId || null

  return verses
    .map((verse) => {
      if (!verse || (excludeVerseId && verse.id === excludeVerseId)) return null

      const parsedExisting = parseSimpleVerseReference(verse.reference || '')
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
