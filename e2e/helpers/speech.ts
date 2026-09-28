/**
 * Fake Web Speech API for E2E tests.
 *
 * The app reads `webkitSpeechRecognition` once while it boots, so the fake has to
 * be installed before the app is loaded. Results are then driven by hand, which
 * makes voice practice deterministic and keeps real microphone speech out of CI.
 */

import type { Page } from '@playwright/test'

export interface FakeSpeech {
  start: () => Promise<void>
  stop: () => Promise<void>
  abort: () => Promise<void>
  instances: () => Promise<number>
  calls: () => Promise<{ started: number; stopped: number; aborted: number }>
  /** Append a result to the active instance and fire onresult with the full revisable list. */
  speak: (transcript: string | string[], options?: { final?: boolean }) => Promise<void>
  /** Replace the whole result list, modelling the service revising its own output. */
  replace: (results: Array<[string | string[], boolean]>) => Promise<void>
  fail: (error: string) => Promise<void>
  end: () => Promise<void>
}

const INSTALL_FAKE = (options: { startThrows: boolean }) => {
  const instances: Array<Record<string, unknown>> = []
  const calls = { started: 0, stopped: 0, aborted: 0 }

  const buildResult = (transcript: string | string[], isFinal: boolean) => {
    const alternatives = (Array.isArray(transcript) ? transcript : [transcript]).slice(0, 3)
    const result: Record<string, unknown> = { isFinal, length: alternatives.length }
    alternatives.forEach((text, index) => {
      result[index] = { transcript: text, confidence: 1 }
    })
    return result
  }

  class FakeSpeechRecognition {
    results: Array<Record<string, unknown>> = []
    continuous = false
    interimResults = false
    maxAlternatives = 1
    lang = ''
    onstart: (() => void) | null = null
    onresult: ((event: unknown) => void) | null = null
    onerror: ((event: unknown) => void) | null = null
    onend: (() => void) | null = null

    constructor() {
      instances.push(this)
    }

    start() {
      if (options.startThrows) throw new Error('microphone unavailable')
      calls.started++
      setTimeout(() => this.onstart?.(), 0)
    }

    stop() {
      calls.stopped++
    }

    abort() {
      calls.aborted++
    }

    fire(resultIndex: number) {
      this.onresult?.({ results: this.results, resultIndex })
    }
  }

  const active = () => instances[instances.length - 1]
  const setResults = (entries: Array<[string | string[], boolean]>, resultIndex: number) => {
    const instance = active() as unknown as {
      results: Array<Record<string, unknown>>
      fire: (index: number) => void
    } | undefined
    if (!instance) throw new Error('No fake speech recognition instance is active')
    instance.results = entries.map(([transcript, isFinal]) => buildResult(transcript, isFinal))
    instance.fire(resultIndex)
  }

  const driver = {
    instances: () => instances.length,
    calls: () => ({ ...calls }),
    start: async () => {
      const instance = active() as unknown as { start: () => void } | undefined
      if (!instance) throw new Error('No fake speech recognition instance is active')
      instance.start()
    },
    stop: async () => (active() as unknown as { stop: () => void } | undefined)?.stop(),
    abort: async () => (active() as unknown as { abort: () => void } | undefined)?.abort(),
    speak: async (transcript, options = {}) => {
      const instance = active() as unknown as {
        results: Array<Record<string, unknown>>
        fire: (index: number) => void
      } | undefined
      if (!instance) throw new Error('No fake speech recognition instance is active')
      instance.results.push(buildResult(transcript, options.final !== false))
      instance.fire(instance.results.length - 1)
    },
    replace: async (entries) => setResults(entries, 0),
    fail: async (error) => (active() as unknown as { onerror: (event: unknown) => void } | undefined)
      ?.onerror({ error }),
    end: async () => (active() as unknown as { onend: () => void } | undefined)?.onend?.(),
  }

  Object.defineProperty(window, '__rum1n8Speech', { value: driver, configurable: true })
  window.webkitSpeechRecognition = FakeSpeechRecognition
  window.SpeechRecognition = FakeSpeechRecognition
}

/** Install a fake recognizer that the test drives by hand. */
export async function installFakeSpeech(page: Page, options: { startThrows?: boolean } = {}): Promise<FakeSpeech> {
  await page.addInitScript(INSTALL_FAKE, { startThrows: !!options.startThrows })
  return speechHandle(page)
}

/** Hide the microphone control by removing both speech recognition constructors. */
export async function hideSpeechRecognition(page: Page): Promise<void> {
  await page.addInitScript(() => {
    for (const name of ['SpeechRecognition', 'webkitSpeechRecognition']) {
      Object.defineProperty(window, name, { get: () => undefined, configurable: true })
    }
  })
}

const speechHandle = (page: Page): FakeSpeech => ({
  start: () => page.evaluate(() => (window as never as { __rum1n8Speech: FakeSpeech }).__rum1n8Speech.start()),
  stop: () => page.evaluate(() => (window as never as { __rum1n8Speech: FakeSpeech }).__rum1n8Speech.stop()),
  abort: () => page.evaluate(() => (window as never as { __rum1n8Speech: FakeSpeech }).__rum1n8Speech.abort()),
  instances: () => page.evaluate(() => (window as never as { __rum1n8Speech: FakeSpeech }).__rum1n8Speech.instances()),
  calls: () => page.evaluate(() => (window as never as { __rum1n8Speech: FakeSpeech }).__rum1n8Speech.calls()),
  speak: (transcript, options) => page.evaluate(
    ([text, opts]) => (window as never as { __rum1n8Speech: FakeSpeech }).__rum1n8Speech.speak(text, opts),
    [transcript, options ?? {}] as const,
  ),
  replace: (results) => page.evaluate(
    (entries) => (window as never as { __rum1n8Speech: FakeSpeech }).__rum1n8Speech.replace(entries),
    results,
  ),
  fail: (error) => page.evaluate(
    (code) => (window as never as { __rum1n8Speech: FakeSpeech }).__rum1n8Speech.fail(code),
    error,
  ),
  end: () => page.evaluate(() => (window as never as { __rum1n8Speech: FakeSpeech }).__rum1n8Speech.end()),
})
