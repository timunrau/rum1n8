import { getLocalCalendarDayDifference, isVerseDueForReview } from './utils/local-date.js'

export const REVIEW_FREQUENCY_OPTIONS = [
  { days: 1, label: '+1d' },
  { days: 3, label: '+3d' },
  { days: 7, label: '+1w' },
  { days: 14, label: '+2w' },
  { days: 30, label: '+1mo' },
  { days: 60, label: '+2mo' },
  { days: 90, label: '+3mo' },
]

export function normalizeMaxReviewInterval(value) {
  return Number.isInteger(value) && value >= 1 && value <= 365 ? value : 90
}

export function getReviewFrequencyOptions(maximum = 90) {
  const limit = normalizeMaxReviewInterval(maximum)
  const options = REVIEW_FREQUENCY_OPTIONS.filter(option => option.days <= limit)
  if (!options.some(option => option.days === limit)) options.push({ days: limit, label: `+${limit}d` })
  return options
}

function validDate(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date : null
}

export function addReviewDays(anchor, interval) {
  const date = new Date(anchor)
  // Match the existing scheduler's whole calendar-day date arithmetic.
  date.setDate(date.getDate() + Math.floor(interval))
  return date.toISOString()
}

export function getReviewSchedule(verse, now = new Date()) {
  const stored = verse.reviewSchedule
  if (stored && Number.isFinite(stored.earnedInterval) && stored.earnedInterval >= 0 &&
      validDate(stored.anchorDate) && Number.isInteger(stored.appliedMaximumDays) &&
      stored.appliedMaximumDays >= 1 && stored.appliedMaximumDays <= 365) {
    // Older clients can retain metadata while changing the ordinary schedule fields.
    // Recover from those writes rather than restoring an obsolete schedule.
    const expected = stored.forceDue
      ? stored.anchorDate
      : addReviewDays(stored.anchorDate, Math.max(0, verse.interval || 0))
    if ((!verse.nextReviewDate && stored.forceDue) || expected === verse.nextReviewDate) return { ...stored }
  }

  const interval = Number.isFinite(verse.interval) && verse.interval > 0 ? verse.interval : 0
  const nextDate = validDate(verse.nextReviewDate)
  let anchor = validDate(verse.lastReviewed) || validDate(verse.masteredAt) || validDate(verse.createdAt) || new Date(now)
  if (nextDate) {
    anchor = new Date(nextDate)
    anchor.setDate(anchor.getDate() - Math.floor(interval))
  }
  return {
    earnedInterval: interval,
    anchorDate: anchor.toISOString(),
    appliedMaximumDays: 90,
    forceDue: !nextDate || interval === 0,
  }
}

// Metadata initialization preserves legacy dates. Projection occurs when the cap changes,
// or explicitly for imports. Derived changes do not fabricate review/edit timestamps.
export function reconcileReviewSchedule(verse, maximum = 90, now = new Date(), force = false) {
  if (verse.memorizationStatus !== 'mastered') return false
  const before = JSON.stringify([verse.interval, verse.nextReviewDate, verse.reviewSchedule])
  const limit = normalizeMaxReviewInterval(maximum)
  const schedule = getReviewSchedule(verse, now)
  if (force || schedule.appliedMaximumDays !== limit) {
    verse.interval = Math.min(schedule.earnedInterval, limit)
    verse.nextReviewDate = schedule.forceDue ? schedule.anchorDate : addReviewDays(schedule.anchorDate, verse.interval)
    schedule.appliedMaximumDays = limit
  }
  verse.reviewSchedule = schedule
  return before !== JSON.stringify([verse.interval, verse.nextReviewDate, verse.reviewSchedule])
}

export function reconcileReviewSchedules(verses, maximum = 90, now = new Date(), force = false) {
  let changed = false
  for (const verse of verses) changed = reconcileReviewSchedule(verse, maximum, now, force) || changed
  return changed
}

export function previewReviewMaximum(verses, maximum, now = new Date()) {
  const counts = { earlier: 0, later: 0, becomingDue: 0, noLongerDue: 0 }
  for (const verse of verses) {
    if (verse.memorizationStatus !== 'mastered') continue
    const projected = { ...verse }
    reconcileReviewSchedule(projected, maximum, now, true)
    const difference = validDate(verse.nextReviewDate)
      ? getLocalCalendarDayDifference(projected.nextReviewDate, verse.nextReviewDate)
      : 0
    if (difference < 0) counts.earlier++
    if (difference > 0) counts.later++
    const wasDue = isVerseDueForReview(verse, now)
    const willBeDue = isVerseDueForReview(projected, now)
    if (!wasDue && willBeDue) counts.becomingDue++
    if (wasDue && !willBeDue) counts.noLongerDue++
  }
  return counts
}

export function sortReviewVerses(verses, mode = 'classic', now = new Date()) {
  const timestamp = value => validDate(value)?.getTime() || 0
  return verses.filter(verse => verse.memorizationStatus === 'mastered').sort((a, b) => {
    if (mode === 'rotation') {
      const aDue = isVerseDueForReview(a, now)
      const bDue = isVerseDueForReview(b, now)
      if (aDue !== bDue) return aDue ? -1 : 1
      if (!aDue) {
        const reviewed = timestamp(a.lastReviewed) - timestamp(b.lastReviewed)
        if (reviewed) return reviewed
      }
    }
    const scheduled = timestamp(a.nextReviewDate) - timestamp(b.nextReviewDate)
    return scheduled || (mode === 'rotation' ? String(a.id).localeCompare(String(b.id)) : 0)
  })
}

export function applyReviewFrequencyOverride(verse, daysFromNow, now = new Date(), maximum = 90) {
  const limit = normalizeMaxReviewInterval(maximum)
  if (!Number.isInteger(daysFromNow) || daysFromNow < 0 || daysFromNow > limit) {
    throw new RangeError(`Review frequency must be a whole number from 0 to ${limit} days`)
  }
  const changedAt = new Date(now).toISOString()
  const schedule = getReviewSchedule(verse, now)
  verse.nextReviewDate = addReviewDays(changedAt, daysFromNow)
  if (daysFromNow > 0) {
    verse.interval = daysFromNow
    verse.reviewScheduleCustomized = true
    schedule.earnedInterval = daysFromNow
  } else {
    verse.interval = Math.min(schedule.earnedInterval, limit)
  }
  verse.reviewSchedule = { ...schedule, anchorDate: changedAt, appliedMaximumDays: limit, forceDue: daysFromNow === 0 }
  verse.lastModified = changedAt
  return verse
}
