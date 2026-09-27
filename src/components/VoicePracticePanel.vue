<template>
  <section class="completion-tray voice-panel" aria-label="Voice practice" data-testid="voice-practice-panel">
    <div class="completion-tray__copy">
      <h2 class="completion-tray__title">{{ status === 'listening' ? 'Listening' : 'Voice practice' }} <small>BETA</small></h2>
      <p role="status" aria-live="polite" aria-atomic="true" class="completion-tray__meta">{{ message || statusText }}</p>
    </div>
    <div class="completion-tray__actions">
      <button v-if="active" class="btn-primary" :disabled="status === 'finishing'" @click="$emit('stop')">{{ status === 'starting' ? 'Starting…' : status === 'finishing' ? 'Finishing…' : 'Pause' }}</button>
      <button v-else class="btn-primary" @click="$emit('start')">{{ status === 'error' ? 'Retry' : status === 'paused' ? 'Resume' : 'Start' }}</button>
      <button class="btn-secondary" @click="$emit('reveal')">Reveal next word</button>
    </div>
    <button class="voice-panel__keyboard" @click="$emit('keyboard')">Use keyboard instead</button>
    <p class="voice-panel__disclosure">Your browser may process speech online. Ruminate does not save your audio.</p>
  </section>
</template>
<script setup>
import { computed } from 'vue'
const props = defineProps({ status: String, message: String, reference: Boolean })
defineEmits(['start', 'stop', 'reveal', 'keyboard'])
const active = computed(() => ['starting', 'listening', 'finishing'].includes(props.status))
const statusText = computed(() => ({ idle: 'Ready to listen.', starting: 'Starting microphone…', listening: props.reference ? 'Say the reference.' : 'Recite from the highlighted position.', finishing: 'Finishing the last spoken words…', paused: 'Paused. Tap Resume to continue.', error: 'Tap Retry or use the keyboard.' })[props.status])
</script>
<style scoped>
.voice-panel { max-height: 43dvh; overflow-y: auto; text-align: center; }
.voice-panel small { color: var(--color-accent-warm-text); font-family: var(--font-mono); font-size: .6rem; letter-spacing: .08em; vertical-align: middle; }
.voice-panel__keyboard { display: block; margin: .55rem auto 0; padding: .25rem .5rem; font-size: .8rem; text-decoration: underline; }
.voice-panel__disclosure { max-width: 32rem; margin: .4rem auto 0; color: var(--color-text-muted); font-size: .72rem; line-height: 1.4; }
@media (max-height: 600px) { .voice-panel { max-height: 48dvh; } }
</style>
