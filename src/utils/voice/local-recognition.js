// Local speech recognition adapter for voice practice.
//
// Replaces the browser SpeechRecognition engine. Explicit operations: prepare,
// start, pause, finish, abort, dispose.
//
// Two rules shape everything here:
//
// 1. Control state reflects *capture*, not what the recognizer guessed. A sherpa
//    endpoint marks a segment boundary and nothing else; silence must never look
//    like a Pause, and a model guess must never close the microphone.
// 2. A loaded model is kept across Pause so Resume is quick, but the microphone
//    tracks are released the instant the user pauses, switches input mode,
//    backgrounds, or leaves.

import { createAudioCapture } from './audio-capture.js'
import { readModelAsset, voiceModelCacheName } from './model-store.js'
import {
  VOICE_MODEL_BASE_PATH,
  VOICE_MODEL_PRELOAD_FILE,
  voiceModelAssetUrl,
} from './model-manifest.js'

export const voiceErrors = {
  'model-missing': 'The voice model is not downloaded yet.',
  'model-load-failed': 'The voice model could not start on this device. Use the keyboard, or try a different browser.',
  'mic-failed': 'The microphone could not start. Tap Retry or use the keyboard.',
  'worker-failed': 'Local speech recognition stopped unexpectedly. Tap Retry or use the keyboard.',
}

// How long a fully loaded model may sit unused before the worker is torn down.
const IDLE_DISPOSE_MS = 5 * 60 * 1000

export function createLocalRecognitionAdapter({
  scope = globalThis,
  onStatus = () => {},
  onPartial = () => {},
  onFinal = () => {},
  onError = () => {},
  onStats = () => {},
} = {}) {
  let worker = null
  let workerReady = null
  let workerLoaded = false
  let capture = null
  let status = 'idle'
  let sessionId = 0
  let lastPartial = ''
  let idleTimer = null
  let disposed = false
  // Guards against a late message from a superseded attempt being applied.
  let activeSession = 0

  function setStatus(next) {
    if (status === next) return
    status = next
    onStatus(next)
  }

  function cancelIdle() {
    clearTimeout(idleTimer)
    idleTimer = null
  }

  function scheduleIdle() {
    cancelIdle()
    if (!worker || disposed) return
    idleTimer = setTimeout(() => { disposeWorker() }, IDLE_DISPOSE_MS)
  }

  function post(message, transfer) {
    if (!worker) return
    worker.postMessage(message, transfer || [])
  }

  function disposeWorker() {
    cancelIdle()
    if (!worker) return
    workerReady?.reject(new Error('Voice recognizer stopped before it was ready.'))
    const previous = worker
    worker = null
    workerReady = null
    workerLoaded = false
    try { previous.postMessage({ type: 'dispose' }) } catch { /* Already gone. */ }
    setTimeout(() => previous.terminate(), 0)
  }

  function handleWorkerMessage(event) {
    const data = event.data || {}
    // Stale traffic from a superseded attempt, a Pause, or a finished verse.
    if (data.sessionId && data.sessionId !== activeSession) return
    if (disposed) return

    switch (data.type) {
      case 'ready':
        workerLoaded = true
        workerReady?.resolve(data)
        workerReady = null
        break
      case 'listening':
        // The decoder acking is not proof of a live microphone: a denied or
        // missing getUserMedia can reject after this arrives. Only let the ack
        // confirm a start that is still in progress, so a failed open settles on
        // 'error' instead of a phantom 'Listening'.
        if (status === 'starting') setStatus('listening')
        break
      case 'partial':
        if (status !== 'listening') return
        if (!data.text || data.text === lastPartial) return
        lastPartial = data.text
        onPartial(data.text)
        break
      case 'final':
        lastPartial = ''
        onFinal(data.text)
        break
      case 'stats':
        onStats(data.stats)
        break
      case 'flushed':
        activeSession = 0
        scheduleIdle()
        break
      case 'error': {
        const message = voiceErrors[data.code] || data.message || voiceErrors['worker-failed']
        workerReady?.reject(new Error(message))
        workerReady = null
        capture?.stop()
        activeSession = 0
        disposeWorker()
        setStatus('error')
        onError(message, data.code)
        break
      }
      default:
        break
    }
  }

  // Load the model into a worker and keep it warm. Resolves once the recognizer
  // exists, so "Available offline" is only ever claimed after a real success.
  function prepare() {
    if (disposed) return Promise.reject(new Error('adapter disposed'))
    if (worker && workerLoaded) return Promise.resolve()
    if (workerReady) return workerReady.promise

    let workerInstance
    try {
      workerInstance = new scope.Worker(new URL('../../workers/voice/asr-worker.js', import.meta.url))
    } catch (error) {
      setStatus('error')
      onError(voiceErrors['model-load-failed'], 'model-load-failed')
      return Promise.reject(error)
    }

    worker = workerInstance
    worker.onmessage = handleWorkerMessage
    worker.onerror = () => {
      if (disposed || worker !== workerInstance) return
      capture?.stop()
      activeSession = 0
      disposeWorker()
      setStatus('error')
      onError(voiceErrors['worker-failed'], 'worker-failed')
    }

    let resolveReady
    let rejectReady
    const promise = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject })
    workerReady = { promise, resolve: resolveReady, reject: rejectReady }

    post({
      type: 'init',
      sessionId: activeSession,
      baseUrl: voiceModelBaseUrl(),
      cacheName: voiceModelCacheName,
      preloadUrl: voiceModelAssetUrl(VOICE_MODEL_PRELOAD_FILE),
    })
    scheduleIdle()
    return promise
  }

  function voiceModelBaseUrl() {
    // Same-origin, versioned. The cache key must match model-store exactly.
    const origin = scope.location?.origin
    return origin ? `${origin}${VOICE_MODEL_BASE_PATH}` : VOICE_MODEL_BASE_PATH
  }

  // Exposed so the capability check can prove the assets are really readable.
  async function verifyModelReadable() {
    await readModelAsset(VOICE_MODEL_PRELOAD_FILE, scope)
  }

  async function start({ nextSession = true } = {}) {
    if (disposed) return
    if (nextSession) {
      sessionId++
      activeSession = sessionId
      lastPartial = ''
    }
    cancelIdle()

    try {
      await prepare()
    } catch {
      return
    }
    cancelIdle()
    if (disposed || activeSession !== sessionId) return

    const captureSession = sessionId
    capture = createAudioCapture({
      scope,
      onAudio: samples => {
        if (disposed || activeSession !== captureSession) return
        post({ type: 'audio', sessionId: captureSession, samples, last: lastPartial }, [samples.buffer])
      },
      onError: (message) => {
        if (activeSession !== captureSession) return
        setStatus('error')
        onError(message)
      },
    })
    const currentCapture = capture

    setStatus('starting')
    post({ type: 'start', sessionId })
    try {
      await currentCapture.start()
      // The worker acks 'listening' once it is actually decoding. A microphone
      // that opened but delivers no PCM must not read as Listening.
      if (activeSession !== captureSession || capture !== currentCapture) {
        currentCapture.stop()
        return
      }
      setStatus('listening')
    } catch (error) {
      currentCapture.stop()
      if (capture === currentCapture) capture = null
      if (activeSession === captureSession && capture === null && error?.code !== 'cancelled') setStatus('error')
    }
  }

  // Pause: the button must respond immediately and the mic must actually stop.
  // Any final segment the worker already decoded still arrives.
  function pause() {
    if (disposed) return
    const previous = activeSession
    setStatus('paused')
    const endingCapture = capture
    capture = null
    endingCapture?.stop({ flush: true }).then(() => {
      if (activeSession === previous && previous) post({ type: 'flush', sessionId: previous, reason: 'pause' })
    })
    lastPartial = ''
  }

  // Finish: respond immediately, then let the worker settle what it has. Any
  // trailing audio in the worklet's batch is flushed first.
  function finish() {
    if (disposed) return
    const previous = activeSession
    // Stop the hardware immediately, but keep accepting this session's final
    // worker message until the trailing worklet batch has been decoded.
    setStatus('paused')
    const endingCapture = capture
    capture = null
    endingCapture?.stop({ flush: true }).then(() => {
      if (activeSession === previous && previous) post({ type: 'flush', sessionId: previous, reason: 'finish' })
    })
    lastPartial = ''
  }

  // Throw the attempt away: stop capture, drop the recognizer's segment stream,
  // and invalidate every in-flight message.
  function abort(status_ = 'paused') {
    if (disposed) return
    activeSession = 0
    sessionId++
    setStatus(status_)
    capture?.stop()
    capture = null
    if (workerReady) disposeWorker()
    post({ type: 'reset', sessionId })
    lastPartial = ''
    scheduleIdle()
  }

  function isCapturing() {
    return !!capture?.isCapturing()
  }

  function dispose() {
    if (disposed) return
    disposed = true
    cancelIdle()
    activeSession = 0
    capture?.stop()
    capture = null
    disposeWorker()
    setStatus('idle')
  }

  function unload() {
    abort('idle')
    disposeWorker()
  }

  return { prepare, verifyModelReadable, start, pause, finish, abort, unload, dispose, isCapturing, get status() { return status } }
}
