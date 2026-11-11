<template>
  <section class="almanac px-1 pt-2 pb-6">
    <div class="almanac__stats grid grid-cols-3 gap-3 sm:gap-6 stagger-fade">
      <div class="almanac__stat">
        <div class="almanac__numeral">{{ currentStreak }}</div>
        <div class="almanac__label">day streak</div>
      </div>
      <div class="almanac__stat">
        <div class="almanac__numeral">{{ dueVersesCount }}</div>
        <div class="almanac__label">due</div>
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
          class="btn-secondary btn--trailing-icon"
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
          class="pointer-events-auto relative z-10 mt-2 w-72 max-w-[calc(100vw-2rem)]"
        >
          <OnboardingCallout
            data-testid="review-onboarding-callout"
            :title="startReviewCalloutTitle"
            :body="startReviewCalloutBody"
            icon="none"
            pointer="top-center"
            dismiss-label="Dismiss review callout"
            @dismiss="$emit('dismiss-start-review-callout')"
          />
        </div>
      </div>
    </div>
    <h2 v-if="sectionTitle" class="almanac__section-heading fade-in">{{ sectionTitle }}</h2>
  </section>
</template>

<script setup>
import OnboardingCallout from './OnboardingCallout.vue'

defineProps({
  currentStreak: { type: Number, required: true },
  dueVersesCount: { type: Number, required: true },
  masteredCount: { type: Number, required: true },
  showStartReview: { type: Boolean, required: true },
  showStartReviewCallout: { type: Boolean, default: false },
  startReviewCalloutTitle: { type: String, default: '' },
  startReviewCalloutBody: { type: String, default: '' },
  sectionTitle: { type: String, default: '' },
})

defineEmits(['start-review', 'dismiss-start-review-callout'])
</script>
