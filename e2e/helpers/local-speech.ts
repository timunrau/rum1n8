/**
 * Fake local speech engine for E2E tests.
 *
 * Ruminate recognizes speech on-device with a sherpa-onnx worker, so faking the
 * old `webkitSpeechRecognition` constructor no longer intercepts anything. This
 * helper instead fakes the three seams around the real engine:
 *
 *   - `window.Worker` for the asr-worker URL, speaking the real message protocol
 *     (`init`/`start`/`flush`/`reset` -> `ready`/`listening`/`partial`/`final`).
 *   - `AudioContext`/`AudioWorkletNode` plus a fake microphone, so capture can
 *     be exercised without hardware and the released-track count is observable.
 *   - Cache Storage, so the pinned model reads as already downloaded and no test
 *     ever moves 200 MB.
 *
 * Everything between those seams is real: the adapter, the capture lifecycle, the
 * App session coordination, the attempt ledger, and the matcher. That keeps the
 * tests deterministic without letting real microphone speech into CI.
 */

import type { Page } from '@playwright/test'
import { VOICE_MODEL_ASSETS, VOICE_MODEL_BASE_PATH, voiceModelAssetUrl } from '../../build/voice-model.mjs'
import { voiceModelCacheName } from '../../src/utils/voice/model-store.js'

export interface LocalSpeech {
  /** Number of recognizer workers the app has created. */
  instances: () => Promise<number>
  /** Message counts observed on the worker channel. */
  calls: () => Promise<{ started: number; stopped: number; aborted: number }>
  /** How many fake microphone tracks the app has released. */
  tracksReleased: () => Promise<number>
  /** How many fake microphone tracks are still live. */
  tracksLive: () => Promise<number>
  /** How many times the app asked the microphone for a stream. */
  micRequests: () => Promise<number>
  /** How many AudioContexts the app built, i.e. how far capture got. */
  contextsCreated: () => Promise<number>
  /** Emit a decoded segment. `final: false` is a partial hypothesis. */
  speak: (transcript: string, options?: { final?: boolean }) => Promise<void>
  /** Replace the current hypothesis, modelling the worker revising its output. */
  replace: (results: Array<[string, boolean]>) => Promise<void>
  /** Make the worker report an error code from `voiceErrors`. */
  fail: (code: string) => Promise<void>
}

// Re-exported so specs never hard-code the cache name either.
export { voiceModelCacheName }

interface FakePayload {
  options: FakeOptions
  assets: Array<{ url: string; bytes: number }>
  cacheName: string
}

interface FakeOptions {
  /** Make the fake microphone reject, modelling a denied permission. */
  micDenied?: boolean
  /** Make the fake microphone reject as if no device exists. */
  micMissing?: boolean
  /** Hide a capability so the app must not offer voice at all. */
  disable?: 'worker' | 'audio-worklet' | 'wasm' | 'mic'
  /** Report the pinned model as absent so the download prompt is shown. */
  modelMissing?: boolean
}

const INSTALL_FAKE = ({ options, assets, cacheName }: FakePayload) => {
  const workers: FakeWorker[] = []
  const calls = { started: 0, stopped: 0, aborted: 0 }
  let tracksCreated = 0
  let tracksStopped = 0
  let micRequests = 0
  let contextsCreated = 0

  // ---- microphone ------------------------------------------------------------
  const fakeTrack = () => {
    tracksCreated++
    let live = true
    return {
      get readyState() { return live ? 'live' : 'ended' },
      stop() { if (live) { live = false; tracksStopped++ } },
    }
  }

  if (options.disable === 'mic') {
    // Capability detection only checks that the function exists.
    Reflect.deleteProperty(navigator.mediaDevices, 'getUserMedia')
  } else {
    navigator.mediaDevices.getUserMedia = async () => {
      micRequests++
      if (options.micDenied) throw Object.assign(new Error('denied'), { name: 'NotAllowedError' })
      if (options.micMissing) throw Object.assign(new Error('no device'), { name: 'NotFoundError' })
      // The track exists the moment the stream does. The app holds the stream
      // and only calls getTracks() when it releases it, so counting here is what
      // makes "is the microphone open" observable.
      const track = fakeTrack()
      return { getTracks: () => [track] }
    }
  }

  // ---- audio graph -----------------------------------------------------------
  const endpoint = () => ({ connect() {}, disconnect() {} })

  class FakeAudioWorkletNode {
    port = { onmessage: null as ((event: unknown) => void) | null, postMessage() {} }
    _sink: unknown = null
    constructor(context: { workletModuleLoaded?: boolean }, name: string) {
      // A real AudioWorkletNode only accepts a processor that addModule
      // registered. Without this the fake would happily accept any name and
      // hide a skipped addModule, which is exactly the bug this guards.
      if (!context?.workletModuleLoaded) {
        throw Object.assign(new Error(`Failed to construct 'AudioWorkletNode': AudioWorkletNode cannot be created: the node name '${name}' is not defined`), { name: 'NotSupportedError' })
      }
    }
    connect() {}
    disconnect() {}
  }

  class FakeAudioContext {
    constructor() { contextsCreated++ }
    sampleRate = 48000
    state = 'running'
    destination = endpoint()
    workletModuleLoaded = false
    audioWorklet = { addModule: async () => { this.workletModuleLoaded = true } }
    createMediaStreamSource() { return endpoint() }
    createGain() { return { gain: { value: 1 }, connect() {}, disconnect() {} } }
    resume = async () => undefined
    close = async () => undefined
  }

  Object.defineProperty(window, 'AudioContext', { value: FakeAudioContext, configurable: true })
  if (options.disable !== 'audio-worklet') {
    Object.defineProperty(window, 'AudioWorkletNode', { value: FakeAudioWorkletNode, configurable: true })
  } else {
    Object.defineProperty(window, 'AudioWorkletNode', { value: undefined, configurable: true })
  }

  // ---- model cache -----------------------------------------------------------
  const cache = {
    async match(request: Request | string) {
      if (options.modelMissing) return undefined
      const raw = typeof request === 'string' ? request : request.url
      // The manifest stores site-relative paths while a Request always carries an
      // absolute URL, so compare paths rather than raw strings.
      const path = new URL(raw, location.href).pathname
      const asset = assets.find(entry => new URL(entry.url, location.href).pathname === path)
      if (!asset) return undefined
      // Only the headers matter: the app reads Content-Length to confirm the
      // download completed, and the worker reads the bytes from its own preload.
      return new Response(new Uint8Array(1), { headers: { 'content-length': String(asset.bytes) } })
    },
    async put() { /* nothing is stored in CI */ },
    async delete() { return true },
  }

  Object.defineProperty(window, 'caches', {
    value: {
      async open() { return cache },
      // The cache name must be a literal here: this function is serialized into
      // the page and cannot close over a module constant.
      async keys() { return [cacheName] },
      async delete() { return true },
      async match() { return undefined },
      async has() { return true },
    },
    configurable: true,
  })

  // ---- recognizer worker -----------------------------------------------------
  class FakeWorker {
    onmessage: ((event: { data: unknown }) => void) | null = null
    onerror: ((event: unknown) => void) | null = null
    /** Session of the most recent start/reset, so stale words can be dropped. */
    private sessionId = 0
    private terminated = false

    constructor() { workers.push(this) }

    postMessage(message: Record<string, unknown>) {
      switch (message.type) {
        case 'init':
          this.sessionId = Number(message.sessionId) || 0
          this.emit({ type: 'ready', sessionId: 0 })
          break
        case 'start':
          this.sessionId = Number(message.sessionId) || 0
          calls.started++
          this.emit({ type: 'listening', sessionId: this.sessionId })
          break
        case 'flush':
          calls.stopped++
          break
        case 'reset':
          calls.aborted++
          this.sessionId = Number(message.sessionId) || 0
          break
        case 'audio':
        case 'dispose':
          break
        default:
          break
      }
    }

    terminate() { this.terminated = true }

    private emit(data: Record<string, unknown>) {
      if (this.terminated) return
      // The real worker answers asynchronously; matching that keeps the app's
      // attempt-id guards honest instead of accidentally passing on sync delivery.
      setTimeout(() => this.onmessage?.({ data }), 0)
    }

    /** Drive this worker from the test. */
    say(text: string, isFinal: boolean) {
      this.emit({ type: isFinal ? 'final' : 'partial', text, sessionId: this.sessionId })
    }

    reportError(code: string) {
      this.emit({ type: 'error', code, sessionId: this.sessionId })
    }
  }

  const NativeWorker = window.Worker
  Object.defineProperty(window, 'Worker', {
    value: function WorkerShim(url: string | URL, options?: WorkerOptions) {
      if (String(url).includes('asr-worker')) return new FakeWorker()
      return new NativeWorker(url, options)
    },
    configurable: true,
  })

  if (options.disable === 'worker') {
    Object.defineProperty(window, 'Worker', { value: undefined, configurable: true })
  }
  if (options.disable === 'wasm') {
    Object.defineProperty(window, 'WebAssembly', { value: undefined, configurable: true })
  }
  if (options.disable === 'mic') {
    Object.defineProperty(navigator, 'mediaDevices', { value: {}, configurable: true })
  }

  const active = () => workers[workers.length - 1]

  const driver = {
    instances: () => workers.length,
    calls: () => ({ ...calls }),
    tracksReleased: () => tracksStopped,
    tracksLive: () => tracksCreated - tracksStopped,
    micRequests: () => micRequests,
    contextsCreated: () => contextsCreated,
    speak: async (text: string, opts: { final?: boolean } = {}) => active()?.say(text, opts.final !== false),
    replace: async (entries: Array<[string, boolean]>) => {
      for (const [text, isFinal] of entries) active()?.say(text, isFinal)
    },
    fail: async (code: string) => active()?.reportError(code),
  }

  Object.defineProperty(window, '__rum1n8Speech', { value: driver, configurable: true })
}

/** Install a fake local engine that the test drives by hand. */
export async function installFakeSpeech(page: Page, options: FakeOptions = {}): Promise<LocalSpeech> {
  const assets = VOICE_MODEL_ASSETS.map(asset => ({ url: voiceModelAssetUrl(asset.file), bytes: asset.bytes }))
  // addInitScript forwards a single argument, so the options, the pinned asset
  // list, and the cache name travel together.
  await page.addInitScript(INSTALL_FAKE, { options, assets, cacheName: voiceModelCacheName })
  return handle(page)
}

/** Hide one required capability so the app must not offer voice at all. */
export async function disableVoiceCapability(page: Page, capability: NonNullable<FakeOptions['disable']>): Promise<void> {
  await installFakeSpeech(page, { disable: capability })
}

/** Show the panel with the model treated as not yet downloaded. */
export async function installFakeSpeechWithoutModel(page: Page): Promise<LocalSpeech> {
  return installFakeSpeech(page, { modelMissing: true })
}

const handle = (page: Page): LocalSpeech => ({
  instances: () => page.evaluate(() => (window as never as { __rum1n8Speech: LocalSpeech }).__rum1n8Speech.instances()),
  calls: () => page.evaluate(() => (window as never as { __rum1n8Speech: LocalSpeech }).__rum1n8Speech.calls()),
  tracksReleased: () => page.evaluate(() => (window as never as { __rum1n8Speech: LocalSpeech }).__rum1n8Speech.tracksReleased()),
  tracksLive: () => page.evaluate(() => (window as never as { __rum1n8Speech: LocalSpeech }).__rum1n8Speech.tracksLive()),
  micRequests: () => page.evaluate(() => (window as never as { __rum1n8Speech: LocalSpeech }).__rum1n8Speech.micRequests()),
  contextsCreated: () => page.evaluate(() => (window as never as { __rum1n8Speech: LocalSpeech }).__rum1n8Speech.contextsCreated()),
  speak: (transcript, options) => page.evaluate(
    ([text, opts]) => (window as never as { __rum1n8Speech: LocalSpeech }).__rum1n8Speech.speak(text, opts),
    [transcript, options ?? {}] as const,
  ),
  replace: (results) => page.evaluate(
    (entries) => (window as never as { __rum1n8Speech: LocalSpeech }).__rum1n8Speech.replace(entries),
    results,
  ),
  fail: (code) => page.evaluate(
    (value) => (window as never as { __rum1n8Speech: LocalSpeech }).__rum1n8Speech.fail(value),
    code,
  ),
})

export const voiceModelBasePath = VOICE_MODEL_BASE_PATH
