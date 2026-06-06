<template>
  <div
    class="practice-swipe-frame flex-1 flex flex-col overflow-hidden max-w-4xl mx-auto w-full"
    @touchstart.passive="onPracticeTouchStart"
    @touchmove="onPracticeTouchMove"
    @touchend.passive="onPracticeTouchEnd"
    @touchcancel="resetPracticeSwipe"
  >
    <div
      class="practice-swipe-track flex-1 min-h-0"
      :class="{
        'practice-swipe-track--dragging': isPracticeSwipeDragging,
        'practice-swipe-track--settling': isPracticeSwipeSettling
      }"
      :style="practiceSwipeTrackStyle"
    >
      <section
        v-for="panel in practicePanels"
        :key="panel.key"
        class="practice-swipe-panel flex flex-col min-h-0 sm:px-4"
        :class="{ 'practice-swipe-panel--active': panel.isCurrent }"
        :aria-hidden="!panel.isCurrent"
        :inert="!panel.isCurrent ? '' : null"
      >
      <!-- Scrollable verse text -->
      <div
        class="practice-scroll flex-1 min-h-0"
        :class="{
          'practice-scroll--completion': panel.isCurrent && showTray,
          'practice-scroll--passage-feedback': panel.isCurrent && passageSegmentFeedback && !showTray
        }"
      >
        <article
          :ref="panel.isCurrent ? 'scrollContainer' : null"
          class="practice-card pressed-paper fade-in overflow-y-auto"
          @click="panel.isCurrent && focusInput()"
        >
          <div class="practice-card__text">
          <span
            v-for="(word, index) in panel.words"
            :key="index"
            :id="panel.isCurrent ? `practice-word-${index}` : null"
            :class="[
              word.separatorAfter ? 'practice-word inline-block' : 'practice-word inline-block mr-2',
              panel.isCurrent && isCurrentPracticeWord(panel.words, index) ? 'practice-word--current' : ''
            ]"
          >
            <span v-if="panel.mode === 'learn'">
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
            <span v-else-if="panel.mode === 'memorize'">
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
                  <span :class="word.incorrect ? 'text-word-incorrect' : 'text-text-primary'">{{ getPartialWordText(word) }}</span><span class="word-blank text-transparent">{{ getRemainingPartText(word) }}</span><span class="text-word-unrevealed">{{ word.separatorAfter || '' }}</span>
                </template>
              </template>
              <span v-else>
                <span class="word-blank text-transparent">{{ word.text }}</span><span class="text-word-unrevealed">{{ word.separatorAfter || '' }}</span>
              </span>
            </span>
            <span v-else-if="panel.mode === 'master'">
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
                  <span :class="word.incorrect ? 'text-word-incorrect' : (word.isReferenceUnit ? 'text-text-primary' : 'text-text-primary font-semibold')">{{ getPartialWordText(word) }}</span><span class="word-blank text-transparent">{{ getRemainingPartText(word) }}</span><span class="text-word-unrevealed">{{ word.separatorAfter || '' }}</span>
                </template>
              </template>
              <span v-else>
                <span class="word-blank text-transparent">{{ word.text }}</span><span class="text-word-unrevealed">{{ word.separatorAfter || '' }}</span>
              </span>
            </span>
          </span>
          </div>
        </article>
      </div>

    <div v-if="panel.isCurrent && showPracticeModesHint && !showTray && practiceModeHint" class="px-4 pb-1">
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

      <Transition name="passage-feedback">
        <div
          v-if="panel.isCurrent && passageSegmentFeedback"
          class="passage-segment-feedback"
          :class="{ 'passage-segment-feedback--retry': passageSegmentFeedback.belowThreshold }"
          data-testid="passage-segment-feedback"
        >
          <span class="passage-segment-feedback__copy">
            {{ passageSegmentFeedback.reference }} · {{ passageSegmentFeedback.accuracyLabel }}
          </span>
          <button
            v-if="passageSegmentFeedback.belowThreshold"
            type="button"
            class="passage-segment-feedback__action"
            data-testid="passage-segment-retry"
            @click="$emit('retry-passage-segment', passageSegmentFeedback.segmentId)"
          >
            Retry
          </button>
        </div>
      </Transition>

    <!-- Mode buttons: Learn | Memorize | Master -->
    <div v-if="!showTray && (panel.isCurrent || isPracticeSwipeActive)" class="practice-stage-shell flex-shrink-0">
      <div class="practice-stage-rail">
        <div
          v-for="(stage, index) in stages"
          :key="index"
          class="practice-stage-item"
        >
          <div
            @click="panel.isCurrent && onSwitchMode(stage.mode)"
            :class="[
              'mode-chip',
              panel.mode === stage.mode
                ? 'mode-chip--active'
                : isStageComplete(stage)
                ? 'mode-chip--complete'
                : canSwitch(stage.mode)
                ? 'mode-chip--available'
                : 'mode-chip--disabled'
            ]"
            :aria-current="panel.mode === stage.mode ? 'step' : null"
          >
            <span
              :class="[
                'mode-chip__label',
                panel.mode === stage.mode
                  ? 'mode-chip--active'
                  : isStageComplete(stage)
                  ? 'mode-chip--complete'
                  : canSwitch(stage.mode)
                  ? 'mode-chip--available'
                  : 'mode-chip--disabled'
              ]"
            >
              {{ stage.name }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Hidden letter input -->
    <div v-if="panel.isCurrent" class="text-center flex-shrink-0">
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
    </section>
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
    previousVerseWords: { type: Array, default: () => [] },
    nextVerse: { type: Object, default: null },
    nextVerseWords: { type: Array, default: () => [] },
    passageSegmentFeedback: { type: Object, default: null }
  },
  emits: ['update:typedLetter', 'keydown', 'input', 'switch-mode', 'dismiss-practice-modes-hint', 'swipe-verse', 'retry-passage-segment'],
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
    const practiceSwipeSettleMs = 220
    const settlingPracticePanels = ref(null)
    let practiceSwipeResetTimer = null
    let practiceSwipeAnimationFrame = null
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

    function isCurrentPracticeWord(words, index) {
      const currentIndex = words.findIndex((word) => !word.revealed)
      return currentIndex === index
    }

    function scrollToStart(behavior = 'smooth') {
      const scroller = getRefElement(scrollContainer.value)
      if (!scroller) return
      requestAnimationFrame(() => {
        scroller.scrollTo({
          top: 0,
          behavior
        })
      })
    }

    function onSwitchMode(mode) {
      scrollToStart()
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

    function getRefElement(value) {
      return Array.isArray(value) ? value[0] : value
    }

    function focusInput() {
      const input = getRefElement(inputRef.value)
      if (input) {
        input.focus()
      }
    }

    function getViewportWidth() {
      if (typeof window === 'undefined') return 390
      return Math.max(window.innerWidth || 390, 1)
    }

    function getSwipeSurfaceWidth(el) {
      const rect = el?.getBoundingClientRect?.()
      return Math.max(rect?.width || getViewportWidth(), 1)
    }

    function getSwipeTarget(direction) {
      return direction === 'next' ? props.nextVerse : props.previousVerse
    }

    function buildPracticePanels() {
      return [
        {
        key: props.previousVerse?.id || 'previous-edge',
        direction: 'previous',
        verse: props.previousVerse,
        words: props.previousVerseWords,
        mode: props.memorizationMode,
        isCurrent: false
        },
        {
        key: props.verse?.id || 'current',
        direction: 'current',
        verse: props.verse,
        words: props.reviewWords,
        mode: props.memorizationMode,
        isCurrent: true
        },
        {
        key: props.nextVerse?.id || 'next-edge',
        direction: 'next',
        verse: props.nextVerse,
        words: props.nextVerseWords,
        mode: props.memorizationMode,
        isCurrent: false
        }
      ]
    }

    const practicePanels = computed(() => settlingPracticePanels.value || buildPracticePanels())

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

    function clearPracticeSwipeAnimationFrame() {
      if (practiceSwipeAnimationFrame && typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(practiceSwipeAnimationFrame)
      }
      practiceSwipeAnimationFrame = null
    }

    function resetPracticeSwipe() {
      clearPracticeSwipeResetTimer()
      clearPracticeSwipeAnimationFrame()
      settlingPracticePanels.value = null
      practiceSwipe.value = createEmptyPracticeSwipe()
    }

    function setPracticeSwipe(nextState) {
      practiceSwipe.value = {
        ...practiceSwipe.value,
        ...nextState
      }
    }

    function settlePracticeSwipeBack() {
      settlePracticeSwipeTo(0)
    }

    function settlePracticeSwipeTo(targetDx, afterSettle) {
      clearPracticeSwipeResetTimer()
      clearPracticeSwipeAnimationFrame()
      setPracticeSwipe({ settling: true, dragging: false })

      const finishFrame = () => {
        practiceSwipeAnimationFrame = null
        setPracticeSwipe({ dx: targetDx, rawDx: targetDx })
      }

      if (typeof requestAnimationFrame === 'undefined') {
        finishFrame()
      } else {
        practiceSwipeAnimationFrame = requestAnimationFrame(finishFrame)
      }

      practiceSwipeResetTimer = setTimeout(() => {
        afterSettle?.()
        resetPracticeSwipe()
      }, practiceSwipeSettleMs)
    }

    function onPracticeTouchStart(e) {
      if (e.touches.length !== 1) {
        resetPracticeSwipe()
        return
      }

      const touch = e.touches[0]
      clearPracticeSwipeResetTimer()
      clearPracticeSwipeAnimationFrame()
      practiceSwipe.value = {
        ...createEmptyPracticeSwipe(),
        started: true,
        startX: touch.clientX,
        startY: touch.clientY,
        lastX: touch.clientX,
        lastTime: typeof performance !== 'undefined' ? performance.now() : Date.now(),
        width: getSwipeSurfaceWidth(e.currentTarget)
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
        const targetDx = state.direction === 'next' ? -state.width : state.width
        settlingPracticePanels.value = buildPracticePanels()
        emit('swipe-verse', state.direction)
        settlePracticeSwipeTo(targetDx, () => {
          nextTick(() => focusInput())
        })
        return
      }

      settlePracticeSwipeBack()
    }

    const isPracticeSwipeDragging = computed(() => practiceSwipe.value.dragging && !practiceSwipe.value.settling)
    const isPracticeSwipeSettling = computed(() => practiceSwipe.value.settling)
    const isPracticeSwipeActive = computed(() => isPracticeSwipeDragging.value || isPracticeSwipeSettling.value)
    const practiceSwipeTrackStyle = computed(() => {
      const state = practiceSwipe.value
      const dx = state.dragging || state.settling ? state.dx : 0
      return {
        transform: `translate3d(calc(-100% + ${dx}px), 0, 0)`
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

      return 'word-blank text-transparent'
    }

    onMounted(() => {
      nextTick(() => {
        setTimeout(() => focusInput(), 100)
      })
    })

    onBeforeUnmount(() => {
      clearPracticeSwipeResetTimer()
      clearPracticeSwipeAnimationFrame()
    })

    function scrollToEnd() {
      const scroller = getRefElement(scrollContainer.value)
      if (!scroller) return
      requestAnimationFrame(() => {
        scroller.scrollTo({
          top: Math.max(0, scroller.scrollHeight - scroller.clientHeight),
          behavior: 'smooth'
        })
      })
    }

    function scrollToWordIndex(index, behavior = 'smooth') {
      const scroller = getRefElement(scrollContainer.value)
      if (!scroller) return
      requestAnimationFrame(() => {
        const wordEl = scroller.querySelector(`#practice-word-${index}`)
        if (!wordEl) return
        const containerRect = scroller.getBoundingClientRect()
        const wordRect = wordEl.getBoundingClientRect()
        scroller.scrollTo({
          top: Math.max(0, wordRect.top - containerRect.top + scroller.scrollTop - 24),
          behavior
        })
      })
    }

    expose({
      inputRef,
      scrollContainer,
      focusInput,
      scrollToStart,
      scrollToEnd,
      scrollToWordIndex
    })

    return {
      stages,
      practiceModeHint,
      practicePanels,
      inputRef,
      scrollContainer,
      isStageComplete,
      canSwitch,
      isCurrentPracticeWord,
      onSwitchMode,
      onInput,
      onKeydown,
      focusInput,
      scrollToStart,
      onPracticeTouchStart,
      onPracticeTouchMove,
      onPracticeTouchEnd,
      resetPracticeSwipe,
      isPracticeSwipeDragging,
      isPracticeSwipeSettling,
      isPracticeSwipeActive,
      practiceSwipeTrackStyle,
      shouldRenderReferenceSegments,
      getReferenceSegments,
      getReferenceSegmentClass
    }
  }
}
</script>

<style scoped>
.practice-scroll {
  display: flex;
  padding: 0.75rem 1rem 0.5rem;
  transition:
    transform 260ms cubic-bezier(0.2, 0.78, 0.2, 1),
    padding-bottom 260ms cubic-bezier(0.2, 0.78, 0.2, 1);
  will-change: transform;
}

.practice-scroll--completion {
  padding-bottom: 1.25rem;
}

.practice-scroll--passage-feedback {
  transform: translateY(-0.2rem);
}

.practice-card {
  display: flex;
  width: 100%;
  max-width: 42rem;
  max-height: 100%;
  min-height: min(clamp(15rem, 44vh, 24rem), 100%);
  flex-direction: column;
  margin-inline: auto;
  overflow-y: auto;
  border-radius: var(--radius-xl);
  padding: clamp(1.25rem, 4vw, 2rem) clamp(1rem, 4vw, 2rem);
}

.practice-card__text {
  position: relative;
  z-index: 1;
}

.practice-card__text {
  font-family: var(--font-serif);
  font-size: 1.25rem;
  line-height: 1.65;
  letter-spacing: 0;
  color: var(--color-text-primary);
}

.practice-word {
  position: relative;
}

.practice-stage-shell {
  padding: 0.3rem 1rem 0.95rem;
}

.passage-segment-feedback {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.35rem 0.65rem;
  width: min(100%, 42rem);
  max-height: 3rem;
  margin: 0 auto 0.45rem;
  overflow: hidden;
  color: var(--color-text-secondary);
  font-size: 0.8rem;
  line-height: 1.35;
  text-align: center;
}

.passage-feedback-enter-active,
.passage-feedback-leave-active {
  transition:
    max-height 260ms cubic-bezier(0.2, 0.78, 0.2, 1),
    margin-bottom 260ms cubic-bezier(0.2, 0.78, 0.2, 1),
    opacity 180ms ease,
    transform 260ms cubic-bezier(0.2, 0.78, 0.2, 1);
}

.passage-feedback-enter-from,
.passage-feedback-leave-to {
  max-height: 0;
  margin-bottom: 0;
  opacity: 0;
  transform: translateY(0.35rem);
}

.passage-segment-feedback--retry {
  color: var(--color-status-amber-text);
}

.passage-segment-feedback__copy {
  font-weight: 600;
}

.passage-segment-feedback__action {
  color: var(--color-accent-warm-text);
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 0.18em;
}

.practice-stage-rail {
  display: flex;
  align-items: center;
  justify-content: space-around;
  width: 100%;
  max-width: 42rem;
  margin: 0 auto;
  padding: 0;
}

.practice-stage-item {
  position: relative;
  display: flex;
  align-items: center;
  flex: 0 0 auto;
}

.practice-swipe-frame {
  position: relative;
  touch-action: pan-y;
}

.practice-swipe-track {
  display: flex;
  width: 100%;
  position: relative;
  z-index: 1;
  will-change: transform;
  transform: translate3d(-100%, 0, 0);
}

.practice-swipe-track--dragging {
  transition: none;
}

.practice-swipe-track--settling {
  transition: transform 220ms cubic-bezier(0.18, 0.88, 0.24, 1);
}

.practice-swipe-panel {
  flex: 0 0 100%;
  width: 100%;
  overflow: hidden;
  padding-inline: 0;
}

.practice-swipe-panel:not(.practice-swipe-panel--active) {
  pointer-events: none;
}

.practice-swipe-track .fade-in {
  animation: none;
}

@media (max-width: 420px) {
  .practice-scroll {
    padding-inline: 0.85rem;
  }

  .practice-card {
    min-height: min(clamp(14rem, 42vh, 22rem), 100%);
    padding-inline: 1rem;
  }

  .practice-card__text {
    font-size: 1.25rem;
    line-height: 1.65;
  }

  .practice-stage-rail {
    padding-inline: 0;
  }
}

@media (max-height: 720px) {
  .practice-scroll {
    padding-top: 0.65rem;
  }

  .practice-card {
    min-height: min(13rem, 100%);
    padding-block: 1.15rem;
  }

  .practice-stage-shell {
    padding-bottom: 0.55rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .practice-swipe-track {
    transition-duration: 0ms !important;
  }

  .practice-scroll,
  .passage-feedback-enter-active,
  .passage-feedback-leave-active {
    transition-duration: 0ms !important;
  }

  .practice-scroll--passage-feedback {
    transform: none;
  }
}
</style>
