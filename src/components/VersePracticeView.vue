<template>
  <div class="flex-1 flex flex-col overflow-hidden max-w-4xl mx-auto w-full sm:px-4">
    <!-- Scrollable verse text -->
    <div ref="scrollContainer" class="flex-1 overflow-y-auto min-h-0 sm:py-4">
      <div class="bg-surface dark:bg-black p-4 my-2 sm:my-4">
        <div
          class="text-xl leading-relaxed text-text-primary font-serif"
          @click="focusInput"
        >
          <span
            v-for="(word, index) in reviewWords"
            :key="index"
            :id="`practice-word-${index}`"
            class="inline-block mr-2"
          >
            <span v-if="memorizationMode === 'learn'">
              <template v-if="word.revealed">
                <span :class="word.incorrect ? 'text-word-incorrect' : 'text-text-primary'">{{ word.text }}{{ word.separatorAfter || '' }}</span>
              </template>
              <template v-else-if="isPartiallyTyped(word)">
                <span class="text-text-primary">{{ getPartialWordText(word) }}</span><span class="text-word-unrevealed">{{ getRemainingPartText(word) }}{{ word.separatorAfter || '' }}</span>
              </template>
              <template v-else>
                <span class="text-word-unrevealed">{{ word.text }}{{ word.separatorAfter || '' }}</span>
              </template>
            </span>
            <span v-else-if="memorizationMode === 'memorize'">
              <span v-if="word.visible && !word.revealed && !isPartiallyTyped(word)" class="text-word-unrevealed">
                {{ word.text }}{{ word.separatorAfter || '' }}
              </span>
              <span v-else-if="word.revealed" :class="word.incorrect ? 'text-word-incorrect' : 'text-text-primary'">
                {{ word.text }}{{ word.separatorAfter || '' }}
              </span>
              <template v-else-if="isPartiallyTyped(word)">
                <span class="text-text-primary">{{ getPartialWordText(word) }}</span><span class="border-b-2 border-word-unrevealed text-transparent select-none">{{ getRemainingPartText(word) }}</span><span class="text-word-unrevealed">{{ word.separatorAfter || '' }}</span>
              </template>
              <span v-else>
                <span class="border-b-2 border-word-unrevealed text-transparent select-none">{{ word.text }}</span><span class="text-word-unrevealed">{{ word.separatorAfter || '' }}</span>
              </span>
            </span>
            <span v-else-if="memorizationMode === 'master'">
              <span v-if="word.revealed" :class="word.incorrect ? 'text-word-incorrect' : 'text-text-primary'">
                {{ word.text }}{{ word.separatorAfter || '' }}
              </span>
              <template v-else-if="isPartiallyTyped(word)">
                <span class="text-text-primary font-semibold">{{ getPartialWordText(word) }}</span><span class="border-b-2 border-word-unrevealed text-transparent select-none">{{ getRemainingPartText(word) }}</span><span class="text-word-unrevealed">{{ word.separatorAfter || '' }}</span>
              </template>
              <span v-else>
                <span class="border-b-2 border-word-unrevealed text-transparent select-none">{{ word.text }}</span><span class="text-word-unrevealed">{{ word.separatorAfter || '' }}</span>
              </span>
            </span>
          </span>
        </div>
      </div>
    </div>

    <!-- Mode buttons: Learn | Memorize | Master -->
    <div v-if="!showTray" class="my-2 flex-shrink-0">
      <div class="flex items-center justify-center gap-2">
        <div
          v-for="(stage, index) in stages"
          :key="index"
          class="flex items-center"
        >
          <div
            @click="onSwitchMode(stage.mode)"
            :class="[
              'px-4 py-1 rounded-lg font-semibold transition-colors duration-200',
              memorizationMode === stage.mode
                ? 'bg-blue-600 text-white cursor-pointer hover:bg-blue-700'
                : isStageComplete(stage)
                ? 'bg-status-success-bg text-status-success-text cursor-pointer hover:bg-surface-hover'
                : canSwitch(stage.mode)
                ? 'bg-sunken text-text-secondary cursor-pointer hover:bg-surface-hover'
                : 'bg-sunken text-text-muted'
            ]"
          >
            {{ stage.name }}
          </div>
          <svg
            v-if="index < 2"
            class="w-6 h-6 mx-2 text-text-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </div>

    <!-- Hidden letter input -->
    <div class="text-center flex-shrink-0">
      <input
        ref="inputRef"
        :value="typedLetter"
        type="text"
        autocomplete="off"
        autocorrect="off"
        autocapitalize="off"
        spellcheck="false"
        inputmode="text"
        name="letter-input"
        :id="inputId"
        class="absolute opacity-0 w-0 h-0"
        @input="onInput"
        @keydown="onKeydown"
      />
    </div>
  </div>
</template>

<script>
import { ref, onMounted, nextTick } from 'vue'

export default {
  name: 'VersePracticeView',
  props: {
    verse: { type: Object, default: null },
    memorizationMode: { type: String, default: null },
    reviewWords: { type: Array, default: () => [] },
    context: { type: String, validator: (v) => ['memorization', 'review'].includes(v) },
    typedLetter: { type: String, default: '' },
    getMemorizationStatus: { type: Function, required: true },
    canSwitchToMode: { type: Function, required: true },
    isPartiallyTyped: { type: Function, required: true },
    getPartialWordText: { type: Function, required: true },
    getRemainingPartText: { type: Function, required: true },
    inputId: { type: String, default: 'letter-input-practice' },
    showTray: { type: Boolean, default: false }
  },
  emits: ['update:typedLetter', 'keydown', 'input', 'switch-mode'],
  setup(props, { emit, expose }) {
    const inputRef = ref(null)
    const scrollContainer = ref(null)

    const stages = [
      { name: 'Learn', status: 'unmemorized', mode: 'learn' },
      { name: 'Memorize', status: 'learned', mode: 'memorize' },
      { name: 'Master', status: 'memorized', mode: 'master' }
    ]

    function isStageComplete(stage) {
      if (props.context === 'review') {
        return true
      }
      const status = props.getMemorizationStatus(props.verse)
      if (status === 'mastered') return true
      if (stage.status === 'unmemorized' && status === 'learned') return true
      if (stage.status === 'learned' && status === 'memorized') return true
      if (stage.status === 'memorized' && status === 'mastered') return true
      return false
    }

    function canSwitch(mode) {
      if (props.context === 'review') return true
      return props.canSwitchToMode(mode)
    }

    function onSwitchMode(mode) {
      emit('switch-mode', mode)
      nextTick(() => focusInput())
    }

    function onInput(e) {
      const value = e.target && e.target.value
      emit('update:typedLetter', value !== undefined ? value : '')
      emit('input')
    }

    function onKeydown(e) {
      emit('keydown', e)
    }

    function focusInput() {
      if (inputRef.value) {
        inputRef.value.focus()
      }
    }

    onMounted(() => {
      nextTick(() => {
        setTimeout(() => focusInput(), 100)
      })
    })

    function scrollToEnd() {
      if (!scrollContainer.value) return
      const words = scrollContainer.value.querySelectorAll('[id^="practice-word-"]')
      const lastWord = words[words.length - 1]
      if (lastWord) {
        lastWord.scrollIntoView({ block: 'nearest' })
      }
    }

    expose({
      inputRef,
      scrollContainer,
      focusInput,
      scrollToEnd
    })

    return {
      stages,
      inputRef,
      scrollContainer,
      isStageComplete,
      canSwitch,
      onSwitchMode,
      onInput,
      onKeydown,
      focusInput
    }
  }
}
</script>
