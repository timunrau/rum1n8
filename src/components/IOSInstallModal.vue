<template>
  <div
    class="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-4"
    @click.self="$emit('close')"
  >
    <div class="bg-elevated rounded-t-xl sm:rounded-xl shadow-soft border border-border-default max-w-md w-full p-6 pb-8 sm:pb-6">
      <h2 class="text-xl font-bold text-text-primary mb-3">
        {{ isSafari ? 'Add to Home Screen' : 'Open in Safari to install' }}
      </h2>
      <p v-if="!isSafari" class="text-sm text-text-secondary mb-5">
        Installation works best from Safari on iOS. Open this page in Safari, then add rum1n8 to your Home Screen.
      </p>

      <ol class="space-y-5 mb-6">
        <li v-if="!isSafari" class="flex gap-4 items-start">
          <span class="flex-shrink-0 w-10 h-10 bg-overlay rounded-xl flex items-center justify-center text-text-secondary">
            <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 3h7v7" />
              <path d="M10 14L21 3" />
              <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
            </svg>
          </span>
          <div class="flex-1 min-w-0">
            <p class="font-medium text-text-primary">Open this page in Safari</p>
            <p class="text-sm text-text-muted">Use your browser's share menu or copy the address into Safari</p>
          </div>
        </li>
        <li class="flex gap-4 items-start">
          <span class="flex-shrink-0 w-10 h-10 bg-overlay rounded-xl flex items-center justify-center text-text-secondary">
            <!-- iOS Safari Share button icon -->
            <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
          </span>
          <div class="flex-1 min-w-0">
            <p class="font-medium text-text-primary">Tap the Share button</p>
            <p class="text-sm text-text-muted">The share icon at the bottom of Safari</p>
          </div>
        </li>
        <li class="flex gap-4 items-start">
          <span class="flex-shrink-0 w-10 h-10 bg-overlay rounded-xl flex items-center justify-center text-text-secondary">
            <!-- Add to Home Screen icon (app icon with plus) -->
            <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="4" />
              <line x1="12" y1="8" x2="12" y2="16" />
              <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
          </span>
          <div class="flex-1 min-w-0">
            <p class="font-medium text-text-primary">Tap "Add to Home Screen"</p>
            <p class="text-sm text-text-muted">Scroll down in the menu to find it</p>
          </div>
        </li>
        <li class="flex gap-4 items-start">
          <span class="flex-shrink-0 w-10 h-10 bg-status-info-bg rounded-xl flex items-center justify-center">
            <!-- Add button (checkmark / confirm) -->
            <span class="text-status-info-text font-semibold text-sm">Add</span>
          </span>
          <div class="flex-1 min-w-0">
            <p class="font-medium text-text-primary">Tap "Add"</p>
            <p class="text-sm text-text-muted">In the top right corner</p>
          </div>
        </li>
      </ol>

      <button
        @click="$emit('close')"
        class="btn-primary w-full"
      >
        Got it
      </button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'IOSInstallModal',
  props: {
    isSafari: {
      type: Boolean,
      default: true,
    },
  },
  emits: ['close']
}
</script>
