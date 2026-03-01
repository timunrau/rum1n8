<template>
  <div
    class="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-4"
    @click.self="$emit('close')"
  >
    <div class="bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl shadow-xl max-w-md w-full p-6 pb-8 sm:pb-6">
      <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Add to Home Screen</h2>

      <ol class="space-y-5 mb-6">
        <li class="flex gap-4 items-start">
          <span class="flex-shrink-0 w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center text-gray-600 dark:text-gray-400">
            <!-- iOS Safari Share button icon -->
            <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
          </span>
          <div class="flex-1 min-w-0">
            <p class="font-medium text-gray-900 dark:text-gray-100">Tap the Share button</p>
            <p class="text-sm text-gray-500 dark:text-gray-400">The share icon at the bottom of Safari</p>
          </div>
        </li>
        <li class="flex gap-4 items-start">
          <span class="flex-shrink-0 w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center text-gray-600 dark:text-gray-400">
            <!-- Add to Home Screen icon (app icon with plus) -->
            <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="4" />
              <line x1="12" y1="8" x2="12" y2="16" />
              <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
          </span>
          <div class="flex-1 min-w-0">
            <p class="font-medium text-gray-900 dark:text-gray-100">Tap "Add to Home Screen"</p>
            <p class="text-sm text-gray-500 dark:text-gray-400">Scroll down in the menu to find it</p>
          </div>
        </li>
        <li class="flex gap-4 items-start">
          <span class="flex-shrink-0 w-10 h-10 bg-blue-50 dark:bg-blue-950 rounded-xl flex items-center justify-center">
            <!-- Add button (checkmark / confirm) -->
            <span class="text-blue-600 dark:text-blue-400 font-semibold text-sm">Add</span>
          </span>
          <div class="flex-1 min-w-0">
            <p class="font-medium text-gray-900 dark:text-gray-100">Tap "Add"</p>
            <p class="text-sm text-gray-500 dark:text-gray-400">In the top right corner</p>
          </div>
        </li>
      </ol>

      <button
        @click="$emit('close')"
        class="w-full px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors"
      >
        Got it
      </button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'IOSInstallModal',
  emits: ['close']
}
</script>
