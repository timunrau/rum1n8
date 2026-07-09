export const REVIEW_FREQUENCY_OPTIONS = [
  { days: 1, label: '+1d' },
  { days: 3, label: '+3d' },
  { days: 7, label: '+1w' },
  { days: 14, label: '+2w' },
  { days: 30, label: '+1mo' },
  { days: 60, label: '+2mo' },
  { days: 90, label: '+3mo' },
]

export function applyReviewFrequencyOverride(verse, daysFromNow, now = new Date()) {
  if (!Number.isInteger(daysFromNow) || daysFromNow < 0 || daysFromNow > 90) {
    throw new RangeError('Review frequency must be a whole number from 0 to 90 days')
  }

  const changedAt = new Date(now)
  const target = new Date(changedAt)
  target.setDate(target.getDate() + daysFromNow)

  verse.nextReviewDate = target.toISOString()
  if (daysFromNow > 0) {
    verse.interval = daysFromNow
    verse.reviewScheduleCustomized = true
  }
  verse.lastModified = changedAt.toISOString()

  return verse
}
