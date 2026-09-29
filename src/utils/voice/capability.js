// Capability gate for local voice practice.
//
// The old gate asked whether the browser exposed SpeechRecognition, which
// quietly sent a user's recitation to a browser vendor's cloud service and still
// failed on the target device. Local recognition instead needs a microphone, a
// Worker to keep decoding off the UI thread, AudioWorklet for capture,
// WebAssembly, and WASM SIMD for this particular sherpa-onnx build. Passing
// these checks still does not prove the device has the memory or the speed, so
// model initialization is a separate, real check that can fail with a usable
// error and a keyboard fallback.

export const voiceCapabilityReasons = {
  'no-mic': 'This browser cannot use a microphone here.',
  'no-worker': 'This browser cannot run local speech recognition.',
  'no-audio-worklet': 'This browser cannot capture audio for local speech recognition.',
  'no-wasm': 'This browser cannot run WebAssembly.',
  'no-simd': 'This browser or device lacks WebAssembly SIMD, which local speech recognition needs.',
  insecure: 'Local speech recognition needs a secure (HTTPS) connection.',
}

// Minimal valid WebAssembly module (empty body) whose body is a single
// `v128.const` + `i32x4.any_true`. Opcode 0xFD is the SIMD prefix, so a
// non-SIMD engine fails validation. This is the same probe wasm-feature-detect
// uses; feature-sniffing for SIMD is not reliable.
const SIMD_PROBE = new Uint8Array([
  0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
  0x01, 0x05, 0x01, 0x60, 0x00, 0x01, 0x7f,
  0x03, 0x02, 0x01, 0x00,
  0x0a, 0x19, 0x01, 0x17, 0x00,
  0xfd, 0x0c, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0xfd, 0x63, 0x01,
  0x0b,
])

export function hasWasmSimd(scope = globalThis) {
  const validate = scope.WebAssembly?.validate
  if (typeof validate !== 'function') return false
  try {
    return validate(SIMD_PROBE) === true
  } catch {
    return false
  }
}

export function voiceCapabilities(scope = globalThis) {
  const nav = scope.navigator
  const checks = {
    microphone: typeof nav?.mediaDevices?.getUserMedia === 'function',
    worker: typeof scope.Worker === 'function',
    audioWorklet: typeof scope.AudioWorkletNode === 'function' && typeof scope.AudioContext === 'function',
    wasm: typeof scope.WebAssembly?.instantiate === 'function' || typeof scope.WebAssembly?.compile === 'function',
    simd: hasWasmSimd(scope),
  }
  const failed = Object.keys(checks).filter(key => !checks[key])
  return {
    supported: !failed.length,
    checks,
    reason: failed.length ? voiceCapabilityReasons[`no-${failed[0]}`] || voiceCapabilityReasons['no-worker'] : '',
  }
}

export function voiceCapabilitySupported(scope = globalThis) {
  return voiceCapabilities(scope).supported
}
