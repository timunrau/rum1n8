<script setup>
import { computed } from 'vue'

const props = defineProps({
  summary: { type: Object, required: true },
  showStatus: { type: Boolean, default: true },
})

const parts = computed(() => {
  const { total, due, learning } = props.summary
  const parts = [{ key: 'total', label: `${total} verse${total !== 1 ? 's' : ''}` }]
  if (props.showStatus) {
    if (learning > 0) parts.push({ key: 'learning', label: `${learning} unmastered` })
    if (due > 0) parts.push({ key: 'due', label: `${due} due` })
  }
  return parts
})
</script>

<template>
  <div class="collection-tile__meta">
    <span
      v-for="part in parts"
      :key="part.key"
      :class="{ 'collection-tile__meta-due': part.key === 'due' }"
    >{{ part.label }}</span>
  </div>
</template>
