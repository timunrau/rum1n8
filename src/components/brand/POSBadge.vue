<script setup>
import { computed } from 'vue'

const props = defineProps({
  // One of: 'unmemorized' | 'learned' | 'memorized' | 'mastered'
  status: { type: String, required: true },
  // If true, a 'mastered' verse becomes '[due]' instead of '[mastered]'
  due: { type: Boolean, default: false },
})

const label = computed(() => {
  if (props.due) return 'due'
  switch (props.status) {
    case 'unmemorized':
      return 'learn'
    case 'learned':
      return 'memorize'
    case 'memorized':
      return 'master'
    case 'mastered':
      return 'mastered'
    default:
      return props.status
  }
})

const variant = computed(() => {
  if (props.due) return 'due'
  if (props.status === 'mastered') return 'mastered'
  return 'progress'
})
</script>

<template>
  <em class="pos-badge-el" :class="[`pos-badge-el--${variant}`]">
    <span class="pos-badge-el__bracket">[</span>{{ label }}<span class="pos-badge-el__bracket">]</span>
  </em>
</template>

<style scoped>
.pos-badge-el {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 0.85rem;
  line-height: 1;
  letter-spacing: 0;
  white-space: nowrap;
  display: inline-block;
  padding: 0.15em 0.5em;
  border-radius: 999px;
}

.pos-badge-el__bracket {
  opacity: 0.55;
  margin: 0 0.05em;
}

.pos-badge-el--progress {
  color: var(--color-text-secondary);
}

.pos-badge-el--mastered {
  color: var(--color-accent-strong);
  border: 1px solid var(--color-border-default);
}

.pos-badge-el--due {
  color: #6b4a0e;
  background: rgba(199, 154, 43, 0.18);
}

.dark .pos-badge-el--due {
  color: #f2d789;
  background: rgba(217, 175, 77, 0.2);
}

.dark .pos-badge-el--mastered {
  color: var(--color-accent-strong);
}
</style>
