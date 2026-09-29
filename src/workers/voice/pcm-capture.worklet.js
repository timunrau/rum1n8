// AudioWorkletProcessor for microphone capture.
//
// Runs on the audio rendering thread, so it does the minimum possible: gather
// mono frames, resample to the model's 16 kHz if the device rate differs, and
// hand off small batches. It never runs recognition, never allocates per frame,
// and never touches the UI. The heavy work lives in a dedicated Worker.

const TARGET_SAMPLE_RATE = 16000
const BATCH_SAMPLES = 1600 // 100 ms at 16 kHz

class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super()
    const sourceRate = options?.processorOptions?.sourceRate || sampleRate
    this.sourceRate = sourceRate
    this.ratio = sourceRate / TARGET_SAMPLE_RATE
    // Linear-interpolation resampler state carried across render quanta.
    this.position = 0
    this.previous = 0
    this.batch = new Float32Array(BATCH_SAMPLES)
    this.filled = 0
    this.dropped = 0
    this.port.onmessage = event => {
      if (event.data?.type === 'flush') {
        this.flush()
        this.port.postMessage({ type: 'flushed' })
      }
      if (event.data?.type === 'reset') this.reset()
    }
  }

  reset() {
    this.position = 0
    this.previous = 0
    this.filled = 0
    this.dropped = 0
  }
  // Hand off whatever has accumulated. A partial batch at an endpoint or a Pause
  // must not be withheld, or the last word of a verse would be lost.
  flush() {
    if (!this.filled) return
    const out = this.batch.slice(0, this.filled)
    this.filled = 0
    this.port.postMessage({ type: 'audio', samples: out, dropped: this.dropped }, [out.buffer])
  }

  push(value) {
    this.batch[this.filled++] = value
    if (this.filled === BATCH_SAMPLES) this.flush()
  }

  process(inputs) {
    const input = inputs[0]
    if (!input || !input.length) return true
    const channel = input[0]
    if (!channel || !channel.length) return true

    if (Math.abs(this.ratio - 1) < 1e-6) {
      for (let i = 0; i < channel.length; i++) this.push(channel[i])
      return true
    }

    // Step the source through the target grid, interpolating between neighbours.
    // A position can land just before the first frame of this quantum, which
    // needs the last frame of the previous one.
    let index = this.position
    while (index < channel.length) {
      const lower = Math.floor(index)
      const weight = index - lower
      const left = lower < 0 ? this.previous : channel[lower]
      const right = lower + 1 < channel.length ? channel[lower + 1] : left
      this.push(left * (1 - weight) + right * weight)
      index += this.ratio
    }
    this.position = index - channel.length
    this.previous = channel[channel.length - 1]
    return true
  }
}

registerProcessor('pcm-capture', PcmCaptureProcessor)
