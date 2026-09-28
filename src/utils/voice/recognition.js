export const recognitionErrors = {
  'not-allowed': 'Microphone permission was denied. Allow it in browser settings, then tap Retry, or use the keyboard.',
  'service-not-allowed': 'Your browser does not allow its speech service here. Try browser settings or use the keyboard.',
  'audio-capture': 'No microphone is available. Check your microphone, then tap Retry.',
  network: 'Your browser could not reach its speech service. Check your connection, try Google Chrome, or use the keyboard.',
  'no-speech': 'No speech was detected. Tap Resume when you are ready.',
  'language-not-supported': 'English recognition is unavailable in this browser. Try another English device language or use the keyboard.',
  aborted: 'Listening paused. Tap Resume when you are ready.',
}
export function recognitionConstructor(scope = globalThis) {
  return scope.SpeechRecognition || scope.webkitSpeechRecognition || null
}

function transcriptWords(text) {
  return [...text.toLowerCase().replace(/[’‘]/g, "'").matchAll(/[a-z0-9']+/g)]
    .map(match => ({ text: match[0], end: match.index + match[0].length }))
}

function cumulativeSuffix(text, previousAlternatives) {
  const words = transcriptWords(text)
  let matched = 0
  for (const previous of previousAlternatives) {
    const prefix = transcriptWords(previous)
    if (prefix.length <= matched || prefix.length > words.length) continue
    if (prefix.every((word, index) => word.text === words[index].text)) matched = prefix.length
  }
  return {
    matched,
    extended: words.length > matched,
    text: matched ? text.slice(words[matched - 1].end).trim() : text,
  }
}

export function createRecognitionAdapter({ onStatus, onResult, onError, scope = globalThis }) {
  let recognition = null, generation = 0, timer = null, finishing = false
  let microphoneReady = false, microphoneRequest = null
  let listeningRequested = false, rapidEndCount = 0
  function abort(status = 'paused') {
    generation++
    finishing = false
    listeningRequested = false
    clearTimeout(timer)
    const previous = recognition
    recognition = null
    if (previous) { try { previous.abort() } catch { /* Already ended. */ } }
    onStatus(status)
  }
  function start() {
    abort('idle')
    const Constructor = recognitionConstructor(scope)
    if (!Constructor) { onError('Speech recognition is unavailable. Use the keyboard.'); return }
    const id = generation
    listeningRequested = true
    rapidEndCount = 0
    onStatus('starting')
    const getUserMedia = scope.navigator?.mediaDevices?.getUserMedia?.bind(scope.navigator.mediaDevices)
    if (!getUserMedia || microphoneReady) { startRecognition(Constructor, id); return }
    if (!microphoneRequest) {
      // In a TWA, request the browser's site permission before starting speech recognition.
      let request
      try { request = getUserMedia({ audio: true }) } catch (error) { request = Promise.reject(error) }
      microphoneRequest = Promise.resolve(request).then(stream => {
        stream.getTracks().forEach(track => track.stop())
        microphoneReady = true
      }).finally(() => { microphoneRequest = null })
    }
    microphoneRequest.then(
      () => { if (generation === id) startRecognition(Constructor, id) },
      error => {
        if (generation !== id) return
        abort('error')
        const code = ['NotAllowedError', 'PermissionDeniedError', 'SecurityError'].includes(error?.name)
          ? 'not-allowed' : ['NotFoundError', 'DevicesNotFoundError', 'NotReadableError'].includes(error?.name)
            ? 'audio-capture' : null
        onError(recognitionErrors[code] || 'The microphone could not start. Tap Retry or use the keyboard.', code)
      },
    )
  }
  function startRecognition(Constructor, id) {
    const finals = new Map()
    let failed = false
    let startedAt = 0
    let cumulativeEvidence = 0, cumulativeResults = false
    let instance
    try {
      instance = new Constructor()
      recognition = instance
      instance.continuous = true
      instance.interimResults = true
      instance.maxAlternatives = 3
      instance.lang = (scope.navigator?.languages || [scope.navigator?.language]).find(locale => /^en(?:-|$)/i.test(locale || '')) || 'en-US'
      const active = () => generation === id && recognition === instance
      instance.onstart = () => { if (active() && !finishing) { startedAt = Date.now(); clearTimeout(timer); onStatus('listening') } }
      instance.onresult = event => {
        if (!active() || failed) return
        rapidEndCount = 0
        const fresh = [], interim = []
        // Results is the complete revisable list. Rebuild previews, including deletions.
        for (let index = 0; index < event.results.length; index++) {
          const result = event.results[index]
          const alternatives = Array.from({ length: Math.min(result.length, 3) }, (_, i) => result[i].transcript)
          if (result.isFinal && finals.has(index)) {
            if (finals.get(index) !== JSON.stringify(alternatives)) {
              abort()
              onError('The speech service reset its results. Tap Resume to continue.')
              return
            }
            continue
          }
          const previous = index > 0 && event.results[index - 1].isFinal
            ? Array.from({ length: Math.min(event.results[index - 1].length, 3) }, (_, i) => event.results[index - 1][i].transcript)
            : []
          if (result.isFinal) {
            finals.set(index, JSON.stringify(alternatives))
            if (previous.length && alternatives.length) {
              // Brave on Android can append growing transcripts as separate final results.
              // Confirm the pattern twice before removing words already delivered.
              const first = cumulativeSuffix(alternatives[0], previous)
              if (first.matched && first.extended) cumulativeEvidence++
              else if (!first.matched && transcriptWords(alternatives[0]).length) cumulativeEvidence = 0
              if (cumulativeEvidence >= 2) cumulativeResults = true
            }
            const spoken = cumulativeResults && previous.length
              ? alternatives.map(text => cumulativeSuffix(text, previous).text)
              : alternatives
            if (spoken.some(text => text.trim())) fresh.push({ index, alternatives: spoken })
          } else interim.push({
            index,
            alternatives: cumulativeResults && previous.length
              ? alternatives.map(text => cumulativeSuffix(text, previous).text)
              : alternatives,
          })
        }
        onResult({ finals: fresh, interim, sessionId: id, resultIndex: event.resultIndex })
      }
      instance.onerror = event => {
        if (!active()) return
        failed = true
        if (event.error === 'not-allowed') microphoneReady = false
        const message = recognitionErrors[event.error] || 'Speech recognition failed. Tap Retry or use the keyboard.'
        abort(event.error === 'no-speech' ? 'paused' : 'error')
        onError(message, event.error)
      }
      instance.onend = () => {
        if (!active()) return
        clearTimeout(timer)
        recognition = null
        generation++
        if (failed) return
        if (finishing || !listeningRequested) {
          finishing = false
          listeningRequested = false
          onStatus('paused')
          return
        }
        rapidEndCount = !startedAt || Date.now() - startedAt < 1500 ? rapidEndCount + 1 : 0
        if (rapidEndCount >= 3) {
          listeningRequested = false
          onStatus('paused')
          onError('The speech service stopped repeatedly. Tap Resume to try again.')
          return
        }
        onStatus('starting')
        const nextId = generation
        timer = setTimeout(() => { if (generation === nextId && listeningRequested) startRecognition(Constructor, nextId) }, 250)
      }
      instance.start()
      timer = setTimeout(() => { if (active()) { abort('error'); onError('The microphone did not start. Tap Retry or use the keyboard.') } }, 10000)
    } catch {
      abort('error')
      onError('Speech recognition could not start. Tap Retry or use the keyboard.')
    }
  }
  function stop() {
    if (!recognition) {
      if (listeningRequested) abort()
      return
    }
    finishing = true
    listeningRequested = false
    onStatus('finishing')
    clearTimeout(timer)
    const id = generation
    timer = setTimeout(() => { if (id === generation) abort() }, 1500)
    try { recognition.stop() } catch { abort() }
  }
  return { start, stop, abort }
}
