import { describe, expect, it } from 'vitest'
import {
  addReviewDays, applyReviewFrequencyOverride, getReviewFrequencyOptions,
  getReviewSchedule, normalizeMaxReviewInterval, previewReviewMaximum,
  reconcileReviewSchedule, reconcileReviewSchedules, REVIEW_FREQUENCY_OPTIONS, sortReviewVerses,
} from './review-schedule.js'

describe('review frequency overrides', () => {
  const now = new Date('2026-07-09T12:00:00.000Z')

  it('offers intervals through 90 days', () => {
    expect(REVIEW_FREQUENCY_OPTIONS.map(option => option.days)).toEqual([1, 3, 7, 14, 30, 60, 90])
  })

  it('sets the next review and adaptive interval baseline', () => {
    const verse = { interval: 30, nextReviewDate: null, lastModified: null }

    applyReviewFrequencyOverride(verse, 7, now)

    expect(verse.nextReviewDate).toBe('2026-07-16T12:00:00.000Z')
    expect(verse.interval).toBe(7)
    expect(verse.reviewScheduleCustomized).toBe(true)
    expect(verse.lastModified).toBe(now.toISOString())
  })

  it('makes a verse due now without changing its interval baseline', () => {
    const verse = {
      interval: 30,
      reviewScheduleCustomized: true,
      nextReviewDate: null,
      lastModified: null,
    }

    applyReviewFrequencyOverride(verse, 0, now)

    expect(verse.nextReviewDate).toBe(now.toISOString())
    expect(verse.interval).toBe(30)
    expect(verse.reviewScheduleCustomized).toBe(true)
  })
})

describe('maximum review intervals', () => {
  const anchor = new Date(2026, 8, 1, 12)
  const now = new Date(2026, 9, 11, 12)
  const makeVerse = (overrides = {}) => ({
    id: 'verse', memorizationStatus: 'mastered', interval: 90, reviewCount: 10,
    easeFactor: 2.5, lastReviewed: anchor.toISOString(), lastModified: anchor.toISOString(),
    nextReviewDate: addReviewDays(anchor, 90), reviewHistory: [{ date: anchor.toISOString(), grade: 5 }],
    ...overrides,
  })

  it.each([0, -1, 366, 1.5, '30', null, undefined, NaN])('defaults invalid limits (%s) to 90', value => {
    expect(normalizeMaxReviewInterval(value)).toBe(90)
  })

  it.each([1, 30, 365])('accepts a whole-day limit of %i', value => {
    expect(normalizeMaxReviewInterval(value)).toBe(value)
  })

  it('filters manual choices and includes a custom maximum exactly once', () => {
    expect(getReviewFrequencyOptions(10).map(option => option.days)).toEqual([1, 3, 7, 10])
    expect(getReviewFrequencyOptions(30).map(option => option.days)).toEqual([1, 3, 7, 14, 30])
    expect(getReviewFrequencyOptions(365).at(-1).days).toBe(365)
  })

  it('initializes legacy metadata without moving dates or changing performance history', () => {
    const verse = makeVerse()
    const before = structuredClone(verse)
    expect(reconcileReviewSchedule(verse, 90, now)).toBe(true)
    expect(verse).toMatchObject(before)
    expect(verse.reviewSchedule.earnedInterval).toBe(90)
    expect(reconcileReviewSchedule(verse, 90, now)).toBe(false)
  })

  it('makes an old review due under a lower cap and restores its exact original date', () => {
    const verse = makeVerse()
    const original = structuredClone(verse)
    reconcileReviewSchedule(verse, 30, now)
    expect(verse.interval).toBe(30)
    expect(new Date(verse.nextReviewDate).getTime()).toBeLessThan(now.getTime())
    expect(verse.reviewSchedule.earnedInterval).toBe(90)
    reconcileReviewSchedule(verse, 90, now)
    expect(verse).toMatchObject(original)
  })

  it('limits extensions to earned spacing and leaves unmastered verses untouched', () => {
    const verse = makeVerse({ interval: 14, nextReviewDate: addReviewDays(anchor, 14) })
    const unmemorized = makeVerse({ memorizationStatus: 'unmemorized', interval: 0, nextReviewDate: null })
    const original = structuredClone(unmemorized)
    reconcileReviewSchedules([verse, unmemorized], 365, now)
    expect(verse.interval).toBe(14)
    expect(verse.nextReviewDate).toBe(addReviewDays(anchor, 14))
    expect(unmemorized).toEqual(original)
  })

  it('previews both directions without mutating verses or their metadata', () => {
    const verse = makeVerse()
    reconcileReviewSchedule(verse, 90, now)
    const original = structuredClone(verse)
    expect(previewReviewMaximum([verse], 30, now)).toEqual({ earlier: 1, later: 0, becomingDue: 1, noLongerDue: 0 })
    expect(verse).toEqual(original)
    reconcileReviewSchedule(verse, 30, now)
    expect(previewReviewMaximum([verse], 90, now)).toEqual({ earlier: 0, later: 1, becomingDue: 0, noLongerDue: 1 })
  })

  it('keeps explicit Review now due when limits are changed', () => {
    const verse = makeVerse()
    applyReviewFrequencyOverride(verse, 0, now, 90)
    reconcileReviewSchedule(verse, 1, now)
    reconcileReviewSchedule(verse, 365, now)
    expect(verse.nextReviewDate).toBe(now.toISOString())
    expect(verse.reviewSchedule).toMatchObject({ forceDue: true, earnedInterval: 90 })
  })

  it('uses the time of a positive manual override as its anchor and new baseline', () => {
    const verse = makeVerse()
    applyReviewFrequencyOverride(verse, 14, now, 30)
    reconcileReviewSchedule(verse, 7, now)
    expect(verse.nextReviewDate).toBe(addReviewDays(now, 7))
    reconcileReviewSchedule(verse, 90, now)
    expect(verse.interval).toBe(14)
    expect(verse.nextReviewDate).toBe(addReviewDays(now, 14))
    expect(() => applyReviewFrequencyOverride(verse, 31, now, 30)).toThrow(RangeError)
  })

  it('recovers a schedule changed by an older client instead of restoring obsolete metadata', () => {
    const verse = makeVerse()
    reconcileReviewSchedule(verse, 30, now)
    verse.interval = 7
    verse.nextReviewDate = addReviewDays(now, 7)
    verse.lastReviewed = now.toISOString()
    reconcileReviewSchedule(verse, 90, now)
    expect(verse.interval).toBe(7)
    expect(verse.nextReviewDate).toBe(addReviewDays(now, 7))
    expect(verse.reviewSchedule.earnedInterval).toBe(7)
  })

  it('recovers malformed metadata and anchors missing schedules to recorded history', () => {
    const verse = makeVerse({ reviewSchedule: { earnedInterval: NaN, anchorDate: 'invalid' } })
    expect(getReviewSchedule(verse, now).earnedInterval).toBe(90)
    const missing = makeVerse({ nextReviewDate: null })
    reconcileReviewSchedule(missing, 30, now)
    expect(missing.nextReviewDate).toBe(anchor.toISOString())
  })
})

describe('review ordering', () => {
  const now = new Date(2026, 7, 8, 9)
  const date = days => addReviewDays(now, days)
  const makeVerse = (id, daysUntil, daysSince) => ({
    id, memorizationStatus: 'mastered', nextReviewDate: date(daysUntil),
    lastReviewed: daysSince === null ? null : date(-daysSince),
  })

  it('places due verses first and rotates remaining verses by least recent practice', () => {
    const verses = [
      makeVerse('recent', 1, 0), makeVerse('old', 9, 12),
      makeVerse('due-today', 0, 1), makeVerse('overdue', -2, 3), makeVerse('never', 30, null),
      { ...makeVerse('learning', -3, null), memorizationStatus: 'learned' },
    ]
    const original = structuredClone(verses)
    expect(sortReviewVerses(verses, 'rotation', now).map(v => v.id)).toEqual(['overdue', 'due-today', 'never', 'old', 'recent'])
    expect(sortReviewVerses(verses, 'classic', now).map(v => v.id)).toEqual(['overdue', 'due-today', 'recent', 'old', 'never'])
    expect(verses).toEqual(original)
  })

  it('breaks Rotation ties by next date then ID, including reviews later today', () => {
    const verses = [makeVerse('b', 2, 5), makeVerse('a', 2, 5), makeVerse('earlier', 1, 5)]
    const laterToday = { ...makeVerse('today', 0, 0), nextReviewDate: new Date(2026, 7, 8, 23).toISOString() }
    expect(sortReviewVerses([...verses, laterToday], 'rotation', now).map(v => v.id)).toEqual(['today', 'earlier', 'a', 'b'])
  })
})
