<script setup>
defineProps({
  tag: { type: String, default: 'div' },
})
</script>

<template>
  <component :is="tag" class="app-shell">
    <div class="app-shell__content">
      <slot />
    </div>
  </component>
</template>

<style scoped>
.app-shell {
  position: relative;
  min-height: 100%;
  width: 100%;
  background-color: var(--color-bg-base);
  background-image: var(--gradient-page);
  overflow: hidden;
  isolation: isolate;
}

.app-shell__content {
  position: relative;
  z-index: 1;
  min-height: 100%;
}
</style>
