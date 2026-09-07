import { describe, expect, it } from 'vitest'
import {
	getDefaultVerseSortDirection,
	hasVerseSortValues,
	normalizeVerseSortPreference,
	sortVerses,
} from './verse-sort.js'

const verse = (id, reference, overrides = {}) => ({
	id,
	reference,
	bibleVersion: 'BSB',
	createdAt: '2026-01-01T00:00:00.000Z',
	masteredAt: null,
	lastReviewed: null,
	nextReviewDate: null,
	...overrides,
})

describe('verse sorting', () => {
	it('defines the natural direction for every criterion', () => {
		expect(getDefaultVerseSortDirection('reference')).toBe('asc')
		expect(getDefaultVerseSortDirection('alphabetical')).toBe('asc')
		expect(getDefaultVerseSortDirection('createdAt')).toBe('desc')
		expect(getDefaultVerseSortDirection('masteredAt')).toBe('desc')
		expect(getDefaultVerseSortDirection('lastReviewed')).toBe('asc')
		expect(getDefaultVerseSortDirection('nextReviewDate')).toBe('asc')
	})

	it('sorts references alphabetically with natural chapter and verse ordering', () => {
		const input = [
			verse('psalm', 'Psalm 1:1'),
			verse('acts-10', 'Acts 10:1'),
			verse('john', 'John 3:16'),
			verse('acts-2-10', 'Acts 2:10'),
			verse('acts-2-2', 'Acts 2:2'),
		]

		expect(sortVerses(input, { criterion: 'alphabetical', direction: 'asc' }).map(item => item.id))
			.toEqual(['acts-2-2', 'acts-2-10', 'acts-10', 'john', 'psalm'])
		expect(sortVerses(input, { criterion: 'alphabetical', direction: 'desc' }).map(item => item.id))
			.toEqual(['psalm', 'john', 'acts-10', 'acts-2-10', 'acts-2-2'])
	})

	it('places missing and invalid references last for alphabetical sorting', () => {
		const input = [
			verse('missing', ''),
			verse('psalm', 'Psalm 1:1'),
			verse('invalid', 'not a reference'),
			verse('acts', 'Acts 1:1'),
		]

		expect(sortVerses(input, { criterion: 'alphabetical', direction: 'asc' }).map(item => item.id))
			.toEqual(['acts', 'psalm', 'invalid', 'missing'])
		expect(sortVerses(input, { criterion: 'alphabetical', direction: 'desc' }).map(item => item.id))
			.toEqual(['psalm', 'acts', 'invalid', 'missing'])
	})

	it('normalizes missing and invalid preferences', () => {
		expect(normalizeVerseSortPreference()).toEqual({ criterion: 'reference', direction: 'asc' })
		expect(normalizeVerseSortPreference({ criterion: 'unknown', direction: 'sideways' })).toEqual({
			criterion: 'reference',
			direction: 'asc',
		})
		expect(normalizeVerseSortPreference({ criterion: 'unknown', direction: 'desc' })).toEqual({
			criterion: 'reference',
			direction: 'asc',
		})
		expect(normalizeVerseSortPreference({ criterion: 'masteredAt', direction: 'sideways' })).toEqual({
			criterion: 'masteredAt',
			direction: 'desc',
		})
	})

	it('places missing and invalid references last in either direction', () => {
		const input = [
			verse('missing', ''),
			verse('john', 'John 3:16'),
			verse('invalid', 'not a reference'),
			verse('genesis', 'Genesis 1:1'),
		]

		expect(sortVerses(input, { criterion: 'reference', direction: 'asc' }).map(item => item.id))
			.toEqual(['genesis', 'john', 'invalid', 'missing'])
		expect(sortVerses(input, { criterion: 'reference', direction: 'desc' }).map(item => item.id))
			.toEqual(['john', 'genesis', 'invalid', 'missing'])
	})

	it('sorts biblical references in both directions without mutating the input', () => {
		const input = [
			verse('john', 'John 3:16'),
			verse('psalm', 'Psalm 23:1'),
			verse('genesis', 'Genesis 1:1'),
		]
		const original = [...input]

		expect(sortVerses(input, { criterion: 'reference', direction: 'asc' }).map(item => item.id))
			.toEqual(['genesis', 'psalm', 'john'])
		expect(sortVerses(input, { criterion: 'reference', direction: 'desc' }).map(item => item.id))
			.toEqual(['john', 'psalm', 'genesis'])
		expect(input).toEqual(original)
	})

	it.each([
		['createdAt', 'createdAt'],
		['masteredAt', 'masteredAt'],
		['lastReviewed', 'lastReviewed'],
		['nextReviewDate', 'nextReviewDate'],
	])('sorts %s dates in both directions', (criterion, field) => {
		const input = [
			verse('middle', 'Psalm 2:1', { [field]: '2026-02-02T00:00:00.000Z' }),
			verse('newest', 'Psalm 3:1', { [field]: '2026-03-03T00:00:00.000Z' }),
			verse('oldest', 'Psalm 1:1', { [field]: '2026-01-01T00:00:00.000Z' }),
		]

		expect(sortVerses(input, { criterion, direction: 'asc' }).map(item => item.id))
			.toEqual(['oldest', 'middle', 'newest'])
		expect(sortVerses(input, { criterion, direction: 'desc' }).map(item => item.id))
			.toEqual(['newest', 'middle', 'oldest'])
	})

	it('places missing and invalid primary dates last in either direction', () => {
		const input = [
			verse('missing', 'Psalm 4:1'),
			verse('newer', 'Psalm 2:1', { masteredAt: '2026-02-01T00:00:00.000Z' }),
			verse('invalid', 'Psalm 3:1', { masteredAt: 'not-a-date' }),
			verse('older', 'Psalm 1:1', { masteredAt: '2026-01-01T00:00:00.000Z' }),
		]

		expect(sortVerses(input, { criterion: 'masteredAt', direction: 'asc' }).map(item => item.id))
			.toEqual(['older', 'newer', 'invalid', 'missing'])
		expect(sortVerses(input, { criterion: 'masteredAt', direction: 'desc' }).map(item => item.id))
			.toEqual(['newer', 'older', 'invalid', 'missing'])
	})

	it('uses deterministic reference, version, creation, and id tie-breakers', () => {
		const timestamp = '2026-02-01T00:00:00.000Z'
		const input = [
			verse('z', 'Psalm 2:1', { bibleVersion: 'ESV', createdAt: timestamp, masteredAt: timestamp }),
			verse('b', 'Psalm 1:1', { bibleVersion: 'ESV', createdAt: timestamp, masteredAt: timestamp }),
			verse('a', 'Psalm 1:1', { bibleVersion: 'ESV', createdAt: timestamp, masteredAt: timestamp }),
			verse('older', 'Psalm 1:1', { bibleVersion: 'BSB', createdAt: '2026-01-01T00:00:00.000Z', masteredAt: timestamp }),
		]

		expect(sortVerses(input, { criterion: 'masteredAt', direction: 'desc' }).map(item => item.id))
			.toEqual(['older', 'a', 'b', 'z'])
	})

	it('reports whether a date criterion has at least one usable value', () => {
		const input = [
			verse('missing', 'Psalm 1:1'),
			verse('invalid', 'Psalm 2:1', { masteredAt: 'invalid' }),
		]

		expect(hasVerseSortValues(input, 'reference')).toBe(true)
		expect(hasVerseSortValues(input, 'alphabetical')).toBe(true)
		expect(hasVerseSortValues(input, 'masteredAt')).toBe(false)
		expect(hasVerseSortValues([...input, verse('dated', 'Psalm 3:1', { masteredAt: '2026-02-01T00:00:00.000Z' })], 'masteredAt')).toBe(true)
	})
})
