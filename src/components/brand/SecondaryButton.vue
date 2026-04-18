<script setup>
defineProps({
  size: { type: String, default: 'md' },
  type: { type: String, default: 'button' },
  disabled: { type: Boolean, default: false },
})
</script>

<template>
  <button
    :type="type"
    :disabled="disabled"
    class="btn-secondary"
    :class="{ 'btn--sm': size === 'sm' }"
  >
    <slot />
  </button>
</template>
