<template>
  <div
    class="relative z-10 flex-shrink-0 bg-surface dark:bg-black rounded-t-3xl border-t border-border-default p-5 pb-8"
    style="box-shadow: 0 -8px 24px -4px rgba(0,0,0,0.12), 0 -2px 8px -2px rgba(0,0,0,0.08);"
  >
    <div v-if="meetsAccuracyRequirement">
      <p class="text-xl font-bold text-status-success-text mb-1 text-center">🎉 Great job!</p>
      <p class="text-status-success-text text-sm text-center" :class="context === 'review' && nextReviewLabel ? 'mb-1' : 'mb-4'">
        <template v-if="context === 'memorization'">
          <span v-if="memorizationMode === 'learn'">You've learned this verse! Ready to memorize it?</span>
          <span v-else-if="memorizationMode === 'memorize'">You've memorized this verse! Ready to master it?</span>
          <span v-else-if="memorizationMode === 'master'">You've mastered this verse! It's now in your spaced repetition system.</span>
        </template>
        <template v-else>
          <template v-if="memorizationMode === 'master'">You've reviewed this verse with {{ accuracy.toFixed(1) }}% accuracy!</template>
          <template v-else>Practice complete (doesn't count as review).</template>
        </template>
      </p>
      <p v-if="context === 'review' && nextReviewLabel" class="text-xs text-text-secondary text-center mb-4">
        Next review {{ nextReviewLabel === 'Due' || nextReviewLabel === 'Now' ? 'soon' : 'in ' + nextReviewLabel }}
      </p>
      <div class="flex justify-center gap-3">
        <template v-if="context === 'memorization'">
          <button
            @click="$emit('retry')"
            class="px-6 py-2.5 bg-neutral-600 hover:bg-neutral-500 text-white rounded-xl font-semibold transition-colors duration-200"
          >
            Retry
          </button>
          <button
            v-if="memorizationMode !== 'master'"
            @click="$emit('advance')"
            class="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors duration-200"
          >
            Continue to {{ memorizationMode === 'learn' ? 'Memorize' : 'Master' }}
          </button>
          <button
            v-else
            @click="$emit('exit')"
            class="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors duration-200"
          >
            Done
          </button>
        </template>
        <template v-else>
          <button
            @click="$emit('retry')"
            class="px-6 py-2.5 bg-neutral-600 hover:bg-neutral-500 text-white rounded-xl font-semibold transition-colors duration-200"
          >
            Retry
          </button>
          <button
            @click="$emit('next-verse')"
            class="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors duration-200"
          >
            Next Verse
          </button>
        </template>
      </div>
    </div>
    <div v-else>
      <p class="text-xl font-bold text-status-orange-text mb-1 text-center">Keep practicing!</p>
      <p class="text-status-orange-text text-sm text-center" :class="context === 'review' && nextReviewLabel ? 'mb-1' : 'mb-4'">
        Your accuracy is {{ accuracy.toFixed(1) }}%.
        <span v-if="context === 'memorization'">You need 90% accuracy to advance.</span>
        <span v-else>You need 90% accuracy to advance.</span>
      </p>
      <p v-if="context === 'review' && nextReviewLabel" class="text-xs text-text-secondary text-center mb-4">
        Next review {{ nextReviewLabel === 'Due' || nextReviewLabel === 'Now' ? 'soon' : 'in ' + nextReviewLabel }}
      </p>
      <div class="flex justify-center">
        <button
          @click="$emit('retry')"
          class="px-6 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-semibold transition-colors duration-200"
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
