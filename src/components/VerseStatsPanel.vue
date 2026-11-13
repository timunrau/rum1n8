<script setup>
import { computed } from 'vue'
import { Line } from 'vue-chartjs'
import { buildVerseStats, statsTimestamp } from '../utils/verse-stats.js'

const props = defineProps({
  verse: { type: Object, required: true },
  settings: { type: Object, required: true },
  now: { type: Date, required: true },
  colors: { type: Object, required: true },
  showIdentity: { type: Boolean, default: true },
})

const stats = computed(() => buildVerseStats(props.verse, props.settings, props.now))
const numeric = value => value === null || value === undefined ? 'Unavailable' : new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value)
const percent = value => value === null ? 'Unavailable' : `${numeric(value)}%`
const date = (value, withTime = false) => {
  const timestamp = statsTimestamp(value)
  return timestamp === null ? 'Unavailable' : new Date(timestamp).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  })
}
const nextReviewLabel = computed(() => {
  if (!stats.value.mastered) return 'Not scheduled'
  if (!props.verse.nextReviewDate) return 'Due now'
  const days = stats.value.daysUntil
  if (days === null) return 'Unavailable'
  if (days < 0) return `${Math.abs(days)} ${Math.abs(days) === 1 ? 'day' : 'days'} overdue`
  if (days === 0) return 'Due today'
  if (days === 1) return 'Due tomorrow'
  return `Due in ${days} days`
})
const status = computed(() => ({ unmemorized: 'Not yet learned', learned: 'Learned', memorized: 'Memorized', mastered: 'Mastered' })[props.verse.memorizationStatus] || 'Unavailable')
const chartData = computed(() => ({
  datasets: [{
    label: 'Accuracy',
    data: stats.value.chartHistory.map(entry => ({ x: entry.timestamp, y: entry.accuracy, entry })),
    borderColor: props.colors.accent,
    backgroundColor: props.colors.accent,
    pointRadius: 4,
    pointHoverRadius: 6,
    pointHitRadius: 16,
    borderWidth: 2,
    clip: 8,
    tension: 0,
  }],
}))
const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  interaction: { intersect: false, mode: 'nearest' },
  plugins: {
    legend: { display: false },
    tooltip: { callbacks: {
      title: items => date(items[0]?.parsed.x, true),
      label: item => `Accuracy: ${percent(item.parsed.y)}`,
      afterLabel: item => {
        return `Mistakes: ${numeric(item.raw.entry.mistakes)}`
      },
    } },
  },
  scales: {
    x: {
      type: 'linear',
      min: stats.value.chartStart,
      max: stats.value.chartEnd,
      ticks: { color: props.colors.muted, maxTicksLimit: 4, maxRotation: 0, callback: value => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) },
      grid: { display: false },
      border: { color: props.colors.grid },
    },
    y: {
      min: 0, max: 100,
      ticks: { color: props.colors.muted, stepSize: 50, callback: value => `${value}%` },
      grid: { color: props.colors.grid },
      border: { display: false },
    },
  },
}))
</script>

<template>
  <section class="verse-stats" :class="{ 'verse-stats--without-identity': !showIdentity }" data-testid="verse-stats-panel" aria-label="Stats for nerds">
    <div v-if="showIdentity" class="verse-stats__identity">
      <h3>{{ verse.reference }}</h3>
      <span v-if="verse.bibleVersion" class="verse-stats__version">{{ verse.bibleVersion }}</span>
    </div>

    <div class="verse-stats__section">
      <p class="verse-stats__headline">{{ nextReviewLabel }}</p>
      <template v-if="stats.mastered && stats.elapsedPercent !== null && !stats.schedule.forceDue">
        <div class="verse-stats__ribbon" role="img" :aria-label="`${numeric(stats.elapsedPercent)}% of the time from last review to next due date elapsed`">
          <span class="verse-stats__elapsed" :style="{ width: `${stats.elapsedPercent}%` }" />
          <span class="verse-stats__today" :style="{ left: `${stats.elapsedPercent}%` }" />
        </div>
        <div class="verse-stats__ribbon-labels">
          <span>Last review {{ date(stats.lastReview) }}</span>
          <span>Due {{ date(stats.nextReview) }}</span>
        </div>
      </template>
      <p v-if="!stats.mastered" class="verse-stats__muted">Master this verse to start spaced repetition.</p>
    </div>

    <dl class="verse-stats__metrics">
      <div><dd>{{ stats.ease === null ? '—' : `${numeric(stats.ease)}×` }}</dd><dt>Ease factor</dt></div>
      <div><dd>{{ stats.attempts }}</dd><dt>Times reviewed</dt></div>
      <div><dd>{{ stats.averageAccuracy === null ? '—' : percent(Math.round(stats.averageAccuracy)) }}</dd><dt>Average accuracy</dt></div>
    </dl>

    <div class="verse-stats__section">
      <h4>Accuracy</h4>
      <div v-if="stats.chartHistory.length" class="verse-stats__chart">
        <Line :data="chartData" :options="chartOptions" role="img" :aria-label="`Accuracy across ${stats.chartHistory.length} recorded reviews. Select a point for date, accuracy, and mistakes.`" />
      </div>
      <p v-else class="verse-stats__empty">No recorded accuracy yet.</p>
      <dl class="verse-stats__facts">
        <div><dt>Status</dt><dd>{{ status }}</dd></div>
        <div><dt>Added</dt><dd>{{ date(verse.createdAt) }}</dd></div>
        <div><dt>Mastered</dt><dd>{{ date(verse.masteredAt) }}</dd></div>
        <div><dt>Last reviewed</dt><dd>{{ date(verse.lastReviewed, true) }}</dd></div>
        <div><dt>Last accuracy</dt><dd>{{ percent(stats.lastAccuracy) }}</dd></div>
        <template v-if="stats.mastered">
          <div><dt>Earned spacing</dt><dd>{{ numeric(stats.schedule.earnedInterval) }} {{ stats.schedule.earnedInterval === 1 ? 'day' : 'days' }}</dd></div>
          <div><dt>Scheduled interval</dt><dd>{{ numeric(stats.intervalDays) }} {{ stats.intervalDays === 1 ? 'day' : 'days' }}</dd></div>
          <div><dt>Maximum interval</dt><dd>{{ stats.maximumDays }} days</dd></div>
          <div v-if="verse.reviewScheduleCustomized"><dt>Manual schedule used</dt><dd>Yes</dd></div>
          <div v-if="verse.reviewScheduleModifiedAt"><dt>Schedule last changed</dt><dd>{{ date(verse.reviewScheduleModifiedAt, true) }}</dd></div>
        </template>
      </dl>
    </div>

  </section>
</template>

<style scoped>
.verse-stats { color: var(--color-text-primary); padding: 0.5rem 0 1rem; }
.verse-stats__identity { display: flex; align-items: baseline; flex-wrap: wrap; gap: 0.6rem; }
.verse-stats h3 { font: 400 1.65rem var(--font-serif); }
.verse-stats h4 { font-size: 0.95rem; font-weight: 600; margin-bottom: 0.35rem; }
.verse-stats__version { font: 0.75rem var(--font-mono); color: var(--color-text-muted); }
.verse-stats__section { margin-top: 1.5rem; }
.verse-stats--without-identity > .verse-stats__section:first-child { margin-top: 0; }
.verse-stats__muted, .verse-stats__ribbon-labels { color: var(--color-text-muted); font-size: 0.8rem; }
.verse-stats__headline { font: 400 clamp(1.6rem, 6vw, 2.3rem) var(--font-serif); margin: 0.3rem 0; }
.verse-stats__ribbon { position: relative; height: 6px; background: var(--color-bg-sunken); border-radius: 3px; margin: 1.1rem 6px 0.75rem; }
.verse-stats__elapsed { display: block; height: 100%; border-radius: inherit; background: var(--color-accent); }
.verse-stats__today { position: absolute; top: -3px; width: 12px; height: 12px; transform: translateX(-50%); border-radius: 50%; background: var(--color-accent); }
.verse-stats__ribbon-labels { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem; font-size: 0.7rem; }
.verse-stats__metrics { text-align: center; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.65rem; border-block: 1px solid var(--color-border-default); padding-block: 1.1rem; margin-top: 1.5rem; }
.verse-stats__metrics dd { font: 400 clamp(1.35rem, 5vw, 1.9rem) var(--font-serif); font-variant-numeric: tabular-nums; }
.verse-stats__metrics dt { color: var(--color-text-muted); font-size: 0.75rem; margin-top: 0.25rem; }
.verse-stats__chart { height: 190px; margin-top: 0.8rem; }
.verse-stats__facts { display: grid; gap: 0.6rem; font-size: 0.85rem; margin-top: 0.8rem; }
.verse-stats__facts > div { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 0.25rem 1rem; }
.verse-stats__facts dt { color: var(--color-text-muted); }
.verse-stats__facts dd { text-align: right; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.verse-stats__empty { color: var(--color-text-muted); font-size: 0.8rem; line-height: 1.6; margin-top: 0.8rem; }
</style>
