<template>
  <div class="completion-tray">
    <div class="completion-tray__rule" aria-hidden="true"></div>
    <div v-if="meetsAccuracyRequirement">
      <p class="completion-tray__title">Great job!</p>
      <p class="completion-tray__body" :class="context === 'review' && nextReviewLabel ? 'mb-1' : 'mb-4'">
        <template v-if="context === 'memorization'">
          <span v-if="memorizationMode === 'learn'">You've learned this verse. Ready to memorize it?</span>
          <span v-else-if="memorizationMode === 'memorize'">You've memorized this verse. Ready to master it?</span>
          <span v-else-if="memorizationMode === 'master'">You've mastered this verse. It's now in your spaced repetition system.</span>
        </template>
        <template v-else>
          <template v-if="memorizationMode === 'master'">You've reviewed this verse with {{ accuracy.toFixed(1) }}% accuracy.</template>
          <template v-else>Practice complete (doesn't count as review).</template>
        </template>
      </p>
      <p v-if="context === 'review' && nextReviewLabel" class="completion-tray__meta">
        Next review {{ nextReviewLabel === 'Due' || nextReviewLabel === 'Now' ? 'soon' : 'in ' + nextReviewLabel }}
      </p>
      <div class="flex justify-center gap-3">
        <template v-if="context === 'memorization'">
          <button
            @click="$emit('retry')"
            class="btn-secondary"
          >
            Retry
          </button>
          <button
            v-if="memorizationMode !== 'master'"
            @click="$emit('advance')"
            class="btn-primary"
          >
            Continue to {{ memorizationMode === 'learn' ? 'Memorize' : 'Master' }}
          </button>
          <button
            v-else
            @click="$emit('exit')"
            class="btn-primary"
          >
            Done
          </button>
        </template>
        <template v-else>
          <button
            @click="$emit('retry')"
            class="btn-secondary"
          >
            Retry
          </button>
          <button
            @click="$emit('next-verse')"
            class="btn-primary"
          >
            Next Verse
          </button>
        </template>
      </div>
    </div>
    <div v-else>
      <p class="completion-tray__title completion-tray__title--warn">Keep practicing!</p>
      <p class="completion-tray__body" :class="context === 'review' && nextReviewLabel ? 'mb-1' : 'mb-4'">
        Your accuracy is {{ accuracy.toFixed(1) }}%.
        <span v-if="context === 'memorization'">You need 90% accuracy to advance.</span>
        <span v-else>You need 90% accuracy to advance.</span>
      </p>
      <p v-if="context === 'review' && nextReviewLabel" class="completion-tray__meta">
        Next review {{ nextReviewLabel === 'Due' || nextReviewLabel === 'Now' ? 'soon' : 'in ' + nextReviewLabel }}
      </p>
      <div class="flex justify-center">
        <button
          @click="$emit('retry')"
          class="btn-primary"
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
    nextReviewLabel: { type: String, default: null }
  },
  emits: ['advance', 'exit', 'retry', 'next-verse']
}
</script>
