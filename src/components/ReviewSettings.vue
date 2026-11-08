<script setup>
import { computed, ref, watch } from 'vue'
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
  { id: 'classic', label: 'Classic', description: 'Review by next due date. Successful early reviews earn longer intervals.' },
  { id: 'rotation', label: 'Rotation', description: 'Due verses first, then those practiced least recently. Longer gaps between successful reviews earn longer intervals.' },
]
</script>

<template>
  <section class="rounded-xl bg-sunken p-4" aria-labelledby="review-settings-heading">
    <h3 id="review-settings-heading" class="text-base font-semibold text-text-primary">Practice &amp; review</h3>
    <p class="mt-3 text-sm font-medium text-text-primary" id="review-mode-label">Review mode</p>
    <div class="mt-2 space-y-1" role="radiogroup" aria-labelledby="review-mode-label">
      <button
        v-for="mode in modes" :key="mode.id" type="button" role="radio"
        :aria-checked="settings.reviewMode === mode.id" :data-testid="`review-mode-${mode.id}`"
        class="flex w-full items-center justify-between gap-4 rounded-xl px-3 py-3 text-left text-text-primary transition-colors hover:bg-surface-hover active:bg-surface-active"
        @click="emit('mode', mode.id)"
      >
        <span class="min-w-0">
          <span class="block text-sm font-medium">{{ mode.label }}</span>
          <span class="mt-1 block text-xs text-text-muted">{{ mode.description }}</span>
        </span>
        <svg v-if="settings.reviewMode === mode.id" class="h-4 w-4 shrink-0 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M5 13l4 4L19 7" />
        </svg>
      </button>
    </div>
    <form class="mt-4 border-t border-border-default pt-4" @submit.prevent="valid && changed && emit('maximum', maximum)">
      <label for="max-review-interval" class="block text-sm font-medium text-text-primary">Maximum days between reviews</label>
      <p id="max-review-help" class="mt-1 text-xs text-text-muted">Choose 1–365 days. Lowering this brings reviews forward. Raising it restores previously earned spacing unless review performance has changed it.</p>
      <div class="mt-3 flex items-center gap-3">
        <input id="max-review-interval" v-model="draftMaximum" type="number" min="1" max="365" step="1" required
          aria-describedby="max-review-help" :aria-invalid="!valid"
          class="min-w-0 w-28 rounded-lg border border-border-input bg-overlay px-3 py-3 text-text-primary outline-none focus:border-accent"
          data-testid="max-review-interval" />
        <button type="submit" class="btn-primary" :disabled="!valid || !changed" data-testid="apply-max-review-interval">Apply</button>
      </div>
      <p v-if="!valid" class="mt-2 text-sm text-status-error-text">Enter a whole number from 1 to 365.</p>
      <div v-else-if="changed && preview" class="mt-3 text-xs text-text-secondary space-y-1" role="status" aria-live="polite" data-testid="review-maximum-preview">
        <p>{{ preview.earlier }} review dates earlier · {{ preview.later }} later</p>
        <p>{{ preview.becomingDue }} become due · {{ preview.noLongerDue }} no longer due</p>
      </div>
    </form>
    <div v-if="$slots.default" class="mt-4 space-y-4 border-t border-border-default pt-4">
      <slot />
    </div>
  </section>
</template>
