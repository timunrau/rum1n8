import {
  areVerseSpansContiguous,
  combineVerseSpans,
  parseVerseSpanReference
} from './bible-reference.js'

function normalizeVersion(version = '') {
  return String(version || '').trim().toUpperCase()
}

function isReviewablePassageRecord(verse) {
  return verse?.memorizationStatus === 'mastered' && !!parseVerseSpanReference(verse.reference || '')
}

export function getPassageReviewSequence(anchorVerse, sourceVerses = []) {
  if (!isReviewablePassageRecord(anchorVerse)) return []

  const anchorIndex = sourceVerses.findIndex((verse) => verse?.id === anchorVerse.id)
  if (anchorIndex < 0) return []

  const anchorVersion = normalizeVersion(anchorVerse.bibleVersion)
  const sequence = [anchorVerse]
  let previousSpan = parseVerseSpanReference(anchorVerse.reference)

  for (const candidate of sourceVerses.slice(anchorIndex + 1)) {
    if (!isReviewablePassageRecord(candidate)) break
    if (normalizeVersion(candidate.bibleVersion) !== anchorVersion) break

    const candidateSpan = parseVerseSpanReference(candidate.reference)
    if (!areVerseSpansContiguous(previousSpan, candidateSpan)) break

    sequence.push(candidate)
    previousSpan = candidateSpan
  }

  return sequence.length > 1 ? sequence : []
}

export function buildPassageReviewVerse(records = []) {
  if (!records.length) return null

  const combinedSpan = combineVerseSpans(records.map((record) => record.reference))
  if (!combinedSpan) return null

  return {
    id: `passage-review-${records.map((record) => record.id).join('-')}`,
    reference: combinedSpan.canonicalReference,
    content: records
      .map((record) => String(record.content || '').trim())
      .filter(Boolean)
      .join('\n\n'),
    bibleVersion: records[0]?.bibleVersion || '',
    memorizationStatus: 'mastered',
    passageRecordIds: records.map((record) => record.id)
  }
}

export function calculatePassageSegmentAccuracy(totalUnits, mistakes) {
  if (!totalUnits) return 0
  return ((totalUnits - mistakes) / totalUnits) * 100
}
