import { getLocalCalendarDayDifference } from './utils/local-date.js'
import { addReviewDays, getReviewSchedule, normalizeMaxReviewInterval } from './review-schedule.js'

// One SM-2-inspired scheduler; review order never changes memory estimates.
export const DEFAULT_EASE_FACTOR = 1.5
export const SRS_VERSION = 2

// Calculate grade (0-5) based on accuracy
// Grades 4–5 pass; 4.5 distinguishes nearly perfect recall.
export function calculateGrade(totalWords, mistakes) {
  if (totalWords === 0) return 0

  const accuracy = (totalWords - mistakes) / totalWords

  if (accuracy >= 1.0) return 5 // Perfect
  if (accuracy >= 0.95) return 4.5 // Nearly perfect (95-99%)
  if (accuracy >= 0.9) return 4 // Excellent (90-94%)
  if (accuracy >= 0.7) return 3 // Good (70-89%)
  if (accuracy >= 0.5) return 2 // Hard (50-69%)
  if (accuracy >= 0.3) return 1 // Again (30-49%)
  return 0 // Complete failure (<30%)
}

// Update ease factor based on grade (SM-2 algorithm)
export function updateEaseFactor(currentEF, grade) {
  // Adjust ease with the SM-2 formula (fractional grades are supported).
  // Formula: EF' = EF + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02))
  let newEF = currentEF + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02))

  // Minimum ease factor is 1.3
  if (newEF < 1.3) newEF = 1.3

  return newEF
}

// Check if verse was reviewed today
export function wasReviewedToday(verse, now = new Date()) {
  if (!verse.lastReviewed) return false
  const lastReviewed = new Date(verse.lastReviewed)
  return lastReviewed.toDateString() === now.toDateString()
}

// Return the complete schedule so all review paths persist the same metadata.
// The third argument is retained for caller compatibility; it cannot bypass same-day protection.
export function calculateNextReviewDate(verse, grade, _isNewReview = false, options = {}) {
  const now = options.now || new Date()
  const maximum = normalizeMaxReviewInterval(options.maxReviewIntervalDays)
  const schedule = getReviewSchedule(verse, now)
  const earned = schedule.earnedInterval
  let currentEF = verse.easeFactor || DEFAULT_EASE_FACTOR

  if (wasReviewedToday(verse, now)) {
    // Completing an explicit same-day Review now consumes the due request,
    // without grading the same day's practice a second time.
    if (schedule.forceDue && verse.reviewSchedule?.forceDue) {
      const interval = Math.min(earned, maximum)
      return {
        nextReviewDate: addReviewDays(now, interval),
        easeFactor: currentEF,
        interval,
        reviewSchedule: { ...schedule, anchorDate: new Date(now).toISOString(), appliedMaximumDays: maximum, forceDue: false },
      }
    }
    return {
      nextReviewDate: verse.nextReviewDate,
      easeFactor: currentEF,
      interval: verse.interval || 0,
      reviewSchedule: schedule,
    }
  }

  // Transition only on a counted review. A capped or recently failed established
  // verse is not a ladder verse; use earned spacing as well as review count.
  if (verse.srsVersion !== SRS_VERSION &&
      Number.isInteger(verse.reviewCount) && verse.reviewCount >= 0 && verse.reviewCount <= 4 &&
      earned <= 4 && verse.reviewScheduleCustomized !== true) {
    currentEF = Math.min(currentEF, DEFAULT_EASE_FACTOR)
  }

  const measuredGap = verse.lastReviewed ? getLocalCalendarDayDifference(now, verse.lastReviewed) : null
  const gap = Math.max(1, measuredGap || 1)
  const appliedInterval = Math.min(earned, maximum)
  const elapsedFraction = Math.min(1, gap / Math.max(1, Math.floor(appliedInterval)))
  const easeChange = updateEaseFactor(currentEF, grade) - currentEF
  const newEF = Math.max(1.3, currentEF + easeChange * (easeChange > 0 ? elapsedFraction : 1))

  let proposed
  if (grade < 4) {
    // Difficulty gets the full reduction, without an extra early-review penalty.
    proposed = Math.max(1, Math.max(1, appliedInterval) * grade / 6)
  } else if (earned === 0) {
    proposed = 1
  } else {
    // Once a whole-day gap is met, retain fractional progress so rounding cannot
    // trap a verse. Early success preserves spacing already earned.
    const growthGap = gap >= Math.max(1, Math.floor(earned)) ? Math.max(gap, earned) : gap
    proposed = Math.max(earned, Math.min(earned * newEF, growthGap * newEF))
  }

  // No setting can schedule beyond one year. Keeping earned spacing separately
  // makes a temporarily lower maximum reversible without unbounded hidden growth.
  const earnedInterval = Math.max(1, Math.min(365, proposed))
  const interval = Math.min(earnedInterval, maximum)
  return {
    nextReviewDate: addReviewDays(now, interval),
    easeFactor: newEF,
    srsVersion: SRS_VERSION,
    interval,
    reviewSchedule: {
      earnedInterval,
      anchorDate: new Date(now).toISOString(),
      appliedMaximumDays: maximum,
      forceDue: false,
    },
  }
}

// Every completion path uses the same first-review-of-the-day rule.
export function applyReviewSchedule(verse, grade, options = {}) {
  const now = options.now || new Date()
  const firstReviewToday = !wasReviewedToday(verse, now)
  const result = calculateNextReviewDate(verse, grade, false, { ...options, now })
  if (firstReviewToday) verse.reviewCount = (verse.reviewCount || 0) + 1
  Object.assign(verse, result)
}
