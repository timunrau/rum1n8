<script setup>
defineProps({
  size: { type: String, default: 'md' }, // 'sm' | 'md'
})
</script>

<template>
  <span
    class="brand-mark"
    :class="{ 'brand-mark--sm': size === 'sm' }"
    aria-hidden="true"
  >r</span>
</template>

<style scoped>
.brand-mark {
  display: grid;
  place-items: center;
  width: 2.3rem;
  height: 2.3rem;
  border-radius: var(--radius-lg);
  background-color: var(--color-action-bg);
  color: var(--color-action-text);
  font-family: var(--font-serif);
  font-weight: 700;
  font-size: 1.25rem;
  line-height: 1;
  letter-spacing: 0;
  padding: 0 0 0.25em 0.1em;
  flex-shrink: 0;
  border: 1px solid var(--color-action-border);
  box-shadow: none;
}

.brand-mark--sm {
  width: 1.8rem;
  height: 1.8rem;
  border-radius: var(--radius-md);
  font-size: 1rem;
}
</style>
