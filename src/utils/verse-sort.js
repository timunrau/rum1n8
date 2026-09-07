import { BIBLE_BOOKS, parseVerseSpanReference } from './bible-reference.js'

export const VERSE_SORT_CRITERIA = Object.freeze([
	{ id: 'reference', label: 'Biblical order' },
	{ id: 'createdAt', label: 'Date added' },
	{ id: 'masteredAt', label: 'Date mastered' },
	{ id: 'lastReviewed', label: 'Last reviewed' },
	{ id: 'nextReviewDate', label: 'Next review' },
])

const CRITERION_IDS = new Set(VERSE_SORT_CRITERIA.map(criterion => criterion.id))
const DATE_CRITERIA = new Set(['createdAt', 'masteredAt', 'lastReviewed', 'nextReviewDate'])
const BOOK_INDEX_BY_ID = new Map(BIBLE_BOOKS.map((book, index) => [book.id, index]))

export function getDefaultVerseSortDirection(criterion = 'reference') {
	if (criterion === 'createdAt' || criterion === 'masteredAt') return 'desc'
	return 'asc'
}

export function normalizeVerseSortPreference(preference = {}) {
	const hasValidCriterion = CRITERION_IDS.has(preference?.criterion)
	const criterion = hasValidCriterion ? preference.criterion : 'reference'
	const direction = preference?.direction === 'asc' || preference?.direction === 'desc'
		? (hasValidCriterion ? preference.direction : getDefaultVerseSortDirection(criterion))
		: getDefaultVerseSortDirection(criterion)

	return { criterion, direction }
}

function compareText(a, b) {
	const aText = String(a || '')
	const bText = String(b || '')
	const aFolded = aText.toUpperCase()
	const bFolded = bText.toUpperCase()
	if (aFolded < bFolded) return -1
	if (aFolded > bFolded) return 1
	if (aText < bText) return -1
	if (aText > bText) return 1
	return 0
}

function parseTimestamp(value) {
	if (!value) return null
	const timestamp = new Date(value).getTime()
	return Number.isFinite(timestamp) ? timestamp : null
}

function getReferenceParts(reference = '') {
	const parsed = parseVerseSpanReference(String(reference || ''))
	if (!parsed) {
		return { available: false, book: Number.MAX_SAFE_INTEGER, chapter: 0, verse: 0 }
	}

	return {
		available: true,
		book: BOOK_INDEX_BY_ID.get(parsed.bookId) ?? Number.MAX_SAFE_INTEGER,
		chapter: parsed.startChapter,
		verse: parsed.startVerse,
	}
}

function compareReference(a, b, direction = 'asc') {
	const aReference = getReferenceParts(a?.reference)
	const bReference = getReferenceParts(b?.reference)

	if (aReference.available !== bReference.available) return aReference.available ? -1 : 1

	const sign = direction === 'desc' ? -1 : 1
	if (aReference.book !== bReference.book) return (aReference.book - bReference.book) * sign
	if (aReference.chapter !== bReference.chapter) return (aReference.chapter - bReference.chapter) * sign
	if (aReference.verse !== bReference.verse) return (aReference.verse - bReference.verse) * sign
	return 0
}

function compareTieBreakers(a, b) {
	const referenceComparison = compareReference(a, b)
	if (referenceComparison !== 0) return referenceComparison

	const versionComparison = compareText(a?.bibleVersion, b?.bibleVersion)
	if (versionComparison !== 0) return versionComparison

	const aCreatedAt = parseTimestamp(a?.createdAt)
	const bCreatedAt = parseTimestamp(b?.createdAt)
	if (aCreatedAt !== bCreatedAt) {
		if (aCreatedAt === null) return 1
		if (bCreatedAt === null) return -1
		return aCreatedAt - bCreatedAt
	}

	return compareText(a?.id, b?.id)
}

export function sortVerses(items = [], preference = {}) {
	const { criterion, direction } = normalizeVerseSortPreference(preference)
	const sign = direction === 'desc' ? -1 : 1

	return [...items].sort((a, b) => {
		if (criterion === 'reference') {
			const referenceComparison = compareReference(a, b, direction)
			return referenceComparison || compareTieBreakers(a, b)
		}

		const aValue = parseTimestamp(a?.[criterion])
		const bValue = parseTimestamp(b?.[criterion])
		if (aValue !== bValue) {
			if (aValue === null) return 1
			if (bValue === null) return -1
			return (aValue - bValue) * sign
		}

		return compareTieBreakers(a, b)
	})
}

export function hasVerseSortValues(items = [], criterion = 'reference') {
	if (criterion === 'reference') return items.length > 0
	if (!DATE_CRITERIA.has(criterion)) return false
	return items.some(item => parseTimestamp(item?.[criterion]) !== null)
}
