<script setup>
defineProps({
  size: { type: String, default: 'md' }, // 'sm' | 'md'
})
</script>

<template>
  <img
    class="brand-mark"
    :class="{ 'brand-mark--sm': size === 'sm' }"
    :src="'/icons/icon-192x192.png'"
    alt=""
    aria-hidden="true"
  >
</template>

<style scoped>
.brand-mark {
  display: block;
  width: 2.3rem;
  height: 2.3rem;
  object-fit: contain;
  flex-shrink: 0;
  box-shadow: none;
}

.brand-mark--sm {
  width: 3.125rem;
  height: 3.125rem;
}
</style>
