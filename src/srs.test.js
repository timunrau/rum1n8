import { describe, it, expect } from 'vitest'
import { addReviewDays, applyReviewFrequencyOverride, reconcileReviewSchedule } from './review-schedule.js'
import { calculateGrade, updateEaseFactor, wasReviewedToday, calculateNextReviewDate, applyReviewSchedule, SRS_VERSION, DEFAULT_EASE_FACTOR } from './srs.js'

describe('calculateGrade', () => {
  it('returns 5 for perfect accuracy', () => {
    expect(calculateGrade(10, 0)).toBe(5)
  })

  it('returns 4 for 90-94% accuracy', () => {
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


describe('shared review scheduling', () => {
  const now = new Date(2026, 8, 20, 12)
  const makeVerse = (interval = 30, gap = 4, extra = {}) => ({
    memorizationStatus: 'mastered', interval, easeFactor: 2.5, reviewCount: 10,
    lastReviewed: addReviewDays(now, -gap), nextReviewDate: addReviewDays(now, interval - gap),
    ...extra,
  })
  const review = (verse, grade = 5, options = {}) => calculateNextReviewDate(verse, grade, false, { now, ...options })

  it.each([[100, 0, 5], [100, 1, 4.5], [100, 5, 4.5], [100, 6, 4], [100, 10, 4], [100, 11, 3]])(
    'grades %i units and %i mistakes as %s', (total, mistakes, grade) => {
      expect(calculateGrade(total, mistakes)).toBe(grade)
    })

  it.each([[5, 2.5 + 0.1 * 4 / 30, 30], [4.5, 2.5 + 0.055 * 4 / 30, 30],
    [4, 2.5, 30], [3, 2.36, 15], [2, 2.18, 10], [1, 1.96, 5], [0, 1.7, 1]])(
    'uses the agreed early-review result for grade %s', (grade, ease, interval) => {
      const result = review(makeVerse(), grade)
      expect(result.easeFactor).toBeCloseTo(ease)
      expect(result.interval).toBeCloseTo(interval)
      expect(result.nextReviewDate).toBe(addReviewDays(now, interval))
    })

  it.each([0, 1, 2, 3, 4, 4.5, 5])('review order never affects grade %s scheduling', grade => {
    for (const gap of [1, 4, 30, 60]) {
      const verse = makeVerse(30, gap)
      expect(review(verse, grade, { reviewMode: 'classic' })).toEqual(review(verse, grade, { reviewMode: 'rotation' }))
    }
  })

  it('allows modest early growth and full growth after the earned gap', () => {
    expect(review(makeVerse(14, 10)).interval).toBeCloseTo(10 * (2.5 + 0.1 * 10 / 14))
    expect(review(makeVerse(14, 14)).interval).toBeCloseTo(36.4)
    expect(review(makeVerse(14, 40)).interval).toBeCloseTo(36.4)
  })

  it.each([1.3, 1.5])('starts at one day and escapes whole-day rounding with ease %s, without a ladder', ease => {
    let verse = { interval: 0, reviewCount: 0, easeFactor: ease, srsVersion: SRS_VERSION }
    let at = now
    const gaps = []
    for (let i = 0; i < 10; i++) {
      const result = review(verse, 4, { now: at })
      gaps.push(Math.floor(result.interval))
      if (i > 0) expect(result.interval).toBeCloseTo(Math.min(90, verse.interval * ease))
      verse = { ...verse, ...result, lastReviewed: at.toISOString(), reviewCount: i + 1 }
      at = new Date(result.nextReviewDate)
    }
    expect(gaps[0]).toBe(1)
    expect(gaps[9]).toBeGreaterThan(5)
  })

  it('daily early practice preserves long spacing with small positive ease adjustments', () => {
    let verse = makeVerse()
    for (let i = 0; i < 120; i++) {
      const at = new Date(addReviewDays(now, i))
      const before = verse.easeFactor
      const result = review(verse, 5, { now: at })
      expect(result.interval).toBe(30)
      expect(result.easeFactor - before).toBeCloseTo(0.1 * (i === 0 ? 4 : 1) / 30)
      verse = { ...verse, ...result, lastReviewed: at.toISOString() }
    }
  })

  it.each([null, 'invalid', addReviewDays(now, 2)])('uses a conservative one-day fallback for %s', lastReviewed => {
    const result = review(makeVerse(14, 1, { lastReviewed }))
    expect(result.interval).toBe(14)
    expect(result.easeFactor).toBeCloseTo(2.5 + 0.1 / 14)
  })

  it('uses local calendar days across midnight', () => {
    const result = review(makeVerse(14, 10, { lastReviewed: new Date(2026, 8, 10, 23, 50).toISOString() }), 5, {
      now: new Date(2026, 8, 20, 0, 10),
    })
    expect(result.interval).toBeCloseTo(10 * (2.5 + 0.1 * 10 / 14))
  })

  it('weights ease against applied spacing when a maximum caps earned spacing', () => {
    const verse = makeVerse(90, 30)
    reconcileReviewSchedule(verse, 30, now)
    const result = review(verse, 5, { maxReviewIntervalDays: 30 })
    expect(result.easeFactor).toBeCloseTo(2.6)
    expect(result.interval).toBe(30)
    expect(result.reviewSchedule.earnedInterval).toBe(90)
    Object.assign(verse, result)
    reconcileReviewSchedule(verse, 90, now)
    expect(verse.interval).toBe(90)
  })

  it('maximum increases cannot restore spacing lost on a weak capped review', () => {
    const verse = makeVerse(90, 40)
    reconcileReviewSchedule(verse, 30, now)
    Object.assign(verse, review(verse, 3, { maxReviewIntervalDays: 30 }))
    reconcileReviewSchedule(verse, 365, now)
    expect(verse.interval).toBe(15)
  })

  it('respects the configured and absolute maximums', () => {
    expect(review(makeVerse(90, 90)).interval).toBe(90)
    expect(review(makeVerse(90, 90), 5, { maxReviewIntervalDays: 365 }).interval).toBeCloseTo(234)
    expect(review(makeVerse(300, 300), 5, { maxReviewIntervalDays: 365 }).interval).toBe(365)
  })

  it.each([0, 4.5, 5])('same-day grade %s does not count or transition even with the old bypass argument', grade => {
    const verse = makeVerse(3, 0, { reviewCount: 2 })
    const before = structuredClone(verse)
    applyReviewSchedule(verse, grade, { now })
    expect(verse).toMatchObject(before)
    expect(verse.srsVersion).toBeUndefined()
    expect(calculateNextReviewDate(verse, grade, true, { now }).interval).toBe(3)
  })

  it('a missing same-day date does not bypass protection', () => {
    const verse = makeVerse(3, 0, { nextReviewDate: null })
    applyReviewSchedule(verse, 0, { now })
    expect(verse.easeFactor).toBe(2.5)
    expect(verse.nextReviewDate).toBeNull()
    expect(verse.interval).toBe(3)
    expect(verse.reviewCount).toBe(10)
    expect(verse.srsVersion).toBeUndefined()
  })

  it.each([0, 5])('same-day Review now clears the request without grading again (%s)', grade => {
    const verse = makeVerse(30, 0)
    applyReviewFrequencyOverride(verse, 0, now)
    applyReviewSchedule(verse, grade, { now })
    expect(verse).toMatchObject({ easeFactor: 2.5, interval: 30, reviewCount: 10,
      nextReviewDate: addReviewDays(now, 30), reviewSchedule: { earnedInterval: 30, forceDue: false } })
    expect(verse.srsVersion).toBeUndefined()
  })

  it('transitions ladder verses once, without editing the input during calculation', () => {
    const verse = makeVerse(2, 2, { reviewCount: 2 })
    const before = structuredClone(verse)
    expect(review(verse, 4.5).easeFactor).toBeCloseTo(1.555)
    expect(verse).toEqual(before)
    applyReviewSchedule(verse, 4.5, { now })
    expect(verse).toMatchObject({ srsVersion: SRS_VERSION, reviewCount: 3 })
    expect(verse.easeFactor).toBeCloseTo(1.555)
    const next = new Date(verse.nextReviewDate)
    verse.lastReviewed = now.toISOString()
    applyReviewSchedule(verse, 4.5, { now: next })
    expect(verse.easeFactor).toBeCloseTo(1.61)
  })

  it.each([
    { reviewCount: 5 }, { reviewScheduleCustomized: true }, { interval: 10 },
    { srsVersion: SRS_VERSION },
  ])('preserves existing ease outside the legacy ladder: %j', extra => {
    expect(review(makeVerse(2, 2, { reviewCount: 2, ...extra }), 4).easeFactor).toBe(2.5)
  })

  it('does not mistake a capped established interval for a ladder interval', () => {
    const verse = makeVerse(90, 30, { reviewCount: 2 })
    reconcileReviewSchedule(verse, 3, now)
    expect(review(verse, 4, { maxReviewIntervalDays: 3 }).easeFactor).toBe(2.5)
  })

  it('preserves lower legacy ease and supplies the default for missing ease', () => {
    expect(review(makeVerse(2, 2, { reviewCount: 2, easeFactor: 1.3 }), 4).easeFactor).toBe(1.3)
    expect(review(makeVerse(0, 1, { easeFactor: undefined }), 4).easeFactor).toBe(DEFAULT_EASE_FACTOR)
    expect(review(makeVerse(30, 4, { easeFactor: 1.3 }), 0).easeFactor).toBe(1.3)
  })
})
