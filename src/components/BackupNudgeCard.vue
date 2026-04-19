<script setup>
defineEmits(['sync', 'close'])
</script>

<template>
  <div class="practice-hint" data-testid="backup-nudge-card" role="region" aria-label="Sync your verses">
    <div class="flex items-start gap-3">
      <div class="practice-hint__icon">
        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      </div>
      <div class="flex-1 min-w-0">
        <p class="practice-hint__title">Sync your verses.</p>
        <p class="practice-hint__body">Keep them safe and available on every device you use.</p>
        <div class="mt-3">
          <button
            type="button"
            class="btn-primary btn--sm"
            data-testid="backup-nudge-sync"
            @click="$emit('sync')"
          >
            Set up sync
          </button>
        </div>
      </div>
      <button
        type="button"
        class="practice-hint__close"
        data-testid="backup-nudge-close"
        aria-label="Close"
        @click="$emit('close')"
      >
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 6l12 12M6 18L18 6" />
        </svg>
      </button>
    </div>
  </div>
</template>
