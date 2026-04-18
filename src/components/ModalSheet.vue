<template>
  <Transition name="modal-sheet">
    <div v-if="show" class="fixed inset-0 z-50" :data-testid="dataTestid">
      <!-- Backdrop -->
      <div class="modal-sheet-backdrop absolute inset-0 bg-black/60" @click="$emit('close')" />

      <!-- Panel -->
      <div
        class="modal-sheet-panel relative flex flex-col h-full w-full bg-chrome sm:absolute sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:h-auto sm:max-h-[85vh] sm:rounded-brand sm:shadow-soft sm:w-full rounded-t-3xl"
        :class="maxWidth"
      >
        <!-- Sticky header -->
        <div class="flex items-center justify-between px-5 pt-5 pb-3 sm:px-6 sm:pt-6 sm:pb-4 flex-shrink-0">
          <h2 class="text-2xl font-serif font-normal tracking-tight text-text-primary">{{ title }}</h2>
          <button
            @click="$emit('close')"
            class="p-2 -mr-2 rounded-xl text-text-muted hover:text-accent-warm hover:bg-surface-hover transition-colors duration-200"
            aria-label="Close"
          >
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <!-- Scrollable content -->
        <div class="flex-1 overflow-y-auto px-5 pb-2 sm:px-6 min-h-0">
          <slot />
        </div>

        <!-- Sticky footer -->
        <div v-if="$slots.footer" class="flex-shrink-0 px-5 py-4 sm:px-6 sm:py-5 border-t border-border-default sm:border-t-0">
          <slot name="footer" />
        </div>
      </div>
    </div>
  </Transition>
</template>

<script>
export default {
  name: 'ModalSheet',
  props: {
    show: {
      type: Boolean,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    dataTestid: {
      type: String,
      default: null,
    },
    maxWidth: {
      type: String,
      default: 'sm:max-w-2xl',
    },
  },
  emits: ['close'],
  mounted() {
    this._onKeydown = (e) => {
      if (e.key === 'Escape' && this.show) {
        this.$emit('close')
      }
    }
    document.addEventListener('keydown', this._onKeydown)
  },
  unmounted() {
    document.removeEventListener('keydown', this._onKeydown)
  },
}
</script>
