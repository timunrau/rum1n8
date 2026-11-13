import { getReviewSchedule, normalizeMaxReviewInterval } from '../review-schedule.js'
import { getLocalCalendarDayDifference } from './local-date.js'

function number(value) {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function statsTimestamp(value) {
  if (!value) return null
  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp) ? timestamp : null
}

// Derive display data without changing the saved verse or reconstructing missing history.
export function buildVerseStats(verse, settings = {}, now = new Date()) {
  const history = (Array.isArray(verse.reviewHistory) ? verse.reviewHistory : [])
    .filter(entry => entry && typeof entry === 'object' && !Array.isArray(entry))
    .map((entry, index) => {
      const accuracy = number(entry.accuracy)
      const mistakes = number(entry.mistakes)
      return {
        index,
        timestamp: statsTimestamp(entry.date),
        accuracy: accuracy !== null && accuracy >= 0 && accuracy <= 100 ? accuracy : null,
        mistakes: mistakes !== null && mistakes >= 0 ? mistakes : null,
      }
    })
    .sort((a, b) => (b.timestamp ?? -Infinity) - (a.timestamp ?? -Infinity) || b.index - a.index)
  const accuracyHistory = history.filter(entry => entry.accuracy !== null)
  const mastered = verse.memorizationStatus === 'mastered'
  const schedule = mastered ? getReviewSchedule(verse, now) : null
  const nextReview = statsTimestamp(verse.nextReviewDate)
  const daysUntil = nextReview === null ? null : getLocalCalendarDayDifference(nextReview, now)
  const lastReview = statsTimestamp(verse.lastReviewed)
  const intervalDays = mastered && number(verse.interval) !== null ? Math.max(0, Math.floor(number(verse.interval))) : null
  const span = nextReview !== null && lastReview !== null ? getLocalCalendarDayDifference(nextReview, lastReview) : 0
  const elapsed = lastReview !== null ? getLocalCalendarDayDifference(now, lastReview) : 0

  const chartHistory = history.filter(entry => entry.timestamp !== null && entry.accuracy !== null).reverse()
  const masteredAt = statsTimestamp(verse.masteredAt)
  const chartStart = masteredAt ?? chartHistory[0]?.timestamp
  const chartEnd = Math.max(chartStart ?? 0, chartHistory.at(-1)?.timestamp ?? 0)

  return {
    chartHistory,
    chartStart,
    chartEnd: chartEnd === chartStart ? chartEnd + 86_400_000 : chartEnd,
    averageAccuracy: accuracyHistory.length ? accuracyHistory.reduce((sum, entry) => sum + entry.accuracy, 0) / accuracyHistory.length : null,
    attempts: history.length,
    ease: number(verse.easeFactor),
    lastAccuracy: number(verse.lastAccuracy) !== null && number(verse.lastAccuracy) >= 0 && number(verse.lastAccuracy) <= 100 ? number(verse.lastAccuracy) : null,
    mastered,
    schedule,
    intervalDays,
    maximumDays: normalizeMaxReviewInterval(settings.maxReviewIntervalDays),
    daysUntil,
    nextReview,
    lastReview,
    elapsedPercent: span > 0 ? Math.max(0, Math.min(100, elapsed / span * 100)) : null,
  }
}
