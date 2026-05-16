<template>
  <ModalSheet
    :show="show"
    :title="title"
    :data-testid="dataTestid"
    max-width="sm:max-w-md"
    compact
    @close="handleClose"
  >
    <div class="space-y-3">
      <p class="text-sm leading-relaxed text-text-secondary whitespace-pre-line">{{ message }}</p>
    </div>

    <template #footer>
      <div class="flex justify-end gap-3">
        <button
          v-if="mode === 'confirm'"
          type="button"
          class="btn-secondary"
          @click="$emit('cancel')"
        >
          {{ cancelLabel }}
        </button>
        <button
          type="button"
          :class="confirmButtonClass"
          @click="$emit('confirm')"
        >
          {{ confirmLabel }}
        </button>
      </div>
    </template>
  </ModalSheet>
</template>

<script>
import ModalSheet from './ModalSheet.vue'

export default {
  name: 'AppDialog',
  components: { ModalSheet },
  props: {
    show: { type: Boolean, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    mode: {
      type: String,
      default: 'alert',
      validator: (value) => ['alert', 'confirm'].includes(value),
    },
    variant: {
      type: String,
      default: 'default',
      validator: (value) => ['default', 'danger'].includes(value),
    },
    confirmLabel: { type: String, default: 'OK' },
    cancelLabel: { type: String, default: 'Cancel' },
    dataTestid: { type: String, default: 'modal-app-dialog' },
  },
  emits: ['confirm', 'cancel'],
  computed: {
    confirmButtonClass() {
      return this.variant === 'danger' ? 'btn-danger' : 'btn-primary'
    },
  },
  methods: {
    handleClose() {
      this.$emit(this.mode === 'confirm' ? 'cancel' : 'confirm')
    },
  },
}
</script>
