<script setup>
import { computed } from 'vue'

const props = defineProps({
  reference: { type: String, required: true },
  size: { type: String, default: 'md' }, // 'sm' | 'md' | 'lg'
})

const parts = computed(() => {
  const match = props.reference.match(/^(.*?)\s+(\d.*)$/)
  return match
    ? { book: match[1], verseRef: match[2] }
    : { book: props.reference, verseRef: '' }
})
</script>

<template>
  <span class="headword-ref" :class="[`headword-ref--${size}`]">
    <span class="headword-ref__book">{{ parts.book }}</span>
    <span v-if="parts.verseRef" class="headword-ref__verse">&nbsp;{{ parts.verseRef }}</span>
  </span>
</template>

<style scoped>
.headword-ref {
  font-family: var(--font-serif);
  letter-spacing: -0.03em;
  color: var(--color-text-primary);
  display: inline-flex;
  align-items: baseline;
  max-width: 100%;
  min-width: 0;
}

.headword-ref--sm {
  font-size: 1.05rem;
}
.headword-ref--md {
  font-size: 1.25rem;
}
.headword-ref--lg {
  font-size: 1.6rem;
}

.headword-ref__book {
  position: relative;
  display: inline-block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.headword-ref__book::after {
  content: "";
  position: absolute;
  left: 0;
  right: 15%;
  bottom: -0.1em;
  height: 2px;
  background: linear-gradient(90deg, var(--color-accent-warm), rgba(199, 154, 43, 0));
  border-radius: 1px;
  opacity: 0.75;
  pointer-events: none;
}

.headword-ref__verse {
  white-space: nowrap;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}
</style>
