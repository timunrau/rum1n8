<template>
  <div class="flex-1 flex flex-col overflow-hidden max-w-4xl mx-auto w-full sm:px-4">
    <!-- Scrollable verse text -->
    <div ref="scrollContainer" class="flex-1 overflow-y-auto min-h-0 sm:py-4">
      <div class="bg-chrome p-4 mb-2 sm:my-4 fade-in">
        <div
          class="text-xl leading-relaxed text-text-primary font-serif"
          @click="focusInput"
        >
          <span
            v-for="(word, index) in reviewWords"
            :key="index"
            :id="`practice-word-${index}`"
            :class="word.isReferenceUnit && word.separatorAfter ? 'inline-block' : 'inline-block mr-2'"
          >
            <span v-if="memorizationMode === 'learn'">
              <template v-if="word.revealed">
                <template v-if="shouldRenderReferenceSegments(word)">
                  <span
                    v-for="(segment, segmentIndex) in getReferenceSegments(word)"
                    :key="`${index}-learn-revealed-${segmentIndex}`"
                    :class="getReferenceSegmentClass(segment, true)"
                  >{{ segment.text }}</span><span class="text-text-primary">{{ word.separatorAfter || '' }}</span>
                </template>
                <span v-else :class="word.incorrect ? 'text-word-incorrect' : 'text-text-primary'">{{ word.text }}{{ word.separatorAfter || '' }}</span>
              </template>
              <template v-else-if="isPartiallyTyped(word)">
                <template v-if="shouldRenderReferenceSegments(word)">
                  <span
                    v-for="(segment, segmentIndex) in getReferenceSegments(word)"
                    :key="`${index}-learn-partial-${segmentIndex}`"
                    :class="getReferenceSegmentClass(segment, false)"
                  >{{ segment.text }}</span><span class="text-word-unrevealed">{{ word.separatorAfter || '' }}</span>
                </template>
                <template v-else>
                  <span :class="word.incorrect ? 'text-word-incorrect' : 'text-text-primary'">{{ getPartialWordText(word) }}</span><span class="text-word-unrevealed">{{ getRemainingPartText(word) }}{{ word.separatorAfter || '' }}</span>
                </template>
              </template>
              <template v-else>
                <span class="text-word-unrevealed">{{ word.text }}{{ word.separatorAfter || '' }}</span>
              </template>
            </span>
            <span v-else-if="memorizationMode === 'memorize'">
              <span v-if="word.visible && !word.revealed && !isPartiallyTyped(word)" class="text-word-unrevealed">
                {{ word.text }}{{ word.separatorAfter || '' }}
              </span>
              <template v-else-if="word.revealed">
                <template v-if="shouldRenderReferenceSegments(word)">
                  <span
                    v-for="(segment, segmentIndex) in getReferenceSegments(word)"
                    :key="`${index}-memorize-revealed-${segmentIndex}`"
                    :class="getReferenceSegmentClass(segment, true)"
                  >{{ segment.text }}</span><span class="text-text-primary">{{ word.separatorAfter || '' }}</span>
                </template>
                <span v-else :class="word.incorrect ? 'text-word-incorrect' : 'text-text-primary'">
                  {{ word.text }}{{ word.separatorAfter || '' }}
                </span>
              </template>
              <template v-else-if="isPartiallyTyped(word)">
                <template v-if="shouldRenderReferenceSegments(word)">
                  <span
                    v-for="(segment, segmentIndex) in getReferenceSegments(word)"
                    :key="`${index}-memorize-partial-${segmentIndex}`"
                    :class="getReferenceSegmentClass(segment, false)"
                  >{{ segment.text }}</span><span class="text-word-unrevealed">{{ word.separatorAfter || '' }}</span>
                </template>
                <template v-else>
                  <span :class="word.incorrect ? 'text-word-incorrect' : 'text-text-primary'">{{ getPartialWordText(word) }}</span><span class="border-b-2 border-word-unrevealed text-transparent select-none">{{ getRemainingPartText(word) }}</span><span class="text-word-unrevealed">{{ word.separatorAfter || '' }}</span>
                </template>
              </template>
              <span v-else>
                <span class="border-b-2 border-word-unrevealed text-transparent select-none">{{ word.text }}</span><span class="text-word-unrevealed">{{ word.separatorAfter || '' }}</span>
              </span>
            </span>
            <span v-else-if="memorizationMode === 'master'">
              <template v-if="word.revealed">
                <template v-if="shouldRenderReferenceSegments(word)">
                  <span
                    v-for="(segment, segmentIndex) in getReferenceSegments(word)"
                    :key="`${index}-master-revealed-${segmentIndex}`"
                    :class="getReferenceSegmentClass(segment, true)"
                  >{{ segment.text }}</span><span class="text-text-primary">{{ word.separatorAfter || '' }}</span>
                </template>
                <span v-else :class="word.incorrect ? 'text-word-incorrect' : 'text-text-primary'">
                  {{ word.text }}{{ word.separatorAfter || '' }}
                </span>
              </template>
              <template v-else-if="isPartiallyTyped(word)">
                <template v-if="shouldRenderReferenceSegments(word)">
                  <span
                    v-for="(segment, segmentIndex) in getReferenceSegments(word)"
                    :key="`${index}-master-partial-${segmentIndex}`"
                    :class="getReferenceSegmentClass(segment, false)"
                  >{{ segment.text }}</span><span class="text-word-unrevealed">{{ word.separatorAfter || '' }}</span>
                </template>
                <template v-else>
                  <span :class="word.incorrect ? 'text-word-incorrect' : (word.isReferenceUnit ? 'text-text-primary' : 'text-text-primary font-semibold')">{{ getPartialWordText(word) }}</span><span class="border-b-2 border-word-unrevealed text-transparent select-none">{{ getRemainingPartText(word) }}</span><span class="text-word-unrevealed">{{ word.separatorAfter || '' }}</span>
                </template>
              </template>
              <span v-else>
                <span class="border-b-2 border-word-unrevealed text-transparent select-none">{{ word.text }}</span><span class="text-word-unrevealed">{{ word.separatorAfter || '' }}</span>
              </span>
            </span>
          </span>
        </div>
      </div>
    </div>

    <div v-if="showPracticeModesHint && !showTray && practiceModeHint" class="px-4 pb-1">
      <div class="practice-hint">
        <div class="flex items-start gap-3">
          <div class="practice-hint__icon">
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 18h6" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 22h4" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3a6 6 0 00-3.6 10.8c.79.59 1.35 1.44 1.56 2.4h4.08c.21-.96.77-1.81 1.56-2.4A6 6 0 0012 3z" />
            </svg>
          </div>
          <div class="flex-1">
            <p class="practice-hint__title">{{ practiceModeHint.title }}</p>
            <p v-if="practiceModeHint.body" class="practice-hint__body">{{ practiceModeHint.body }}</p>
          </div>
          <button
            type="button"
            class="practice-hint__close"
            aria-label="Dismiss practice modes help"
            @click="$emit('dismiss-practice-modes-hint')"
          >
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Mode buttons: Learn | Memorize | Master -->
    <div v-if="!showTray" class="my-2 flex-shrink-0">
      <div class="flex items-center justify-center gap-1">
        <div
          v-for="(stage, index) in stages"
          :key="index"
          class="flex items-center"
        >
          <div
            @click="onSwitchMode(stage.mode)"
            :class="[
              'mode-chip',
              memorizationMode === stage.mode
                ? 'mode-chip--active'
                : isStageComplete(stage)
                ? 'mode-chip--complete'
                : canSwitch(stage.mode)
                ? 'mode-chip--available'
                : 'mode-chip--disabled'
            ]"
          >
            {{ stage.name }}
          </div>
          <svg
            v-if="index < 2"
            class="w-5 h-5 mx-1 text-accent-warm"
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
import { computed, ref, onMounted, nextTick } from 'vue'

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
    showTray: { type: Boolean, default: false },
    showPracticeModesHint: { type: Boolean, default: false }
  },
  emits: ['update:typedLetter', 'keydown', 'input', 'switch-mode', 'dismiss-practice-modes-hint'],
  setup(props, { emit, expose }) {
    const inputRef = ref(null)
    const scrollContainer = ref(null)
    const practiceModeHint = computed(() => {
      if (props.memorizationMode === 'learn') {
        return {
          title: 'Type the first letter of each word.',
          body: null
        }
      }

      if (props.memorizationMode === 'memorize') {
        return {
          title: 'See if you can still do it with some of the words hidden.',
          body: null
        }
      }

      if (props.memorizationMode === 'master') {
        return {
          title: 'Now try it without any words visible.',
          body: null
        }
      }

      return null
    })

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

    function shouldRenderReferenceSegments(word) {
      return !!(
        word?.isReferenceUnit &&
        word.requiredLetters?.length > 1 &&
        Array.isArray(word.incorrectLetterIndices) &&
        word.incorrectLetterIndices.length > 0 &&
        ((word.typedLettersIndex || 0) > 0 || word.revealed)
      )
    }

    function getReferenceSegments(word) {
      if (!word?.text) return []

      const typedLettersIndex = Math.max(0, word.typedLettersIndex || 0)
      const incorrectIndices = new Set(word.incorrectLetterIndices || [])
      const segments = []
      let currentState = null
      let currentText = ''

      for (let index = 0; index < word.text.length; index++) {
        let state = 'untyped'
        if (index < typedLettersIndex) {
          state = incorrectIndices.has(index) ? 'incorrect' : 'typed'
        }

        if (state !== currentState) {
          if (currentText) {
            segments.push({ text: currentText, state: currentState })
          }
          currentState = state
          currentText = word.text[index]
        } else {
          currentText += word.text[index]
        }
      }

      if (currentText) {
        segments.push({ text: currentText, state: currentState })
      }

      return segments
    }

    function getReferenceSegmentClass(segment, isRevealed) {
      if (segment.state === 'incorrect') {
        return 'text-word-incorrect'
      }

      if (segment.state === 'typed') {
        return 'text-text-primary'
      }

      if (isRevealed) {
        return 'text-text-primary'
      }

      if (props.memorizationMode === 'learn') {
        return 'text-word-unrevealed'
      }

      return 'border-b-2 border-word-unrevealed text-transparent select-none'
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
      practiceModeHint,
      inputRef,
      scrollContainer,
      isStageComplete,
      canSwitch,
      onSwitchMode,
      onInput,
      onKeydown,
      focusInput,
      shouldRenderReferenceSegments,
      getReferenceSegments,
      getReferenceSegmentClass
    }
  }
}
</script>
