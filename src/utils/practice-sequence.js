function normalizeSourceState(sourceState) {
	if (!sourceState || typeof sourceState !== 'object' || Array.isArray(sourceState)) return null
	if (typeof sourceState.view !== 'string' || !sourceState.view) return null

	return {
		view: sourceState.view,
		...(sourceState.collectionId ? { collectionId: String(sourceState.collectionId) } : {}),
	}
}

export function normalizePracticeSequence(sequence) {
	if (!sequence || typeof sequence !== 'object' || Array.isArray(sequence)) return null
	if (!Array.isArray(sequence.verseIds)) return null

	const verseIds = [...new Set(sequence.verseIds.map(id => String(id || '')).filter(Boolean))]
	const cursor = Number(sequence.cursor)
	if (!verseIds.length || !Number.isInteger(cursor) || cursor < 0 || cursor >= verseIds.length) return null

	return {
		verseIds,
		cursor,
		sourceState: normalizeSourceState(sequence.sourceState),
	}
}

export function createPracticeSequence(orderedVerses = [], anchorId, sourceState = null) {
	const verseIds = [...new Set(orderedVerses.map(verse => String(verse?.id || '')).filter(Boolean))]
	const cursor = verseIds.indexOf(String(anchorId || ''))
	if (cursor < 0) return null

	return normalizePracticeSequence({ verseIds, cursor, sourceState })
}

function getVersesById(verses = []) {
	return new Map(verses.map(verse => [String(verse?.id || ''), verse]))
}

export function resolvePracticeSequenceVerse(sequence, verses = []) {
	const normalized = normalizePracticeSequence(sequence)
	if (!normalized) return null
	return getVersesById(verses).get(normalized.verseIds[normalized.cursor]) || null
}

export function movePracticeSequence(sequence, verses = [], offset = 1) {
	const normalized = normalizePracticeSequence(sequence)
	if (!normalized || !Number.isInteger(offset) || offset === 0) return null

	const direction = offset > 0 ? 1 : -1
	const versesById = getVersesById(verses)
	let index = normalized.cursor + direction

	while (index >= 0 && index < normalized.verseIds.length) {
		const verse = versesById.get(normalized.verseIds[index])
		if (verse) {
			return {
				verse,
				sequence: { ...normalized, cursor: index },
			}
		}
		index += direction
	}

	return null
}
