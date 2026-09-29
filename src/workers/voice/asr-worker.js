// Dedicated Worker that owns the sherpa-onnx recognizer.
//
// Decoding a Zipformer transducer is far too heavy for the UI thread, and the
// whole point of this design is that nothing about a recitation touches the main
// thread except a short message. This is a classic (not module) worker because
// the emscripten glue defines globals through importScripts.
//
// Cache Storage is reachable from a dedicated worker, so the ~190 MB preload
// payload is read and held here. Keeping that allocation off the main thread
// matters on the phones this feature targets.
//
// The glue contract, established against the pinned v1.13.7 build:
//   * Module.locateFile resolves the .wasm and the preload file.
//   * Module.getPreloadedPackage is called *synchronously* to obtain the
//     preload ArrayBuffer, so the read must complete before importScripts.
//   * OnlineRecognizer has no setConfig, so the entire config must be passed to
//     createOnlineRecognizer(). The model paths are virtual files baked into the
//     preload, not separate network files.
//   * An endpoint means "this segment is done": reset the stream and keep
//     decoding the same microphone feed.

const RUNTIME_SCRIPT = 'sherpa-onnx-wasm-main-asr.js'
const API_SCRIPT = 'sherpa-onnx-asr.js'
const WASM_FILE = 'sherpa-onnx-wasm-main-asr.wasm'
const SAMPLE_RATE = 16000
const LOAD_TIMEOUT_MS = 180000

// Tuned so a 1-3 second natural pause ends a segment while the microphone keeps
// running. The upstream defaults (2.4s / 1.2s) are tuned for dictation, not for
// reading a verse aloud in a quiet room.
const ENDPOINT_CONFIG = Object.freeze({
  rule1MinTrailingSilence: 1.0,
  rule2MinTrailingSilence: 0.6,
  rule3MinUtteranceLength: 15,
})

let recognizer = null
let stream = null
let disposed = false
let loading = null

// Every reply carries a session id so a late message can never touch a newer
// attempt, and a sequence number so reordering is detectable.
let activeSession = 0
let sequence = 0

// Diagnostics only: timings and counters. No words, no audio, ever.
const stats = { decodeMs: 0, audioSamples: 0, backlog: 0, segments: 0, lastDecodeMs: 0 }

function post(type, payload = {}) {
  self.postMessage({ type, sessionId: activeSession, sequence: ++sequence, ...payload })
}

function reportStats() {
  post('stats', { stats: { ...stats, audioSeconds: Math.round(stats.audioSamples / SAMPLE_RATE) } })
}

function baseConfig() {
  return {
    featConfig: { sampleRate: SAMPLE_RATE, featureDim: 80 },
    // These names are the virtual files inside the emscripten preload, not URLs.
    modelConfig: {
      transducer: { encoder: './encoder.onnx', decoder: './decoder.onnx', joiner: './joiner.onnx' },
      paraformer: { encoder: './encoder.onnx', decoder: './decoder.onnx' },
      zipformer2Ctc: { model: './encoder.onnx' },
      nemoCtc: { model: './nemo-ctc.onnx' },
      toneCtc: { model: './tone-ctc.onnx' },
      tokens: './tokens.txt',
      numThreads: 1,
      provider: 'cpu',
      debug: 0,
      modelType: '',
      modelingUnit: 'cjkchar',
      bpeVocab: '',
    },
    decodingMethod: 'greedy_search',
    maxActivePaths: 4,
    enableEndpoint: 1,
    ...ENDPOINT_CONFIG,
    hotwordsFile: '',
    hotwordsScore: 1.5,
    ctcFstDecoderConfig: { graph: '', maxActive: 3000 },
    ruleFsts: '',
    ruleFars: '',
  }
}

async function loadModel(context) {
  const started = Date.now()
  const cache = await caches.open(context.cacheName)
  async function cached(file) {
    const response = await cache.match(`${context.baseUrl}/${file}`)
    if (!response) throw new Error(`The voice model is missing ${file}. Download it again.`)
    return response
  }
  const preload = await (await cached('sherpa-onnx-wasm-main-asr.data')).arrayBuffer()
  // Emscripten normally fetches its glue and Wasm from the network. Object
  // URLs made from the pinned cache are required for a truly offline start.
  const urls = await Promise.all([RUNTIME_SCRIPT, API_SCRIPT, WASM_FILE].map(async file =>
    URL.createObjectURL(await (await cached(file)).blob())))

  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('The voice model timed out while starting.')), LOAD_TIMEOUT_MS)
      self.Module = {
        locateFile: path => path.endsWith('.wasm') ? urls[2] : `${context.baseUrl}/${path}`,
        // Synchronous by contract: hand over the buffer we already read.
        getPreloadedPackage: () => preload,
        print: () => {},
        printErr: () => {},
        onRuntimeInitialized: () => {
          clearTimeout(timer)
          resolve()
        },
      }
      try {
        importScripts(urls[0], urls[1])
      } catch (error) {
        clearTimeout(timer)
        reject(error)
      }
    })
  } finally {
    urls.forEach(url => URL.revokeObjectURL(url))
  }

  if (disposed) return
  recognizer = createOnlineRecognizer(self.Module, baseConfig())
  post('ready', { loadMs: Date.now() - started, preloadBytes: preload.byteLength })
}

function ensureStream() {
  if (!stream) stream = recognizer.createStream()
  return stream
}

// Drain every frame the recognizer is ready to accept, then read the current
// hypothesis. An endpoint finalises the segment and resets the stream; capture
// on the main thread is untouched.
function pump({ final = false } = {}) {
  const active = ensureStream()
  const started = performance.now()
  let decoded = 0
  while (recognizer.isReady(active)) {
    recognizer.decode(active)
    decoded++
  }
  const elapsed = performance.now() - started
  stats.decodeMs += elapsed
  stats.lastDecodeMs = elapsed
  stats.backlog = Math.max(0, stats.backlog - decoded)

  const result = recognizer.getResult(active)
  const text = (result.text || '').trim()
  const endpointed = !final && recognizer.isEndpoint(active)
  if (endpointed) stats.segments++
  return { text, endpointed, decoded }
}

function resetStream() {
  if (recognizer && stream) recognizer.reset(stream)
  stats.backlog = 0
}

function dropStream() {
  if (stream) {
    stream.free()
    stream = null
  }
  stats.backlog = 0
}

const handlers = {
  init(context) {
    if (loading || disposed) return loading
    loading = loadModel(context).then(() => { loading = null }).catch(error => {
      loading = null
      post('error', { code: 'model-load-failed', message: String(error?.message || error) })
    })
    return loading
  },

  start(message) {
    activeSession = message.sessionId
    stats.decodeMs = 0
    stats.audioSamples = 0
    stats.backlog = 0
    stats.segments = 0
    // Drop anything the previous attempt left half decoded.
    dropStream()
    post('listening')
  },

  audio(message) {
    if (!recognizer || message.sessionId !== activeSession) return
    stats.audioSamples += message.samples.length
    const active = ensureStream()
    active.acceptWaveform(SAMPLE_RATE, message.samples)
    const result = pump()
    if (result.endpointed) {
      if (result.text) post('final', { text: result.text })
      resetStream()
    } else if (result.text && result.text !== message.last) {
      // Only report a changed hypothesis, so a long tail of silence does not
      // spam the main thread with identical strings.
      post('partial', { text: result.text })
    }
    reportStats()
  },

  // Pause and a deliberate Finish both stop the microphone on the main thread.
  // Here we only settle what is already decoded, then clear the segment stream so
  // an old hypothesis cannot resurface on Resume.
  flush(message) {
    if (!recognizer || message.sessionId !== activeSession) return
    const result = pump({ final: true })
    if (result.text) post('final', { text: result.text, reason: message.reason })
    dropStream()
    reportStats()
    post('flushed')
  },

  reset(message) {
    dropStream()
    activeSession = message.sessionId
  },

  dispose() {
    disposed = true
    if (stream) {
      try { stream.free() } catch { /* Already released. */ }
      stream = null
    }
    if (recognizer) {
      try { recognizer.free() } catch { /* Already released. */ }
      recognizer = null
    }
    self.close()
  },
}

self.onmessage = event => {
  const handler = handlers[event.data?.type]
  if (!handler) return
  try {
    const result = handler(event.data)
    if (result?.catch) {
      result.catch(error => post('error', { code: 'worker', message: String(error?.message || error) }))
    }
  } catch (error) {
    post('error', { code: 'worker', message: String(error?.message || error) })
  }
}
