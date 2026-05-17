<template>
  <div
    class="completion-tray"
    :class="meetsAccuracyRequirement ? 'completion-tray--success' : 'completion-tray--retry'"
  >
    <div class="completion-tray__copy">
      <p class="completion-tray__title">{{ completionTitle }}</p>
      <p class="completion-tray__meta">{{ completionMeta }}</p>
    </div>
    <div v-if="meetsAccuracyRequirement">
      <div class="completion-tray__actions">
        <template v-if="context === 'memorization'">
          <button
            @click="$emit('retry')"
            class="btn-secondary btn--sm"
          >
            Retry
          </button>
          <button
            v-if="memorizationMode !== 'master'"
            @click="$emit('advance')"
            class="btn-primary btn--sm"
          >
            Continue to {{ memorizationMode === 'learn' ? 'Memorize' : 'Master' }}
          </button>
          <button
            v-else
            @click="$emit('exit')"
            class="btn-primary btn--sm"
          >
            Done
          </button>
        </template>
        <template v-else>
          <button
            @click="$emit('retry')"
            class="btn-secondary btn--sm"
          >
            Retry
          </button>
          <button
            v-if="isLastInList"
            @click="$emit('done')"
            class="btn-primary btn--sm"
          >
            Done
          </button>
          <button
            v-else
            @click="$emit('next-verse')"
            class="btn-primary btn--sm"
          >
            Next Verse
          </button>
        </template>
      </div>
    </div>
    <div v-else>
      <div class="completion-tray__actions">
        <button
          @click="$emit('retry')"
          class="btn-primary btn--sm"
        >
          Try Again
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'CompletionTray',
  props: {
    context: { type: String, validator: (v) => ['memorization', 'review'].includes(v) },
    meetsAccuracyRequirement: { type: Boolean, required: true },
    accuracy: { type: Number, required: true },
    reviewMistakes: { type: Number, required: true },
    reviewWordsLength: { type: Number, required: true },
    memorizationMode: { type: String, default: null },
    nextReviewLabel: { type: String, default: null },
    isLastInList: { type: Boolean, default: false }
  },
  emits: ['advance', 'exit', 'retry', 'next-verse', 'done'],
  computed: {
    accuracyLabel() {
      return `${this.accuracy.toFixed(1)}%`
    },
    completionTitle() {
      if (!this.meetsAccuracyRequirement) return 'Keep going'
      if (this.context === 'review') {
        return this.memorizationMode === 'master' ? 'Reviewed' : 'Practice complete'
      }
      if (this.memorizationMode === 'learn') return 'Learned'
      if (this.memorizationMode === 'memorize') return 'Memorized'
      return 'Mastered'
    },
    accuracyMeta() {
      return `${this.accuracyLabel} accuracy`
    },
    completionMeta() {
      return [
        this.accuracyMeta,
        !this.meetsAccuracyRequirement ? '90% needed' : null,
        this.nextReviewMeta
      ].filter(Boolean).join(' · ')
    },
    nextReviewMeta() {
      if (!this.meetsAccuracyRequirement || this.context !== 'review' || !this.nextReviewLabel) return null
      const label = this.nextReviewLabel === 'Due' || this.nextReviewLabel === 'Now'
        ? 'soon'
        : `in ${this.nextReviewLabel}`
      return `next review ${label}`
    }
  }
}
</script>
