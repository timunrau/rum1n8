<template>
  <section class="completion-tray voice-panel" aria-label="Voice practice" data-testid="voice-practice-panel">
    <div class="completion-tray__copy">
      <h2 class="completion-tray__title"><span v-if="status === 'listening'" class="voice-panel__recording" aria-hidden="true"></span>{{ status === 'listening' ? 'Listening' : 'Voice practice' }}</h2>
      <p role="status" aria-live="polite" aria-atomic="true" class="completion-tray__meta">{{ message || statusText }}</p>
    </div>

    <template v-if="modelState !== 'ready'">
      <div class="voice-panel__model">
        <button class="btn-primary" :disabled="downloading" @click="$emit('download')">{{ downloading ? `Downloading… ${progressLabel}` : modelState === 'unavailable' ? 'Retry model download' : `Download model (${sizeLabel})` }}</button>
        <button v-if="downloading" class="voice-panel__keyboard" @click="$emit('cancel-download')">Cancel download</button>
      </div>
    </template>

    <div v-else class="completion-tray__actions">
      <button v-if="active" class="btn-primary" :disabled="status === 'finishing'" @click="$emit('stop')">{{ status === 'starting' ? 'Starting…' : status === 'finishing' ? 'Finishing…' : 'Pause' }}</button>
      <button v-else class="btn-primary" @click="$emit('start')">{{ status === 'error' ? 'Retry' : status === 'paused' ? 'Resume' : 'Start' }}</button>
      <button class="btn-secondary" @click="$emit('reveal')">Reveal next word</button>
    </div>

    <button class="voice-panel__keyboard" @click="$emit('keyboard')">Use keyboard instead</button>
    <button v-if="modelState === 'ready'" class="voice-panel__keyboard" @click="$emit('remove-model')">Remove offline model ({{ sizeLabel }})</button>
    <p class="voice-panel__disclosure">Speech is recognized on this device. Ruminate does not save your audio, and nothing is uploaded. <small>BETA</small></p>
  </section>
</template>
<script setup>
import { computed } from 'vue'
const props = defineProps({
  status: String,
  message: String,
  reference: Boolean,
  modelState: { type: String, default: 'unknown' },
  modelProgress: { type: Number, default: 0 },
  modelDownloading: { type: Boolean, default: false },
  sizeLabel: { type: String, default: '' },
})
defineEmits(['start', 'stop', 'reveal', 'keyboard', 'download', 'cancel-download', 'remove-model'])
const active = computed(() => ['starting', 'listening', 'finishing'].includes(props.status))
const downloading = computed(() => props.modelDownloading)
const progressLabel = computed(() => `${Math.round(props.modelProgress * 100)}%`)
const statusText = computed(() => ({ idle: 'Ready to listen.', starting: 'Starting microphone…', listening: props.reference ? 'Say the reference.' : 'Say the next words.', finishing: 'Finishing the last spoken words…', paused: 'Paused. Tap Resume to continue.', error: 'Tap Retry or use the keyboard.' })[props.status])
</script>
<style scoped>
.voice-panel { max-height: 43dvh; overflow-y: auto; text-align: center; }
.voice-panel .completion-tray__title { display: inline-flex; align-items: center; gap: 0.5rem; }
.voice-panel__recording { position: relative; top: 2px; flex: none; width: 0.5rem; height: 0.5rem; border-radius: 50%; background: var(--color-accent-warm); animation: voice-recording 1.35s ease-in-out infinite; }
@keyframes voice-recording { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.3; transform: scale(0.78); } }
.voice-panel__model { max-width: 32rem; margin: 0 auto; }
.voice-panel__keyboard { display: block; margin: .55rem auto 0; padding: .25rem .5rem; font-size: .8rem; text-decoration: underline; }
.voice-panel__disclosure { max-width: 32rem; margin: .4rem auto 0; color: var(--color-text-muted); font-size: .72rem; line-height: 1.4; }
.voice-panel__disclosure small { margin-left: .4rem; color: var(--color-accent-warm-text); font-family: var(--font-mono); font-size: .6rem; letter-spacing: .08em; vertical-align: middle; }
@media (prefers-reduced-motion: reduce) { .voice-panel__recording { animation: none; } }
@media (max-height: 600px) { .voice-panel { max-height: 48dvh; } }
</style>
