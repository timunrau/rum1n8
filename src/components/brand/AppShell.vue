<script setup>
defineProps({
  tag: { type: String, default: 'div' },
})
</script>

<template>
  <component :is="tag" class="app-shell">
    <div class="app-shell__decor app-shell__decor--gold breathing" aria-hidden="true"></div>
    <div class="app-shell__decor app-shell__decor--blue breathing" aria-hidden="true"></div>
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

.app-shell__decor {
  position: absolute;
  border-radius: 50%;
  filter: blur(48px);
  pointer-events: none;
  z-index: 0;
  will-change: transform, opacity;
}

.app-shell__decor--gold {
  top: -4rem;
  left: -4rem;
  width: 17rem;
  height: 17rem;
  background: rgba(222, 192, 132, 0.16);
}

.app-shell__decor--blue {
  top: -3rem;
  right: -5rem;
  width: 19rem;
  height: 19rem;
  background: rgba(131, 166, 224, 0.12);
  animation-delay: -4s;
}

.dark .app-shell__decor--gold {
  background: rgba(217, 175, 77, 0.14);
}

.dark .app-shell__decor--blue {
  background: rgba(75, 130, 216, 0.12);
}
</style>
