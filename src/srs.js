import { getLocalCalendarDayDifference } from './utils/local-date.js'
import { addReviewDays, getReviewSchedule, normalizeMaxReviewInterval } from './review-schedule.js'

// Spaced Repetition System (SM-2 inspired algorithm)

// Calculate grade (0-5) based on accuracy
// Grade 5 = perfect, 4 = excellent, 3 = good, 2 = hard, 1 = again, 0 = complete failure
export function calculateGrade(totalWords, mistakes) {
  if (totalWords === 0) return 0

  const accuracy = (totalWords - mistakes) / totalWords

  if (accuracy >= 1.0) return 5 // Perfect
  if (accuracy >= 0.9) return 4 // Excellent (90-99%)
  if (accuracy >= 0.7) return 3 // Good (70-89%)
  if (accuracy >= 0.5) return 2 // Hard (50-69%)
  if (accuracy >= 0.3) return 1 // Again (30-49%)
  return 0 // Complete failure (<30%)
}

// Update ease factor based on grade (SM-2 algorithm)
export function updateEaseFactor(currentEF, grade) {
  // EF starts at 2.5, adjusts based on performance
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
export function calculateNextReviewDate(verse, grade, isNewReview = false, options = {}) {
  const now = options.now || new Date()
  const maximum = normalizeMaxReviewInterval(options.maxReviewIntervalDays)
  const rotation = options.reviewMode === 'rotation'
  const schedule = getReviewSchedule(verse, now)
  const earned = schedule.earnedInterval
  const currentEF = verse.easeFactor || 2.5

  if (!isNewReview && wasReviewedToday(verse, now) && verse.nextReviewDate) {
    // Completing an explicit same-day Review now consumes the due request,
    // without grading the same day's practice a second time.
    if (schedule.forceDue) {
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

  const measuredGap = verse.lastReviewed ? getLocalCalendarDayDifference(now, verse.lastReviewed) : null
  const gap = Math.max(1, measuredGap || 1)
  let newEF = updateEaseFactor(currentEF, grade)
  if (rotation && grade >= 4 && gap < Math.max(1, Math.floor(earned))) newEF = currentEF

  let proposed
  if (grade < 4) {
    let previous = Math.max(1, Math.min(verse.interval || 1, maximum))
    if (rotation) previous = Math.min(previous, gap)
    proposed = Math.max(1, previous * grade / 6)
    newEF = Math.max(1.3, newEF * 0.8)
  } else {
    const previous = rotation ? earned : (verse.interval || 0)
    if (previous > 4 || verse.reviewScheduleCustomized === true) {
      proposed = previous * newEF
    } else if (verse.reviewCount >= 0 && verse.reviewCount <= 4) {
      proposed = [1, 1, 2, 3, 4][verse.reviewCount]
    } else {
      proposed = (previous || 1) * newEF
    }
    if (rotation) {
      // Dates use whole days. Once that gap is met, retain fractional progress
      // so on-time successes can grow beyond the same rounded review date.
      const growthGap = gap >= Math.max(1, Math.floor(earned)) ? Math.max(gap, earned) : gap
      proposed = Math.min(proposed, growthGap * newEF)
    }
    proposed = Math.max(earned, proposed)
  }

  // No setting can schedule beyond one year. Keeping earned spacing separately
  // makes a temporarily lower maximum reversible without unbounded hidden growth.
  const earnedInterval = Math.max(1, Math.min(365, proposed))
  const interval = Math.min(earnedInterval, maximum)
  return {
    nextReviewDate: addReviewDays(now, interval),
    easeFactor: newEF,
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
