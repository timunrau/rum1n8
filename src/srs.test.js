import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { addReviewDays, reconcileReviewSchedule } from './review-schedule.js'
import { calculateGrade, updateEaseFactor, wasReviewedToday, calculateNextReviewDate } from './srs.js'

describe('calculateGrade', () => {
  it('returns 5 for perfect accuracy', () => {
    expect(calculateGrade(10, 0)).toBe(5)
  })

  it('returns 4 for 90-99% accuracy', () => {
    expect(calculateGrade(10, 1)).toBe(4) // 90%
  })

  it('returns 3 for 70-89% accuracy', () => {
    expect(calculateGrade(10, 2)).toBe(3) // 80%
    expect(calculateGrade(10, 3)).toBe(3) // 70%
  })

  it('returns 2 for 50-69% accuracy', () => {
    expect(calculateGrade(10, 4)).toBe(2) // 60%
    expect(calculateGrade(10, 5)).toBe(2) // 50%
  })

  it('returns 1 for 30-49% accuracy', () => {
    expect(calculateGrade(10, 6)).toBe(1) // 40%
    expect(calculateGrade(10, 7)).toBe(1) // 30%
  })

  it('returns 0 for <30% accuracy', () => {
    expect(calculateGrade(10, 8)).toBe(0) // 20%
    expect(calculateGrade(10, 10)).toBe(0) // 0%
  })

  it('returns 0 for zero total words', () => {
    expect(calculateGrade(0, 0)).toBe(0)
  })
})

describe('updateEaseFactor', () => {
  it('increases EF for grade 5 (perfect)', () => {
    const ef = updateEaseFactor(2.5, 5)
    expect(ef).toBeCloseTo(2.6)
  })

  it('does not decrease EF for grade 4', () => {
    const ef = updateEaseFactor(2.5, 4)
    expect(ef).toBeGreaterThanOrEqual(2.5)
  })

  it('decreases EF for grade 0', () => {
    const ef = updateEaseFactor(2.5, 0)
    expect(ef).toBeLessThan(2.5)
  })

  it('floors EF at 1.3', () => {
    const ef = updateEaseFactor(1.3, 0)
    expect(ef).toBe(1.3)
  })

  it('does not go below 1.3 even with repeated failures', () => {
    let ef = 2.5
    for (let i = 0; i < 20; i++) {
      ef = updateEaseFactor(ef, 0)
    }
    expect(ef).toBe(1.3)
  })
})

describe('wasReviewedToday', () => {
  it('returns false when no lastReviewed', () => {
    expect(wasReviewedToday({})).toBe(false)
  })

  it('returns true when reviewed today', () => {
    expect(wasReviewedToday({ lastReviewed: new Date().toISOString() })).toBe(true)
  })

  it('returns false when reviewed yesterday', () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString()
    expect(wasReviewedToday({ lastReviewed: yesterday })).toBe(false)
  })
})

describe('calculateNextReviewDate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-28T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const baseVerse = {
    easeFactor: 2.5,
    interval: 0,
    reviewCount: 0,
    lastReviewed: null,
    nextReviewDate: null,
  }

  describe('interval progression for passing grades', () => {
    it('review 0 -> 1 day interval', () => {
      const result = calculateNextReviewDate({ ...baseVerse, reviewCount: 0 }, 5, true)
      expect(result.interval).toBe(1)
    })

    it('review 1 -> 1 day interval', () => {
      const result = calculateNextReviewDate({ ...baseVerse, reviewCount: 1 }, 5, true)
      expect(result.interval).toBe(1)
    })

    it('review 2 -> 2 day interval', () => {
      const result = calculateNextReviewDate({ ...baseVerse, reviewCount: 2 }, 5, true)
      expect(result.interval).toBe(2)
    })

    it('review 3 -> 3 day interval', () => {
      const result = calculateNextReviewDate({ ...baseVerse, reviewCount: 3 }, 5, true)
      expect(result.interval).toBe(3)
    })

    it('review 4 -> 4 day interval', () => {
      const result = calculateNextReviewDate({ ...baseVerse, reviewCount: 4 }, 5, true)
      expect(result.interval).toBe(4)
    })

    it('established interval multiplied by ease factor', () => {
      const verse = { ...baseVerse, reviewCount: 10, interval: 14, easeFactor: 2.5 }
      const result = calculateNextReviewDate(verse, 5, true)
      // EF after grade 5: 2.5 + 0.1 = 2.6
      expect(result.interval).toBeCloseTo(14 * 2.6)
      expect(result.easeFactor).toBeCloseTo(2.6)
    })

    it('custom short interval bypasses the early review ladder', () => {
      const verse = {
        ...baseVerse,
        reviewCount: 0,
        interval: 3,
        reviewScheduleCustomized: true,
      }
      const result = calculateNextReviewDate(verse, 5, true)

      expect(result.interval).toBeCloseTo(3 * 2.6)
    })

    it('custom interval remains capped at 90 days', () => {
      const verse = {
        ...baseVerse,
        reviewCount: 0,
        interval: 90,
        reviewScheduleCustomized: true,
      }
      const result = calculateNextReviewDate(verse, 5, true)

      expect(result.interval).toBe(90)
    })

    it('caps interval at 90 days', () => {
      const verse = { ...baseVerse, reviewCount: 10, interval: 80, easeFactor: 2.5 }
      const result = calculateNextReviewDate(verse, 5, true)
      expect(result.interval).toBe(90)
    })
  })

  describe('failed grades (0-3, below 90% accuracy) proportionally reduce interval', () => {
    it('grade 0 (<30% accuracy) resets to 1 day (minimum)', () => {
      const verse = { ...baseVerse, reviewCount: 10, interval: 90, easeFactor: 2.5 }
      const result = calculateNextReviewDate(verse, 0, true)
      expect(result.interval).toBe(1)
    })

    it('grade 1 (30-49%) reduces interval to ~17% of previous', () => {
      const verse = { ...baseVerse, reviewCount: 10, interval: 60, easeFactor: 2.5 }
      const result = calculateNextReviewDate(verse, 1, true)
      // 60 * (1/6) = 10
      expect(result.interval).toBeCloseTo(10)
    })

    it('grade 2 (50-69%) reduces interval to ~33% of previous', () => {
      const verse = { ...baseVerse, reviewCount: 10, interval: 60, easeFactor: 2.5 }
      const result = calculateNextReviewDate(verse, 2, true)
      // 60 * (2/6) = 20
      expect(result.interval).toBeCloseTo(20)
    })

    it('grade 3 (70-89%) reduces interval to ~50% of previous', () => {
      const verse = { ...baseVerse, reviewCount: 10, interval: 90, easeFactor: 2.5 }
      const result = calculateNextReviewDate(verse, 3, true)
      // 90 * (3/6) = 45
      expect(result.interval).toBeCloseTo(45)
    })

    it('never goes below 1 day', () => {
      const verse = { ...baseVerse, reviewCount: 0, interval: 1, easeFactor: 2.5 }
      const result = calculateNextReviewDate(verse, 0, true)
      expect(result.interval).toBe(1)
    })

    it('reduces ease factor by 20% on failed grade', () => {
      const verse = { ...baseVerse, easeFactor: 2.5, interval: 14 }
      const result = calculateNextReviewDate(verse, 0, true)
      const efAfterSM2 = updateEaseFactor(2.5, 0)
      expect(result.easeFactor).toBeCloseTo(Math.max(1.3, efAfterSM2 * 0.8))
    })

    it('failed grade on established verse proportionally reduces interval', () => {
      const verse = { ...baseVerse, reviewCount: 10, interval: 14, easeFactor: 2.5 }
      const result = calculateNextReviewDate(verse, 1, true)
      // 14 * (1/6) ≈ 2.33
      expect(result.interval).toBeCloseTo(14 / 6)
    })
  })

  describe('same-day review prevention', () => {
    it('does not advance when already reviewed today and isNewReview is false', () => {
      const verse = {
        ...baseVerse,
        lastReviewed: new Date().toISOString(),
        nextReviewDate: new Date(Date.now() + 86400000).toISOString(),
        interval: 14,
      }
      const result = calculateNextReviewDate(verse, 5, false)
      expect(result.interval).toBe(14)
      expect(result.nextReviewDate).toBe(verse.nextReviewDate)
    })

    it('does advance when isNewReview is true even if reviewed today', () => {
      const verse = {
        ...baseVerse,
        lastReviewed: new Date().toISOString(),
        nextReviewDate: new Date(Date.now() + 86400000).toISOString(),
        interval: 14,
        reviewCount: 10,
      }
      const result = calculateNextReviewDate(verse, 5, true)
      expect(result.interval).toBeGreaterThan(14)
    })
  })
})

describe('Rotation scheduling and earned spacing', () => {
  const now = new Date(2026, 8, 20, 12)
  const makeVerse = (interval = 14, gap = 1) => ({
    memorizationStatus: 'mastered', interval, easeFactor: 2.5, reviewCount: 10,
    lastReviewed: addReviewDays(now, -gap), nextReviewDate: addReviewDays(now, interval - gap),
  })
  const review = (verse, grade = 5, options = {}) => calculateNextReviewDate(verse, grade, true, {
    now, reviewMode: 'rotation', maxReviewIntervalDays: 90, ...options,
  })

  it('daily successful practice cannot rapidly earn a 90-day interval or inflate ease indefinitely', () => {
    let verse = { interval: 0, easeFactor: 2.5, reviewCount: 0, memorizationStatus: 'mastered' }
    const intervals = []
    for (let day = 0; day < 120; day++) {
      const reviewedAt = new Date(addReviewDays(now, day))
      const result = review(verse, 5, { now: reviewedAt })
      intervals.push(result.interval)
      verse = { ...verse, ...result, lastReviewed: reviewedAt.toISOString(), reviewCount: verse.reviewCount + 1 }
    }
    expect(Math.max(...intervals)).toBeLessThan(4)
    expect(verse.easeFactor).toBeLessThan(3)
  })

  it('earns growth from a meaningful early gap without claiming the full scheduled gap', () => {
    const result = review(makeVerse(14, 10))
    expect(result.interval).toBe(25)
    expect(result.easeFactor).toBe(2.5)
    expect(result.reviewSchedule.earnedInterval).toBe(25)
  })

  it('preserves established spacing after extra practice but grows after the full gap', () => {
    expect(review(makeVerse(30, 1)).interval).toBe(30)
    const result = review(makeVerse(14, 14))
    expect(result.interval).toBeCloseTo(36.4)
    expect(result.easeFactor).toBeCloseTo(2.6)
  })

  it.each([null, 'invalid', addReviewDays(now, 2)])('uses a conservative gap for missing or invalid review history (%s)', lastReviewed => {
    const result = review({ ...makeVerse(14), lastReviewed })
    expect(result.interval).toBe(14)
    expect(result.easeFactor).toBe(2.5)
  })

  it('uses local calendar days across midnight instead of elapsed 24-hour periods', () => {
    const result = review({ ...makeVerse(14), lastReviewed: new Date(2026, 8, 10, 23, 50).toISOString() }, 5, {
      now: new Date(2026, 8, 20, 0, 10),
    })
    expect(result.interval).toBe(25)
  })

  it('a weak early review shortens earned spacing using the actual shorter gap', () => {
    const result = review(makeVerse(30, 4), 3)
    expect(result.interval).toBe(2)
    expect(result.reviewSchedule.earnedInterval).toBe(2)
    expect(result.easeFactor).toBeLessThan(2.5)
  })

  it.each(['classic', 'rotation'])('a lower maximum preserves earned spacing after success in %s', reviewMode => {
    const verse = makeVerse(90, 30)
    reconcileReviewSchedule(verse, 30, now)
    const result = review(verse, 4, { reviewMode, maxReviewIntervalDays: 30 })
    expect(result.interval).toBe(30)
    expect(result.reviewSchedule.earnedInterval).toBe(90)
    Object.assign(verse, result)
    reconcileReviewSchedule(verse, 90, now)
    expect(verse.interval).toBe(90)
    expect(verse.nextReviewDate).toBe(addReviewDays(now, 90))
  })

  it.each(['classic', 'rotation'])('raising the maximum cannot undo a weak capped review in %s', reviewMode => {
    const verse = makeVerse(90, 40)
    reconcileReviewSchedule(verse, 30, now)
    Object.assign(verse, review(verse, 3, { reviewMode, maxReviewIntervalDays: 30 }))
    reconcileReviewSchedule(verse, 365, now)
    expect(verse.interval).toBe(15)
    expect(verse.reviewSchedule.earnedInterval).toBe(15)
  })

  it('Classic retains its early-review growth while Rotation preserves earned spacing', () => {
    const verse = makeVerse(14, 1)
    expect(review(verse, 5, { reviewMode: 'classic' }).interval).toBeCloseTo(36.4)
    expect(review(verse).interval).toBe(14)
  })

  it('same-day repeats preserve the entire previously saved schedule', () => {
    const verse = makeVerse(30, 0)
    reconcileReviewSchedule(verse, 90, now)
    const result = calculateNextReviewDate(verse, 0, false, { now, reviewMode: 'rotation' })
    expect(result.interval).toBe(verse.interval)
    expect(result.nextReviewDate).toBe(verse.nextReviewDate)
    expect(result.reviewSchedule).toEqual(verse.reviewSchedule)
    expect(result.easeFactor).toBe(verse.easeFactor)
  })

  it('permits longer earned spacing when the configured maximum is raised', () => {
    const result = review(makeVerse(90, 90), 5, { maxReviewIntervalDays: 365 })
    expect(result.interval).toBeCloseTo(234)
  })
})
