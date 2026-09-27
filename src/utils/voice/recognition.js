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
export function createRecognitionAdapter({ onStatus, onResult, onError, scope = globalThis }) {
  let recognition = null, generation = 0, timer = null, finishing = false
  function abort(status = 'paused') {
    generation++
    finishing = false
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
    const finals = new Map()
    let failed = false
    let instance
    try {
      instance = new Constructor()
      recognition = instance
      instance.continuous = true
      instance.interimResults = true
      instance.maxAlternatives = 3
      instance.lang = (scope.navigator?.languages || [scope.navigator?.language]).find(locale => /^en(?:-|$)/i.test(locale || '')) || 'en-US'
      const active = () => generation === id && recognition === instance
      instance.onstart = () => { if (active() && !finishing) { clearTimeout(timer); onStatus('listening') } }
      instance.onresult = event => {
        if (!active() || failed) return
        const fresh = [], interim = []
        // Results is the complete revisable list. Rebuild previews, including deletions.
        for (let index = 0; index < event.results.length; index++) {
          const result = event.results[index]
          const alternatives = Array.from({ length: Math.min(result.length, 3) }, (_, i) => result[i].transcript)
          if (result.isFinal) {
            if (finals.has(index)) {
              if (finals.get(index) !== JSON.stringify(alternatives)) {
                abort()
                onError('The speech service reset its results. Tap Resume to continue.')
                return
              }
            } else {
              finals.set(index, JSON.stringify(alternatives))
              fresh.push({ index, alternatives })
            }
          } else interim.push({ index, alternatives })
        }
        onResult({ finals: fresh, interim, sessionId: id, resultIndex: event.resultIndex })
      }
      instance.onerror = event => {
        if (!active()) return
        failed = true
        const message = recognitionErrors[event.error] || 'Speech recognition failed. Tap Retry or use the keyboard.'
        abort(event.error === 'no-speech' ? 'paused' : 'error')
        onError(message, event.error)
      }
      instance.onend = () => {
        if (!active()) return
        clearTimeout(timer)
        recognition = null
        generation++
        if (!failed) onStatus('paused')
      }
      onStatus('starting')
      instance.start()
      timer = setTimeout(() => { if (active()) { abort('error'); onError('The microphone did not start. Tap Retry or use the keyboard.') } }, 10000)
    } catch {
      abort('error')
      onError('Speech recognition could not start. Tap Retry or use the keyboard.')
    }
  }
  function stop() {
    if (!recognition) return
    finishing = true
    onStatus('finishing')
    clearTimeout(timer)
    const id = generation
    timer = setTimeout(() => { if (id === generation) abort() }, 1500)
    try { recognition.stop() } catch { abort() }
  }
  return { start, stop, abort }
}
