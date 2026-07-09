import { describe, expect, it } from 'vitest'
import { applyReviewFrequencyOverride, REVIEW_FREQUENCY_OPTIONS } from './review-schedule.js'

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
