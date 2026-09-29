// Microphone capture for local recognition.
//
// The browser owns the microphone from Start until the user taps Pause or Finish,
// navigates away, or finishes the passage. Nothing here keeps the mic open
// longer than it must, and every exit path stops the tracks.

// `?no-inline` matters: Vite would otherwise fold this small file into a
// data: URL, and Firefox and Safari reject a data: URL for audioWorklet.
import workletUrl from '../../workers/voice/pcm-capture.worklet.js?url&no-inline'
import { VOICE_MODEL_SAMPLE_RATE } from './model-manifest.js'

export const audioCaptureErrors = {
  'not-allowed': 'Microphone permission was denied. Allow it in browser settings, then tap Retry, or use the keyboard.',
  'service-not-allowed': 'This browser will not let the app use the microphone here. Use the keyboard instead.',
  'audio-capture': 'No microphone is available. Check your microphone, then tap Retry.',
  insecure: 'The microphone needs a secure (HTTPS) connection.',
  // A worklet that will not load is an app-version problem, not a browser
  // problem, and telling the user to reload is the actual fix.
  'worklet-load-failed': 'The audio capture component could not be loaded. Reload the app to get the latest version, or use the keyboard.',
  unsupported: 'This browser cannot capture audio for voice practice.',
}

function captureErrorCode(error) {
  if (['NotAllowedError', 'PermissionDeniedError', 'SecurityError'].includes(error?.name)) return 'not-allowed'
  if (['NotFoundError', 'DevicesNotFoundError', 'NotReadableError', 'AbortError', 'OverconstrainedError'].includes(error?.name)) return 'audio-capture'
  return null
}

// The user-facing "this browser cannot capture audio" message is the same for a
// dozen different underlying faults, which makes it undiagnosable in the field.
// Log the real cause so a bug report carries the actual error.
function logCaptureFault(stage, error) {
  try {
    console.warn(`[voice] audio capture failed during ${stage}:`, error)
  } catch { /* console is not worth breaking capture over. */ }
}

export function createAudioCapture({ scope = globalThis, onAudio, onError = () => {}, onState = () => {} } = {}) {
  let context = null
  let stream = null
  let source = null
  let node = null
  let loadingWorklet = null
  let workletContext = null
  let generation = 0

  // Each AudioContext needs its own addModule call. Memoizing across contexts
  // leaves a resumed session's context with no registered processor, and the
  // AudioWorkletNode constructor then throws NotSupportedError.
  async function ensureWorklet(audioContext) {
    // Guard the *absence* of audioWorklet, not its presence. Returning early
    // when it exists skips addModule, which leaves the 'pcm-capture' processor
    // unregistered and makes the AudioWorkletNode constructor throw.
    if (!audioContext.audioWorklet) return
    if (workletContext === audioContext && loadingWorklet) return loadingWorklet
    workletContext = audioContext
    loadingWorklet = audioContext.audioWorklet.addModule(workletUrl).catch(error => {
      if (workletContext === audioContext) {
        loadingWorklet = null
        workletContext = null
      }
      error.code = 'worklet-load-failed'
      throw error
    })
    return loadingWorklet
  }
  async function start() {
    const attempt = ++generation
    const media = scope.navigator?.mediaDevices
    if (!media?.getUserMedia) {
      const message = scope.isSecureContext ? audioCaptureErrors.unsupported : audioCaptureErrors.insecure
      logCaptureFault('microphone access', Object.assign(
        new Error('navigator.mediaDevices.getUserMedia is unavailable'),
        { isSecureContext: scope.isSecureContext, hasMediaDevices: !!scope.navigator?.mediaDevices },
      ))
      onError(message, 'unsupported')
      throw new Error(message)
    }

    let acquired
    try {
      acquired = await media.getUserMedia({
        audio: {
          // Speech-band capture. The recognizer resamples to 16 kHz itself, so
          // do not ask the device for a rate it may not honour.
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
    } catch (error) {
      if (attempt !== generation) {
        throw Object.assign(new Error('Microphone start was cancelled.'), { code: 'cancelled' })
      }
      const code = captureErrorCode(error)
      logCaptureFault('getUserMedia', error)
      const message = audioCaptureErrors[code] || 'The microphone could not start. Tap Retry or use the keyboard.'
      onError(message, code)
      throw error
    }

    if (attempt !== generation) {
      for (const track of acquired.getTracks()) track.stop()
      throw Object.assign(new Error('Microphone start was cancelled.'), { code: 'cancelled' })
    }

    stream = acquired
    // The mic is live from here on, so make sure a later failure still releases it.
    try {
      context = new scope.AudioContext({ latencyHint: 'interactive' })
      await ensureWorklet(context)
      if (context.state === 'suspended') await context.resume()
      if (attempt !== generation) {
        throw Object.assign(new Error('Microphone start was cancelled.'), { code: 'cancelled' })
      }
      source = context.createMediaStreamSource(acquired)
      // Capture the rate now. The handler below outlives any single stop(), and
      // reading the mutable `context` there threw once stop() nulled it.
      const sourceRate = context.sampleRate
      node = new scope.AudioWorkletNode(context, 'pcm-capture', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
        processorOptions: { sourceRate },
      })
      const captureNode = node
      node.port.onmessage = event => {
        const data = event.data
        if (data?.type === 'flushed') {
          captureNode._finishFlush?.()
          return
        }
        if (data?.type !== 'audio') return
        onAudio(data.samples, { sourceRate, targetRate: VOICE_MODEL_SAMPLE_RATE })
      }
      // A muted sink keeps the graph pulling without echoing the mic to the
      // speakers. The worklet writes no output samples of its own.
      const sink = context.createGain()
      sink.gain.value = 0
      source.connect(node)
      node.connect(sink)
      sink.connect(context.destination)
      node._sink = sink
    } catch (error) {
      stop()
      if (error?.code === 'cancelled') throw error
      logCaptureFault('audio graph setup', error)
      const code = error?.code === 'worklet-load-failed' ? 'worklet-load-failed' : 'unsupported'
      onError(audioCaptureErrors[code], code)
      throw error
    }

    onState('listening', { sampleRate: context.sampleRate })
    return { sampleRate: context.sampleRate }
  }

  // Stop the microphone immediately. Tracks are released synchronously, before
  // any decoding flush, so a Pause tap is reflected by the hardware right away.
  function stop({ flush = false } = {}) {
    generation++
    const closingNode = node
    const closingSource = source
    const closingContext = context
    const finish = () => {
      try { closingNode?.disconnect() } catch { /* Already disconnected. */ }
      try { closingSource?.disconnect() } catch { /* Already disconnected. */ }
      try { closingNode?._sink?.disconnect() } catch { /* Already disconnected. */ }
      closingContext?.close().catch(() => {})
    }
    for (const track of stream?.getTracks?.() || []) {
      try { track.stop() } catch { /* Already stopped. */ }
    }
    stream = null
    source = null
    node = null
    context = null
    if (!flush || !closingNode) {
      finish()
      return Promise.resolve()
    }
    return new Promise(resolve => {
      const timer = setTimeout(() => { closingNode._finishFlush = null; finish(); resolve() }, 250)
      closingNode._finishFlush = () => { clearTimeout(timer); closingNode._finishFlush = null; finish(); resolve() }
      try { closingNode.port.postMessage({ type: 'flush' }) }
      catch { closingNode._finishFlush() }
    })
  }

  function isCapturing() {
    return !!stream && stream.getTracks().some(track => track.readyState === 'live')
  }

  return { start, stop, isCapturing }
}
