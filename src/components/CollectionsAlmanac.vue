<template>
  <section class="almanac px-1 pt-2 pb-6">
    <div class="grid grid-cols-3 gap-3 sm:gap-6 stagger-fade">
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
        <div class="almanac__label">memorized</div>
      </div>
    </div>
    <hr class="almanac-rule mt-5 fade-in" />
    <p class="almanac__date fade-in">{{ todayFormatted }} <span class="almanac__brand">· rum1n8</span></p>
    <div v-if="showStartReview" class="mt-4 flex justify-center fade-in">
      <button
        type="button"
        class="btn-accent-soft"
        data-testid="almanac-start-review"
        @click="$emit('start-review')"
      >
        Start today's review &rarr;
      </button>
    </div>
    <hr class="almanac-rule mt-6 fade-in" />
    <h2 class="almanac__section-heading fade-in">{{ sectionTitle }}</h2>
  </section>
</template>

<script setup>
defineProps({
  currentStreak: { type: Number, required: true },
  dueVersesCount: { type: Number, required: true },
  masteredCount: { type: Number, required: true },
  todayFormatted: { type: String, required: true },
  showStartReview: { type: Boolean, required: true },
  sectionTitle: { type: String, required: true },
})

defineEmits(['start-review'])
</script>
