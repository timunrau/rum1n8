import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createRecognitionAdapter,
  recognitionConstructor,
  recognitionErrors,
} from './recognition.js'

// Minimal stand-in for SpeechRecognition. Tests drive the lifecycle by hand.
class FakeRecognition {
  static instances = []

  constructor() {
    this.continuous = false
    this.interimResults = false
    this.maxAlternatives = 1
    this.lang = ''
    this.startCalls = 0
    this.stopCalls = 0
    this.abortCalls = 0
    this.started = false
    FakeRecognition.instances.push(this)
  }

  start() {
    this.startCalls++
    this.started = true
  }

  stop() {
    this.stopCalls++
  }

  abort() {
    this.abortCalls++
  }

  fireStart() {
    this.onstart?.({})
  }

  fireResult(results, resultIndex = 0) {
    this.onresult?.({ results, resultIndex })
  }

  fireError(error) {
    this.onerror?.({ error })
  }

  fireEnd() {
    this.onend?.({})
  }
}

const alternative = transcript => ({ transcript })

const resultList = entries => entries.map(([transcripts, isFinal]) => {
  const alternatives = transcripts.map(alternative)
  return { isFinal, length: alternatives.length, ...alternatives }
})

const createScope = (Constructor = FakeRecognition, navigatorLike = { languages: ['en-US', 'fr'] }) => ({
  [Constructor === FakeRecognition ? 'webkitSpeechRecognition' : 'SpeechRecognition']: Constructor,
  navigator: navigatorLike,
})

const latest = () => FakeRecognition.instances[FakeRecognition.instances.length - 1]

describe('recognitionConstructor', () => {
  it('prefers the standard name and falls back to the prefixed one', () => {
    const standard = class {}
    const prefixed = class {}

    expect(recognitionConstructor({ SpeechRecognition: standard })).toBe(standard)
    expect(recognitionConstructor({ webkitSpeechRecognition: prefixed })).toBe(prefixed)
    expect(recognitionConstructor({ SpeechRecognition: standard, webkitSpeechRecognition: prefixed })).toBe(standard)
  })

  it('returns null when the browser has no speech recognition', () => {
    expect(recognitionConstructor({})).toBeNull()
  })
})

describe('createRecognitionAdapter start', () => {
  beforeEach(() => {
    FakeRecognition.instances = []
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('requests continuous interim results with three alternatives and an English locale', () => {
    const onStatus = vi.fn()
    const adapter = createRecognitionAdapter({ onStatus, onResult: vi.fn(), onError: vi.fn(), scope: createScope() })

    adapter.start()

    expect(onStatus).toHaveBeenNthCalledWith(1, 'idle')
    expect(onStatus).toHaveBeenNthCalledWith(2, 'starting')
    expect(latest()).toMatchObject({ continuous: true, interimResults: true, maxAlternatives: 3, lang: 'en-US' })
  })

  it('uses the first English locale the browser offers and falls back to en-US', () => {
    const onStatus = vi.fn()
    createRecognitionAdapter({
      onStatus,
      onResult: vi.fn(),
      onError: vi.fn(),
      scope: createScope(FakeRecognition, { languages: ['fr-FR', 'en-GB', 'de'] }),
    }).start()
    expect(latest().lang).toBe('en-GB')

    FakeRecognition.instances = []
    createRecognitionAdapter({
      onStatus,
      onResult: vi.fn(),
      onError: vi.fn(),
      scope: createScope(FakeRecognition, { languages: ['fr-FR'] }),
    }).start()
    expect(latest().lang).toBe('en-US')
  })

  it('reports listening only after the browser starts the microphone', () => {
    const onStatus = vi.fn()
    createRecognitionAdapter({ onStatus, onResult: vi.fn(), onError: vi.fn(), scope: createScope() }).start()
    latest().fireStart()

    expect(onStatus).toHaveBeenLastCalledWith('listening')
  })

  it('requests microphone access only when voice starts, then releases the stream', async () => {
    const stop = vi.fn()
    const getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] })
    const scope = createScope(FakeRecognition, { mediaDevices: { getUserMedia } })
    const adapter = createRecognitionAdapter({ onStatus: vi.fn(), onResult: vi.fn(), onError: vi.fn(), scope })

    expect(getUserMedia).not.toHaveBeenCalled()
    adapter.start()
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true })
    expect(FakeRecognition.instances).toHaveLength(0)

    await vi.waitFor(() => expect(FakeRecognition.instances).toHaveLength(1))
    expect(stop).toHaveBeenCalledOnce()
    expect(latest().startCalls).toBe(1)

    adapter.start()
    expect(getUserMedia).toHaveBeenCalledOnce()
    expect(latest().startCalls).toBe(1)
  })

  it('does not start recognition if voice is cancelled while permission is pending', async () => {
    let allow
    const stop = vi.fn()
    const getUserMedia = vi.fn(() => new Promise(resolve => { allow = resolve }))
    const scope = createScope(FakeRecognition, { mediaDevices: { getUserMedia } })
    const adapter = createRecognitionAdapter({ onStatus: vi.fn(), onResult: vi.fn(), onError: vi.fn(), scope })

    adapter.start()
    adapter.abort()
    allow({ getTracks: () => [{ stop }] })
    await vi.waitFor(() => expect(stop).toHaveBeenCalledOnce())
    expect(FakeRecognition.instances).toHaveLength(0)
  })

  it('reports a denied microphone request and allows a retry', async () => {
    const getUserMedia = vi.fn().mockRejectedValueOnce({ name: 'NotAllowedError' })
      .mockResolvedValueOnce({ getTracks: () => [] })
    const onError = vi.fn()
    const adapter = createRecognitionAdapter({
      onStatus: vi.fn(), onResult: vi.fn(), onError,
      scope: createScope(FakeRecognition, { mediaDevices: { getUserMedia } }),
    })

    adapter.start()
    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith(recognitionErrors['not-allowed'], 'not-allowed'))
    expect(FakeRecognition.instances).toHaveLength(0)

    adapter.start()
    await vi.waitFor(() => expect(FakeRecognition.instances).toHaveLength(1))
    expect(getUserMedia).toHaveBeenCalledTimes(2)
  })

  it('reports an unavailable microphone when the constructor throws', () => {
    const onError = vi.fn()
    const onStatus = vi.fn()
    const Throwing = class {
      start() { throw new Error('denied') }
    }
    createRecognitionAdapter({ onStatus, onResult: vi.fn(), onError, scope: createScope(Throwing) }).start()

    expect(onError).toHaveBeenCalledWith('Speech recognition could not start. Tap Retry or use the keyboard.')
    expect(onStatus).toHaveBeenLastCalledWith('error')
  })

  it('reports an unavailable feature when the browser has no speech recognition', () => {
    const onError = vi.fn()
    createRecognitionAdapter({ onStatus: vi.fn(), onResult: vi.fn(), onError, scope: {} }).start()

    expect(onError).toHaveBeenCalledWith('Speech recognition is unavailable. Use the keyboard.')
  })

  it('aborts with an error when the microphone never starts', () => {
    const onStatus = vi.fn()
    const onError = vi.fn()
    createRecognitionAdapter({ onStatus, onResult: vi.fn(), onError, scope: createScope() }).start()

    vi.advanceTimersByTime(10000)

    expect(onStatus).toHaveBeenLastCalledWith('error')
    expect(onError).toHaveBeenCalledWith('The microphone did not start. Tap Retry or use the keyboard.')
  })
})

describe('createRecognitionAdapter results', () => {
  beforeEach(() => {
    FakeRecognition.instances = []
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const start = (overrides = {}) => {
    const onResult = vi.fn()
    const adapter = createRecognitionAdapter({
      onStatus: vi.fn(),
      onError: vi.fn(),
      onResult,
      scope: createScope(),
      ...overrides,
    })
    adapter.start()
    latest().fireStart()
    return { adapter, onResult }
  }

  it('reports each new final result once and keeps interim results revisable', () => {
    const { onResult } = start()
    const recognition = latest()

    recognition.fireResult(resultList([[['For God'], false], [['so loved'], true]]), 1)
    expect(onResult).toHaveBeenLastCalledWith({
      finals: [{ index: 1, alternatives: ['so loved'] }],
      interim: [{ index: 0, alternatives: ['For God'] }],
      sessionId: 1,
      resultIndex: 1,
    })

    recognition.fireResult(resultList([[['For God so'], false], [['so loved'], true]]), 0)
    expect(onResult).toHaveBeenLastCalledWith({
      finals: [],
      interim: [{ index: 0, alternatives: ['For God so'] }],
      sessionId: 1,
      resultIndex: 0,
    })
  })

  it('keeps at most three alternatives per result', () => {
    const { onResult } = start()
    latest().fireResult(resultList([[['a', 'b', 'c', 'd', 'e'], true]]))

    expect(onResult.mock.calls[0][0].finals[0].alternatives).toEqual(['a', 'b', 'c'])
  })

  it('removes repeated prefixes from cumulative final and interim results', () => {
    const { onResult } = start()
    const recognition = latest()

    recognition.fireResult(resultList([[['one'], true]]))
    recognition.fireResult(resultList([[['one'], true], [['one two'], true]]), 1)
    recognition.fireResult(resultList([[['one'], true], [['one two'], true], [['one two three'], true]]), 2)
    expect(onResult.mock.lastCall[0].finals).toEqual([{ index: 2, alternatives: ['three'] }])

    recognition.fireResult(resultList([
      [['one'], true], [['one two'], true], [['one two three'], true], [['one two three four'], false],
    ]), 3)
    expect(onResult.mock.lastCall[0].interim).toEqual([{ index: 3, alternatives: ['four'] }])

    recognition.fireResult(resultList([
      [['one'], true], [['one two'], true], [['one two three'], true], [['one two three'], true],
    ]), 3)
    expect(onResult.mock.lastCall[0].finals).toEqual([])
  })

  it('keeps separate repeated words when the transcript is not growing cumulatively', () => {
    const { onResult } = start()
    const recognition = latest()

    recognition.fireResult(resultList([[['holy'], true]]))
    recognition.fireResult(resultList([[['holy'], true], [['holy'], true]]), 1)
    recognition.fireResult(resultList([[['holy'], true], [['holy'], true], [['holy'], true]]), 2)

    expect(onResult.mock.calls.map(([result]) => result.finals[0]?.alternatives[0]))
      .toEqual(['holy', 'holy', 'holy'])
  })

  it('errors instead of consuming a result the service changed after the fact', () => {
    const onError = vi.fn()
    const onStatus = vi.fn()
    start({ onError, onStatus })

    latest().fireResult(resultList([[['For God'], true]]))
    latest().fireResult(resultList([[['For Gods'], true]]))

    expect(onError).toHaveBeenCalledWith('The speech service reset its results. Tap Resume to continue.')
    expect(onStatus).toHaveBeenLastCalledWith('paused')
  })

  it('ignores results from a superseded recognition instance', () => {
    const { adapter, onResult } = start()
    const first = latest()

    adapter.start()
    onResult.mockClear()
    first.fireResult(resultList([[['late words'], true]]))

    expect(onResult).not.toHaveBeenCalled()
  })
})

describe('createRecognitionAdapter errors and shutdown', () => {
  beforeEach(() => {
    FakeRecognition.instances = []
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const start = (overrides = {}) => {
    const handlers = { onStatus: vi.fn(), onResult: vi.fn(), onError: vi.fn(), ...overrides }
    const adapter = createRecognitionAdapter({ ...handlers, scope: createScope() })
    adapter.start()
    latest().fireStart()
    return { adapter, ...handlers }
  }

  it('pauses on a silent microphone instead of erroring', () => {
    const { onStatus, onError } = start()
    latest().fireError('no-speech')

    expect(onStatus).toHaveBeenLastCalledWith('paused')
    expect(onError).toHaveBeenCalledWith(recognitionErrors['no-speech'], 'no-speech')
  })

  it('errors and reports the browser message for other failures', () => {
    const { onStatus, onError } = start()
    latest().fireError('not-allowed')

    expect(onStatus).toHaveBeenLastCalledWith('error')
    expect(onError).toHaveBeenCalledWith(recognitionErrors['not-allowed'], 'not-allowed')
  })

  it('falls back to a generic message for an unknown error code', () => {
    const { onError } = start()
    latest().fireError('something-new')

    expect(onError).toHaveBeenCalledWith('Speech recognition failed. Tap Retry or use the keyboard.', 'something-new')
  })

  it('ignores a stale error after the user already stopped', () => {
    const { adapter, onError } = start()
    const recognition = latest()
    adapter.abort('idle')
    onError.mockClear()

    recognition.fireError('not-allowed')
    recognition.fireEnd()

    expect(onError).not.toHaveBeenCalled()
  })

  it('restarts when the browser ends the session by itself', () => {
    const { onStatus, onResult } = start()
    const first = latest()
    first.fireResult(resultList([[['One'], true]]))
    first.fireEnd()

    expect(onStatus).toHaveBeenLastCalledWith('starting')
    vi.advanceTimersByTime(250)
    expect(FakeRecognition.instances).toHaveLength(2)
    latest().fireStart()
    latest().fireResult(resultList([[['two'], true]]))
    expect(onResult.mock.calls.map(([result]) => result.finals[0]?.alternatives[0])).toEqual(['One', 'two'])
    expect(onStatus).toHaveBeenLastCalledWith('listening')
  })

  it('does not restart after Pause during the restart gap', () => {
    const { adapter, onStatus } = start()
    latest().fireEnd()
    adapter.stop()

    vi.advanceTimersByTime(250)
    expect(FakeRecognition.instances).toHaveLength(1)
    expect(onStatus).toHaveBeenLastCalledWith('paused')
  })

  it('pauses after repeated immediate endings without speech', () => {
    const { onStatus, onError } = start()
    for (let index = 0; index < 3; index++) {
      latest().fireEnd()
      if (index < 2) {
        vi.advanceTimersByTime(250)
        latest().fireStart()
      }
    }

    expect(onStatus).toHaveBeenLastCalledWith('paused')
    expect(onError).toHaveBeenCalledWith('The speech service stopped repeatedly. Tap Resume to try again.')
    vi.advanceTimersByTime(250)
    expect(FakeRecognition.instances).toHaveLength(3)
  })

  it('finishes, then pauses after the short grace period for late final results', () => {
    const { adapter, onStatus } = start()
    adapter.stop()

    expect(onStatus).toHaveBeenLastCalledWith('finishing')
    expect(latest().stopCalls).toBe(1)

    vi.advanceTimersByTime(1500)
    expect(onStatus).toHaveBeenLastCalledWith('paused')
  })

  it('pauses immediately when the browser refuses to stop', () => {
    const { adapter, onStatus } = start()
    const recognition = latest()
    recognition.stop = () => { throw new Error('already ended') }

    adapter.stop()

    expect(onStatus).toHaveBeenLastCalledWith('paused')
  })

  it('ignores stop when nothing is listening', () => {
    const { adapter, onStatus } = start()
    onStatus.mockClear()

    adapter.abort('idle')
    onStatus.mockClear()
    adapter.stop()

    expect(onStatus).not.toHaveBeenCalled()
  })

  it('aborts the previous instance whenever a new one starts', () => {
    const { adapter, onStatus } = start()
    const first = latest()

    adapter.start()

    expect(first.abortCalls).toBe(1)
    expect(onStatus).toHaveBeenLastCalledWith('starting')
  })
})
