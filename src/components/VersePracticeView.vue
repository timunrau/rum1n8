<template>
  <div
    class="practice-swipe-frame flex-1 flex flex-col overflow-hidden max-w-4xl mx-auto w-full sm:px-4"
    @touchstart.passive="onPracticeTouchStart"
    @touchmove="onPracticeTouchMove"
    @touchend.passive="onPracticeTouchEnd"
    @touchcancel="resetPracticeSwipe"
  >
    <div
      v-if="practiceSwipePreview"
      class="practice-swipe-peek"
      :class="[`practice-swipe-peek--${practiceSwipePreview.edge}`, { 'practice-swipe-peek--edge': !practiceSwipePreview.canNavigate }]"
      :style="practiceSwipePreviewStyle"
      aria-hidden="true"
    >
      <div class="practice-swipe-peek__panel">
        <p class="practice-swipe-peek__reference">{{ practiceSwipePreview.reference }}</p>
        <p v-if="practiceSwipePreview.content" class="practice-swipe-peek__content">{{ practiceSwipePreview.content }}</p>
      </div>
    </div>

    <div
      class="practice-swipe-current flex-1 flex flex-col min-h-0"
      :class="{
        'practice-swipe-current--dragging': isPracticeSwipeDragging,
        'practice-swipe-current--settling': isPracticeSwipeSettling
      }"
      :style="practiceSwipeCurrentStyle"
    >
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
  </div>
</template>

<script>
import { computed, ref, onMounted, onBeforeUnmount, nextTick } from 'vue'

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
    showPracticeModesHint: { type: Boolean, default: false },
    previousVerse: { type: Object, default: null },
    nextVerse: { type: Object, default: null }
  },
  emits: ['update:typedLetter', 'keydown', 'input', 'switch-mode', 'dismiss-practice-modes-hint', 'swipe-verse'],
  setup(props, { emit, expose }) {
    const inputRef = ref(null)
    const scrollContainer = ref(null)
    const createEmptyPracticeSwipe = () => ({
      started: false,
      dragging: false,
      settling: false,
      startX: 0,
      startY: 0,
      lastX: 0,
      lastTime: 0,
      rawDx: 0,
      dx: 0,
      dy: 0,
      velocityX: 0,
      direction: null,
      lockedAxis: null,
      canNavigate: false,
      width: 1
    })
    const practiceSwipe = ref(createEmptyPracticeSwipe())
    let practiceSwipeResetTimer = null
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

    function clamp(value, min, max) {
      return Math.min(max, Math.max(min, value))
    }

    function getViewportWidth() {
      if (typeof window === 'undefined') return 390
      return Math.max(window.innerWidth || 390, 1)
    }

    function getSwipeTarget(direction) {
      return direction === 'next' ? props.nextVerse : props.previousVerse
    }

    function getDisplayDx(rawDx, hasTarget, width) {
      const sign = rawDx < 0 ? -1 : 1
      const distance = Math.abs(rawDx)

      if (!hasTarget) {
        return sign * Math.min(54, 8 + Math.sqrt(distance) * 4.4)
      }

      const maxDistance = width * 0.92
      if (distance <= maxDistance) return rawDx

      return sign * (maxDistance + (distance - maxDistance) * 0.16)
    }

    function clearPracticeSwipeResetTimer() {
      if (practiceSwipeResetTimer) {
        clearTimeout(practiceSwipeResetTimer)
        practiceSwipeResetTimer = null
      }
    }

    function resetPracticeSwipe() {
      clearPracticeSwipeResetTimer()
      practiceSwipe.value = createEmptyPracticeSwipe()
    }

    function setPracticeSwipe(nextState) {
      practiceSwipe.value = {
        ...practiceSwipe.value,
        ...nextState
      }
    }

    function settlePracticeSwipeBack() {
      clearPracticeSwipeResetTimer()
      setPracticeSwipe({ settling: true, dragging: false, dx: 0, rawDx: 0 })
      practiceSwipeResetTimer = setTimeout(() => {
        resetPracticeSwipe()
      }, 260)
    }

    function onPracticeTouchStart(e) {
      if (e.touches.length !== 1) {
        resetPracticeSwipe()
        return
      }

      const touch = e.touches[0]
      clearPracticeSwipeResetTimer()
      practiceSwipe.value = {
        ...createEmptyPracticeSwipe(),
        started: true,
        startX: touch.clientX,
        startY: touch.clientY,
        lastX: touch.clientX,
        lastTime: typeof performance !== 'undefined' ? performance.now() : Date.now(),
        width: getViewportWidth()
      }
    }

    function onPracticeTouchMove(e) {
      const state = practiceSwipe.value
      if (!state.started || e.touches.length !== 1) return

      const touch = e.touches[0]
      const rawDx = touch.clientX - state.startX
      const dy = touch.clientY - state.startY
      const absDx = Math.abs(rawDx)
      const absDy = Math.abs(dy)

      let lockedAxis = state.lockedAxis
      if (!lockedAxis) {
        if (absDx > 10 && absDx > absDy * 1.2) {
          lockedAxis = 'x'
        } else if (absDy > 10 && absDy > absDx) {
          resetPracticeSwipe()
          return
        } else {
          return
        }
      }

      if (lockedAxis !== 'x') return
      e.preventDefault()

      const direction = rawDx < 0 ? 'next' : 'previous'
      const target = getSwipeTarget(direction)
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
      const elapsed = Math.max(now - state.lastTime, 1)
      const velocityX = (touch.clientX - state.lastX) / elapsed
      const displayDx = getDisplayDx(rawDx, !!target, state.width)

      practiceSwipe.value = {
        ...state,
        dragging: true,
        settling: false,
        lockedAxis,
        rawDx,
        dx: displayDx,
        dy,
        direction,
        canNavigate: !!target,
        velocityX,
        lastX: touch.clientX,
        lastTime: now
      }
    }

    function onPracticeTouchEnd(e) {
      const state = practiceSwipe.value
      if (!state.started) return

      if (!state.dragging) {
        resetPracticeSwipe()
        return
      }

      const touch = e.changedTouches[0]
      const rawDx = touch.clientX - state.startX
      const absDx = Math.abs(rawDx)
      const target = getSwipeTarget(state.direction)
      const threshold = Math.min(110, Math.max(62, state.width * 0.22))
      const isFastEnough = Math.abs(state.velocityX) > 0.48 && absDx > 38

      if (target && (absDx >= threshold || isFastEnough)) {
        emit('swipe-verse', state.direction)
        resetPracticeSwipe()
        nextTick(() => focusInput())
        return
      }

      settlePracticeSwipeBack()
    }

    const isPracticeSwipeDragging = computed(() => practiceSwipe.value.dragging && !practiceSwipe.value.settling)
    const isPracticeSwipeSettling = computed(() => practiceSwipe.value.settling)
    const practiceSwipeProgress = computed(() => clamp(Math.abs(practiceSwipe.value.dx) / practiceSwipe.value.width, 0, 1))
    const practiceSwipeCurrentStyle = computed(() => {
      const state = practiceSwipe.value
      if (!state.dragging && !state.settling) return null

      const progress = practiceSwipeProgress.value
      const scale = state.canNavigate ? 1 - progress * 0.018 : 1 - progress * 0.006
      const shadowDirection = state.dx < 0 ? -1 : 1

      return {
        transform: `translate3d(${state.dx}px, 0, 0) scale(${scale})`,
        boxShadow: `${shadowDirection * -18}px 0 38px rgba(20, 35, 58, ${0.08 + progress * 0.08})`
      }
    })

    const practiceSwipePreview = computed(() => {
      const state = practiceSwipe.value
      if (!state.dragging || !state.direction) return null

      const target = getSwipeTarget(state.direction)
      const edge = state.direction === 'next' ? 'right' : 'left'
      if (target) {
        return {
          edge,
          canNavigate: true,
          reference: target.reference || 'Next verse',
          content: target.content ? target.content.slice(0, 132) : ''
        }
      }

      return {
        edge,
        canNavigate: false,
        reference: state.direction === 'next' ? 'End of list' : 'Start of list',
        content: props.verse?.reference || ''
      }
    })

    const practiceSwipePreviewStyle = computed(() => {
      const state = practiceSwipe.value
      if (!practiceSwipePreview.value) return null

      const progress = practiceSwipeProgress.value
      if (!state.canNavigate) {
        return {
          opacity: String(clamp(progress * 1.5, 0, 0.92))
        }
      }

      const sign = state.direction === 'next' ? 1 : -1
      const offset = sign * Math.max(0, state.width - Math.abs(state.dx) * 1.04)
      return {
        opacity: String(clamp(0.34 + progress * 0.82, 0, 1)),
        transform: `translate3d(${offset}px, 0, 0)`
      }
    })

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

    onBeforeUnmount(() => {
      clearPracticeSwipeResetTimer()
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
      onPracticeTouchStart,
      onPracticeTouchMove,
      onPracticeTouchEnd,
      resetPracticeSwipe,
      isPracticeSwipeDragging,
      isPracticeSwipeSettling,
      practiceSwipeCurrentStyle,
      practiceSwipePreview,
      practiceSwipePreviewStyle,
      shouldRenderReferenceSegments,
      getReferenceSegments,
      getReferenceSegmentClass
    }
  }
}
</script>

<style scoped>
.practice-swipe-frame {
  position: relative;
  touch-action: pan-y;
}

.practice-swipe-current {
  position: relative;
  z-index: 1;
  transform-origin: center center;
  will-change: transform;
}

.practice-swipe-current--dragging {
  transition: none;
}

.practice-swipe-current--settling {
  transition:
    transform 260ms cubic-bezier(0.2, 0.85, 0.25, 1),
    box-shadow 260ms ease;
}

.practice-swipe-peek {
  position: absolute;
  inset: 0;
  z-index: 0;
  display: flex;
  align-items: center;
  padding: 1rem 1.2rem 5.5rem;
  pointer-events: none;
  will-change: transform, opacity;
}

.practice-swipe-peek--right {
  justify-content: flex-end;
  text-align: right;
}

.practice-swipe-peek--left {
  justify-content: flex-start;
  text-align: left;
}

.practice-swipe-peek__panel {
  width: min(78vw, 24rem);
  border: 1px solid var(--color-border-default);
  border-radius: 1rem;
  background:
    linear-gradient(180deg, rgba(var(--color-bg-chrome-rgb), 0.96), rgba(var(--color-bg-chrome-rgb), 0.84));
  box-shadow: 0 18px 45px rgba(20, 35, 58, 0.14);
  padding: 1rem;
}

.dark .practice-swipe-peek__panel {
  box-shadow: 0 18px 45px rgba(0, 0, 0, 0.34);
}

.practice-swipe-peek--edge .practice-swipe-peek__panel {
  width: auto;
  max-width: min(68vw, 18rem);
  opacity: 0.72;
}

.practice-swipe-peek__reference {
  margin: 0;
  color: var(--color-text-primary);
  font-family: var(--font-serif);
  font-size: 1.25rem;
  line-height: 1.15;
  letter-spacing: 0;
}

.practice-swipe-peek__content {
  margin: 0.55rem 0 0;
  color: var(--color-text-secondary);
  font-family: var(--font-serif);
  font-size: 0.95rem;
  font-style: italic;
  line-height: 1.45;
}

@media (prefers-reduced-motion: reduce) {
  .practice-swipe-current,
  .practice-swipe-peek {
    transition-duration: 0ms !important;
  }
}
</style>
