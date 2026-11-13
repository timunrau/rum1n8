import { describe, expect, it } from 'vitest'
import { buildVerseStats } from './verse-stats.js'

const now = new Date('2026-11-12T12:00:00.000Z')
const masteredVerse = () => ({
  memorizationStatus: 'mastered', masteredAt: '2026-10-01T12:00:00.000Z',
  lastReviewed: '2026-11-08T12:00:00.000Z', nextReviewDate: '2026-11-22T12:00:00.000Z',
  interval: 14, easeFactor: 1.68, reviewCount: 3, lastAccuracy: '93.8',
  reviewSchedule: { earnedInterval: 21, anchorDate: '2026-11-08T12:00:00.000Z', appliedMaximumDays: 14, forceDue: false },
  reviewHistory: [
    { date: '2026-11-08T12:00:00.000Z', accuracy: 100, mistakes: 0 },
    { date: '2026-10-20T12:00:00.000Z', accuracy: 82, mistakes: 9 },
    { date: '2026-11-08T08:00:00.000Z', accuracy: '98', mistakes: 1 },
    { date: '2026-11-01T12:00:00.000Z', accuracy: 92, mistakes: 4 },
  ],
})

describe('verse statistics', () => {
  it('counts saved reviews, averages accuracy, and plots results chronologically from mastery without mutation', () => {
    const verse = masteredVerse()
    const before = structuredClone(verse)
    const stats = buildVerseStats(verse, { maxReviewIntervalDays: 14 }, now)
    expect(stats.attempts).toBe(4)
    expect(stats.averageAccuracy).toBe(93)
    expect(stats.lastAccuracy).toBe(93.8)
    expect(stats.ease).toBe(1.68)
    expect(stats.chartHistory.map(review => review.accuracy)).toEqual([82, 92, 98, 100])
    expect(stats.chartStart).toBe(Date.parse(verse.masteredAt))
    expect(stats.chartEnd).toBe(Date.parse(verse.lastReviewed))
    expect(stats.schedule.earnedInterval).toBe(21)
    expect(stats.intervalDays).toBe(14)
    expect(stats.daysUntil).toBe(10)
    expect(stats.elapsedPercent).toBeCloseTo(4 / 14 * 100)
    expect(verse).toEqual(before)
  })

  it('measures the ribbon from the actual last review after a manual schedule change', () => {
    const verse = masteredVerse()
    verse.reviewSchedule.anchorDate = '2026-11-10T12:00:00.000Z'
    verse.nextReviewDate = '2026-11-24T12:00:00.000Z'
    const stats = buildVerseStats(verse, { maxReviewIntervalDays: 14 }, now)
    expect(stats.elapsedPercent).toBe(25)
    expect(stats.lastReview).toBe(Date.parse(verse.lastReviewed))
    expect(stats.schedule.anchorDate).toBe('2026-11-10T12:00:00.000Z')
  })

  it.each([['2026-11-01T12:00:00.000Z', 0], ['2026-11-30T12:00:00.000Z', 100]])('keeps the ribbon within its track at %s', (date, expected) => {
    expect(buildVerseStats(masteredVerse(), {}, new Date(date)).elapsedPercent).toBe(expected)
  })

  it('keeps missing and invalid results unavailable instead of treating them as zero', () => {
    const verse = { ...masteredVerse(), easeFactor: undefined, lastAccuracy: 'bad', reviewHistory: [
      null, 'bad', [], { date: 'bad', accuracy: 95, mistakes: 1 },
      { date: '2026-11-01T12:00:00.000Z', accuracy: null },
      { date: '2026-11-02T12:00:00.000Z', accuracy: 101 },
      { date: '2026-11-03T12:00:00.000Z', accuracy: '' },
      { date: '2026-11-04T12:00:00.000Z', accuracy: 0, mistakes: 10 },
    ] }
    const stats = buildVerseStats(verse, {}, now)
    expect(stats.attempts).toBe(5)
    expect(stats.averageAccuracy).toBe(47.5)
    expect(stats.chartHistory.map(review => review.accuracy)).toEqual([0])
    expect(stats.lastAccuracy).toBeNull()
    expect(stats.ease).toBeNull()
  })

  it('shows an empty unscheduled state for a new or reset verse', () => {
    const stats = buildVerseStats({ memorizationStatus: 'unmemorized', reviewHistory: [] }, {}, now)
    expect(stats.mastered).toBe(false)
    expect(stats.attempts).toBe(0)
    expect(stats.chartHistory).toEqual([])
    expect(stats.averageAccuracy).toBeNull()
    expect(stats.schedule).toBeNull()
    expect(stats.elapsedPercent).toBeNull()
  })

  it('handles a single legacy result without a mastery date or complete scheduling metadata', () => {
    const verse = { memorizationStatus: 'mastered', interval: 1, reviewHistory: [
      { date: '2026-11-11T12:00:00.000Z', accuracy: 100 },
    ] }
    const before = structuredClone(verse)
    const stats = buildVerseStats(verse, {}, now)
    expect(stats.chartStart).toBe(Date.parse('2026-11-11T12:00:00.000Z'))
    expect(stats.chartEnd).toBeGreaterThan(stats.chartStart)
    expect(stats.chartHistory).toHaveLength(1)
    expect(stats.elapsedPercent).toBeNull()
    expect(verse).toEqual(before)
  })
})
