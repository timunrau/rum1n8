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
  border-radius: 1rem;
  background-image: var(--gradient-primary);
  color: #ffffff;
  font-family: var(--font-serif);
  font-weight: 700;
  font-size: 1.25rem;
  line-height: 1;
  letter-spacing: 0;
  padding: 0 0 0.25em 0.1em;
  flex-shrink: 0;
  box-shadow: 0 2px 6px rgba(20, 35, 58, 0.15);
}

.brand-mark--sm {
  width: 1.8rem;
  height: 1.8rem;
  border-radius: 0.75rem;
  font-size: 1rem;
}
</style>
