import { describe, expect, it } from 'vitest'
import {
	createPracticeSequence,
	movePracticeSequence,
	normalizePracticeSequence,
	resolvePracticeSequenceVerse,
} from './practice-sequence.js'

const verse = (id, overrides = {}) => ({ id, reference: id, ...overrides })

describe('practice sequence', () => {
	it('snapshots the supplied visible order and anchor cursor', () => {
		const sequence = createPracticeSequence(
			[verse('third'), verse('first'), verse('second')],
			'first',
			{ view: 'collection', collectionId: 'promises' }
		)

		expect(sequence).toEqual({
			verseIds: ['third', 'first', 'second'],
			cursor: 1,
			sourceState: { view: 'collection', collectionId: 'promises' },
		})
	})

	it('keeps navigation order frozen when sort-driving fields change', () => {
		const original = [
			verse('oldest', { lastReviewed: '2026-01-01T00:00:00.000Z' }),
			verse('middle', { lastReviewed: '2026-02-01T00:00:00.000Z' }),
			verse('newest', { lastReviewed: '2026-03-01T00:00:00.000Z' }),
		]
		const sequence = createPracticeSequence(original, 'oldest')
		const updated = original.map(item => (
			item.id === 'oldest'
				? { ...item, lastReviewed: '2026-04-01T00:00:00.000Z' }
				: item
		))

		expect(movePracticeSequence(sequence, updated, 1)?.verse.id).toBe('middle')
	})

	it('resolves the latest record instead of returning a copied snapshot object', () => {
		const sequence = createPracticeSequence([verse('a'), verse('b', { content: 'Before' })], 'a')
		const current = [verse('a'), verse('b', { content: 'After' })]

		expect(movePracticeSequence(sequence, current, 1)?.verse.content).toBe('After')
	})

	it('excludes additions and skips deleted verse ids', () => {
		const sequence = createPracticeSequence([verse('a'), verse('b'), verse('c')], 'a')
		const current = [verse('a'), verse('added'), verse('c')]

		const moved = movePracticeSequence(sequence, current, 1)
		expect(moved?.verse.id).toBe('c')
		expect(moved?.sequence.cursor).toBe(2)
		expect(movePracticeSequence(moved.sequence, current, 1)).toBeNull()
	})

	it('preserves the cursor when the same sequence is handed between practice modes', () => {
		const records = [verse('mastered'), verse('learning'), verse('later')]
		const started = createPracticeSequence(records, 'mastered')
		const handoff = movePracticeSequence(started, records, 1)

		expect(handoff?.verse.id).toBe('learning')
		expect(movePracticeSequence(handoff.sequence, records, 1)?.verse.id).toBe('later')
		expect(movePracticeSequence(handoff.sequence, records, -1)?.verse.id).toBe('mastered')
	})

	it('normalizes a serialized history-state sequence without changing its order', () => {
		const serialized = JSON.parse(JSON.stringify({
			verseIds: ['c', 'a', 'b'],
			cursor: 1,
			sourceState: { view: 'collection', collectionId: 'history' },
		}))
		const restored = normalizePracticeSequence(serialized)

		expect(restored).toEqual(serialized)
		expect(resolvePracticeSequenceVerse(restored, [verse('a'), verse('b'), verse('c')])?.id).toBe('a')
	})

	it('rejects invalid anchors and malformed serialized values', () => {
		expect(createPracticeSequence([verse('a')], 'missing')).toBeNull()
		expect(normalizePracticeSequence({ verseIds: [], cursor: 0 })).toBeNull()
		expect(normalizePracticeSequence({ verseIds: ['a'], cursor: 2 })).toBeNull()
	})
})
