<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import ModalSheet from './ModalSheet.vue'
import VerseStatsPanel from './VerseStatsPanel.vue'

const props = defineProps({
  verse: { type: Object, default: null },
  settings: { type: Object, required: true },
  now: { type: Date, required: true },
  colors: { type: Object, required: true },
  returnFocus: { type: Object, default: null },
})
defineEmits(['close'])
const content = ref(null)
let opener = null
const panel = () => content.value?.closest('.modal-sheet-panel')
const focusable = () => [...(panel()?.querySelectorAll('button, a[href], input, select, textarea, [tabindex="0"]') || [])]
  .filter(element => !element.disabled && !element.hidden && element.getClientRects().length)

function trapFocus(event) {
  if (!props.verse || event.key !== 'Tab') return
  const elements = focusable()
  const first = elements[0]
  const last = elements.at(-1)
  if (!first) return
  if (event.shiftKey && (document.activeElement === first || !panel()?.contains(document.activeElement))) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && (document.activeElement === last || !panel()?.contains(document.activeElement))) {
    event.preventDefault()
    first.focus()
  }
}

watch(() => !!props.verse, async show => {
  if (show) {
    opener = props.returnFocus || document.activeElement
    opener?.blur?.()
    document.addEventListener('keydown', trapFocus, true)
    await nextTick()
    if (props.verse) focusable()[0]?.focus({ preventScroll: true })
  } else {
    document.removeEventListener('keydown', trapFocus, true)
    await nextTick()
    if (opener?.isConnected) opener.focus({ preventScroll: true })
    opener = null
  }
})
onBeforeUnmount(() => document.removeEventListener('keydown', trapFocus, true))
</script>

<template>
  <ModalSheet :show="!!verse" :title="verse?.reference || 'Verse stats'" data-testid="modal-verse-stats" max-width="sm:max-w-lg" @close="$emit('close')">
    <template #title>
      <div class="verse-stats-sheet__title">
        <h2>{{ verse?.reference }}</h2>
        <span v-if="verse?.bibleVersion">{{ verse.bibleVersion }}</span>
      </div>
    </template>
    <div ref="content">
      <VerseStatsPanel v-if="verse" :verse="verse" :settings="settings" :now="now" :colors="colors" :show-identity="false" />
    </div>
  </ModalSheet>
</template>

<style scoped>
.verse-stats-sheet__title { display: flex; align-items: baseline; flex-wrap: wrap; gap: 0.3rem 0.6rem; min-width: 0; }
.verse-stats-sheet__title h2 { font: 400 1.65rem var(--font-serif); overflow-wrap: anywhere; }
.verse-stats-sheet__title span { font: 0.75rem var(--font-mono); color: var(--color-text-muted); }
</style>
