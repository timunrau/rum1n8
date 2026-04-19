<template>
  <section class="almanac px-1 pt-2 pb-6">
    <div class="almanac__stats grid grid-cols-3 gap-3 sm:gap-6 stagger-fade">
      <div class="almanac__stat">
        <div class="almanac__numeral">{{ currentStreak }}</div>
        <div class="almanac__label">day streak</div>
      </div>
      <div class="almanac__stat">
        <div class="almanac__numeral">{{ dueVersesCount }}</div>
        <div class="almanac__label">due today</div>
      </div>
      <div class="almanac__stat">
        <div class="almanac__numeral">{{ masteredCount }}</div>
        <div class="almanac__label">mastered</div>
      </div>
    </div>
    <div v-if="showStartReview" class="mt-4 flex justify-center fade-in">
      <div class="relative flex flex-col items-center">
        <button
          type="button"
          class="btn-accent-soft"
          :class="showStartReviewCallout ? 'ring-2 ring-accent-warm shadow-lg' : ''"
          data-testid="almanac-start-review"
          @click="$emit('start-review')"
        >
          Start review
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
        <div
          v-if="showStartReviewCallout"
          class="pointer-events-auto relative z-10 mt-4 w-72 max-w-[calc(100vw-2rem)]"
        >
          <div class="relative rounded-2xl border border-border-default bg-elevated px-4 py-3 shadow-xl">
            <div class="absolute left-1/2 bottom-full h-4 w-4 -translate-x-1/2 translate-y-2 rotate-45 border-l border-t border-border-default bg-elevated" />
            <button
              type="button"
              class="absolute right-3 top-3 rounded-full p-1 text-text-secondary transition-colors duration-200 hover:bg-surface-hover hover:text-text-primary"
              aria-label="Dismiss review callout"
              @click="$emit('dismiss-start-review-callout')"
            >
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <p class="text-sm font-semibold text-text-primary">{{ startReviewCalloutTitle }}</p>
            <p class="mt-1 pr-8 text-sm leading-relaxed text-text-secondary">{{ startReviewCalloutBody }}</p>
          </div>
        </div>
      </div>
    </div>
    <h2 class="almanac__section-heading fade-in">{{ sectionTitle }}</h2>
  </section>
</template>

<script setup>
defineProps({
  currentStreak: { type: Number, required: true },
  dueVersesCount: { type: Number, required: true },
  masteredCount: { type: Number, required: true },
  showStartReview: { type: Boolean, required: true },
  showStartReviewCallout: { type: Boolean, default: false },
  startReviewCalloutTitle: { type: String, default: '' },
  startReviewCalloutBody: { type: String, default: '' },
  sectionTitle: { type: String, required: true },
})

defineEmits(['start-review', 'dismiss-start-review-callout'])
</script>
