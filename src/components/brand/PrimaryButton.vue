<script setup>
defineProps({
  size: { type: String, default: 'md' }, // 'sm' | 'md'
  type: { type: String, default: 'button' },
  disabled: { type: Boolean, default: false },
})
</script>

<template>
  <button
    :type="type"
    :disabled="disabled"
    class="btn-primary"
    :class="{ 'btn--sm': size === 'sm' }"
  >
    <slot />
  </button>
</template>
