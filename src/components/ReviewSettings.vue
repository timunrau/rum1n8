<script setup>
import { computed, ref, watch } from 'vue'
import { buildSpacedRepetitionUrl } from '../ui-state.js'
import { previewReviewMaximum } from '../review-schedule.js'

const props = defineProps({
  settings: { type: Object, required: true },
  verses: { type: Array, required: true },
  now: { type: Date, required: true },
})
const emit = defineEmits(['mode', 'maximum'])
const draftMaximum = ref(props.settings.maxReviewIntervalDays)
watch(() => props.settings.maxReviewIntervalDays, value => { draftMaximum.value = value })
const maximum = computed(() => Number(draftMaximum.value))
const valid = computed(() => String(draftMaximum.value).trim() !== '' && Number.isInteger(maximum.value) && maximum.value >= 1 && maximum.value <= 365)
const changed = computed(() => maximum.value !== props.settings.maxReviewIntervalDays)
const preview = computed(() => valid.value ? previewReviewMaximum(props.verses, maximum.value, props.now) : null)
const modes = [
  { id: 'rotation', label: 'By last review', recommended: true, description: 'Due verses first, then those you haven’t reviewed in the longest time.' },
  { id: 'classic', label: 'By next review', description: 'Due verses first, then those with the soonest review dates. A verse can stay near the top even if you practiced it recently.' },
]
</script>

<template>
  <section class="rounded-xl bg-sunken p-4 space-y-5" aria-label="Practice & review">
    <div>
      <p id="review-mode-label" class="text-sm font-medium text-text-primary">Review order</p>
      <div class="mt-2 space-y-1" role="radiogroup" aria-labelledby="review-mode-label">
        <div v-for="mode in modes" :key="mode.id"
          class="grid grid-cols-[minmax(0,1fr)_1rem] gap-x-4 cursor-pointer rounded-lg px-3 py-3 transition-colors hover:bg-surface-hover active:bg-surface-active"
          @click="emit('mode', mode.id)">
          <button
            type="button" role="radio"
            :aria-checked="settings.reviewMode === mode.id" :data-testid="`review-mode-${mode.id}`"
            :aria-describedby="`review-mode-${mode.id}-description`"
            class="col-start-1 row-start-1 min-w-0 rounded-lg text-left text-text-primary"
          >
            <span class="min-w-0">
              <span class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium">
                <span>{{ mode.label }}</span>
                <span v-if="mode.recommended" class="text-xs text-accent">Recommended</span>
              </span>
            </span>
          </button>
          <p :id="`review-mode-${mode.id}-description`" class="col-start-1 row-start-2 mt-1 min-w-0 text-xs leading-relaxed text-text-muted">
            {{ mode.description }}<template v-if="mode.recommended"> Works better for <a :href="buildSpacedRepetitionUrl()" target="_blank" rel="noopener noreferrer"
              class="text-accent underline underline-offset-4" @click.stop
              data-testid="settings-spaced-repetition">spaced repetition<span class="sr-only"> (opens in a new tab)</span></a>.</template>
          </p>
          <span class="col-start-2 row-start-1 row-span-2 flex items-center justify-center" aria-hidden="true">
            <svg v-if="settings.reviewMode === mode.id" class="h-4 w-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M5 13l4 4L19 7" />
            </svg>
          </span>
        </div>
      </div>
    </div>
    <form @submit.prevent="valid && changed && emit('maximum', maximum)">
      <div class="flex items-center justify-between gap-4">
        <label for="max-review-interval" class="min-w-0 text-sm font-medium text-text-primary">Maximum days between reviews</label>
        <input id="max-review-interval" v-model="draftMaximum" type="number" min="1" max="365" step="1" required
          aria-describedby="max-review-help" :aria-invalid="!valid"
          class="w-20 min-w-0 shrink-0 rounded-lg border border-border-input bg-overlay px-3 py-2.5 text-center text-sm text-text-primary outline-none focus:border-accent"
          data-testid="max-review-interval" />
      </div>
      <p id="max-review-help" class="sr-only">Choose a whole number from 1 to 365 days.</p>
      <div v-if="changed" class="mt-3 flex items-start justify-between gap-3">
        <p v-if="!valid" class="text-sm text-status-error-text">Enter a whole number from 1 to 365.</p>
        <div v-else-if="preview" class="text-xs leading-relaxed text-text-secondary space-y-1" role="status" aria-live="polite" data-testid="review-maximum-preview">
          <p>{{ preview.earlier }} review dates earlier · {{ preview.later }} later</p>
          <p>{{ preview.becomingDue }} become due · {{ preview.noLongerDue }} no longer due</p>
        </div>
        <button type="submit" class="btn-primary btn--sm shrink-0" :disabled="!valid" data-testid="apply-max-review-interval">Apply</button>
      </div>
    </form>
    <slot />
  </section>
</template>

<style scoped>
#max-review-interval {
  appearance: textfield;
}

#max-review-interval::-webkit-inner-spin-button,
#max-review-interval::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
</style>
