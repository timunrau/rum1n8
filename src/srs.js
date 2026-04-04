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
export function wasReviewedToday(verse) {
  if (!verse.lastReviewed) return false
  const lastReviewed = new Date(verse.lastReviewed)
  const now = new Date()
  return lastReviewed.toDateString() === now.toDateString()
}

// Calculate next review date using SM-2-inspired algorithm with shorter intervals
export function calculateNextReviewDate(verse, grade, isNewReview = false) {
  const now = new Date()
  let interval = 0
  let newEF = verse.easeFactor || 2.5

  // If reviewed today (and this is NOT a new review), don't advance the interval - keep the same next review date
  // When isNewReview is true, we're actively reviewing now, so always calculate a new date
  if (!isNewReview && wasReviewedToday(verse) && verse.nextReviewDate) {
    return {
      nextReviewDate: verse.nextReviewDate,
      easeFactor: newEF,
      interval: verse.interval || 0
    }
  }

  // Update ease factor based on grade
  newEF = updateEaseFactor(newEF, grade)

  // Below 90% accuracy (grade < 4): proportionally reduce the interval.
  // The worse the accuracy, the shorter the next interval. At <30% (grade 0), review tomorrow.
  if (grade < 4) {
    const previousInterval = Math.max(verse.interval || 1, 1)
    // Scale factor: grade 3 (70-89%) → 0.5, grade 2 (50-69%) → 0.25, grade 1 (30-49%) → 0.1, grade 0 (<30%) → 0
    const scaleFactor = grade / 6 // grade 3→0.5, 2→0.33, 1→0.17, 0→0
    interval = Math.max(1, previousInterval * scaleFactor) // minimum 1 day
    // Also reduce ease factor so future intervals grow more slowly
    newEF = Math.max(1.3, newEF * 0.8)
  } else {
    // Graduated phase: use ease factor to calculate interval
    // When verse already has an established interval (>4 days), use it—don't reset based on
    // reviewCount. This handles imported/synced verses where reviewCount and interval can be out of sync.
    const previousInterval = verse.interval || 0
    const hasEstablishedInterval = previousInterval > 4

    if (hasEstablishedInterval) {
      // Subsequent reviews: previous interval * ease factor (don't reset)
      interval = previousInterval * newEF
      if (interval > 90) interval = 90
    } else if (verse.reviewCount === 0) {
      interval = 1
    } else if (verse.reviewCount === 1) {
      interval = 1
    } else if (verse.reviewCount === 2) {
      interval = 2
    } else if (verse.reviewCount === 3) {
      interval = 3
    } else if (verse.reviewCount === 4) {
      interval = 4
    } else {
      interval = (previousInterval || 1) * newEF
      if (interval > 90) interval = 90
    }
  }

  const nextDate = new Date(now)
  nextDate.setDate(nextDate.getDate() + interval)
  return { nextReviewDate: nextDate.toISOString(), easeFactor: newEF, interval }
}

// Calculate next review date for reference quiz SRS
// Maps ref* fields to the standard fields expected by calculateNextReviewDate
export function calculateRefNextReviewDate(verse, grade) {
  const refVerse = {
    easeFactor: verse.refEaseFactor || 2.5,
    interval: verse.refInterval || 0,
    lastReviewed: verse.refLastReviewed,
    reviewCount: verse.refReviewCount || 0,
    nextReviewDate: verse.refNextReviewDate
  }
  return calculateNextReviewDate(refVerse, grade, true)
}

// Check if verse reference was reviewed today
export function wasRefReviewedToday(verse) {
  if (!verse.refLastReviewed) return false
  const lastReviewed = new Date(verse.refLastReviewed)
  const now = new Date()
  return lastReviewed.toDateString() === now.toDateString()
}
