// Pinned voice-model manifest. Single source of truth for the build scripts,
// the Docker image, the Vite config, and the browser runtime. Nothing here is
// fetched at request time: the app only ever serves these exact bytes.
//
// The archive is a sherpa-onnx release asset containing a WASM+SIMD build of the
// sherpa-onnx runtime with the English streaming Zipformer transducer model
// embedded in its emscripten preload file. Both the runtime and the model are
// Apache-2.0; see LICENSES below and the generated NOTICE.md.

export const VOICE_MODEL_DIR = 'sherpa-onnx-wasm-simd-v1.13.7-en-asr-zipformer'

export const VOICE_MODEL_VERSION = 'sherpa-en-v1.13.7'

// Bumping this invalidates every cached model asset at once, so a cached
// .data file can never be paired with newer JS/Wasm.
export const VOICE_MODEL_BASE_PATH = `/voice-model/${VOICE_MODEL_VERSION}`

export const VOICE_MODEL_ARCHIVE = Object.freeze({
  name: 'sherpa-onnx-wasm-simd-v1.13.7-en-asr-zipformer.tar.bz2',
  url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/v1.13.7/sherpa-onnx-wasm-simd-v1.13.7-en-asr-zipformer.tar.bz2',
  sha256: '21559527d65f7674a45834870e4f51b0af14be27d4de1043aa6f576d9b426acc',
  bytes: 175243556,
})

// Only the files the worker actually loads. The upstream demo (index.html,
// app-asr.js) is deliberately excluded: it is demo UI built on a deprecated
// ScriptProcessorNode and main-thread decoding.
export const VOICE_MODEL_ASSETS = Object.freeze([
  {
    file: 'sherpa-onnx-wasm-main-asr.js',
    role: 'runtime',
    bytes: 82688,
    sha256: 'fd9e40cb7f871a94132fd722bde8a18aeb41a7e8cb95eee81a55b510e621c20a',
  },
  {
    file: 'sherpa-onnx-wasm-main-asr.wasm',
    role: 'wasm',
    bytes: 13150239,
    sha256: 'd0c15c3042fd61ca2a158a1eeb8b8c2099201f7580945efc8f729d2830cf746d',
  },
  {
    file: 'sherpa-onnx-wasm-main-asr.data',
    role: 'model',
    bytes: 190951044,
    sha256: 'b80cd7fc7c709509fadd2a9fdcd33ea2eb4803227871a3848d7cd055d84375bf',
  },
  {
    file: 'sherpa-onnx-asr.js',
    role: 'api',
    bytes: 53867,
    sha256: 'd51ae8e8b756ee5e53423ffada0c9702973f154f561aca7984fe0b12f4060178',
  },
])

export const VOICE_MODEL_TOTAL_BYTES = VOICE_MODEL_ASSETS.reduce((sum, asset) => sum + asset.bytes, 0)

export function voiceModelAssetUrl(file) {
  return `${VOICE_MODEL_BASE_PATH}/${file}`
}

// The emscripten preload file is the 182 MB payload. It must be served from
// Cache Storage for offline use, so the worker needs it as a whole ArrayBuffer.
export const VOICE_MODEL_PRELOAD_FILE = VOICE_MODEL_ASSETS.find(asset => asset.role === 'model').file

export const VOICE_MODEL_NOTICE_FILE = 'NOTICE.md'

// Sherpa-onnx builds the WASM runtime; the model is the English streaming
// Zipformer transducer from the sherpa-onnx asr-models release, identified via
// .github/workflows/wasm-simd-hf-space-en-asr-zipformer.yaml in the same repo.
export const VOICE_MODEL_LICENSES = Object.freeze([
  {
    name: 'sherpa-onnx (WebAssembly runtime)',
    license: 'Apache-2.0',
    url: 'https://github.com/k2-fsa/sherpa-onnx/blob/v1.13.7/LICENSE',
  },
  {
    name: 'sherpa-onnx-streaming-zipformer-en-2023-06-21 (model weights)',
    license: 'Apache-2.0',
    url: 'https://huggingface.co/csukuangfj/sherpa-onnx-streaming-zipformer-en-2023-06-21',
  },
])

export function voiceModelNotices() {
  const lines = [
    '# Third-party notices',
    '',
    'Ruminate ships a local speech-recognition model for the voice practice feature.',
    'It runs entirely in the browser on the user\'s device. No audio or transcript is',
    'sent to Ruminate or to any third party.',
    '',
    `Model version: ${VOICE_MODEL_VERSION}`,
    `Source archive: ${VOICE_MODEL_ARCHIVE.url}`,
    `SHA-256: ${VOICE_MODEL_ARCHIVE.sha256}`,
    '',
    '## Components',
    '',
  ]

  for (const { name, license, url } of VOICE_MODEL_LICENSES) {
    lines.push(`### ${name}`, '', `License: ${license}`, `Homepage: ${url}`, '')
  }

  lines.push(
    '## Notices',
    '',
    'Copyright the sherpa-onnx authors and contributors. Licensed under the Apache',
    'License, Version 2.0 (the "License"); you may not use these files except in',
    'compliance with the License. You may obtain a copy of the License at',
    '',
    '    http://www.apache.org/licenses/LICENSE-2.0',
    '',
    'Unless required by applicable law or agreed to in writing, software distributed',
    'under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR',
    'CONDITIONS OF ANY KIND, either express or implied. See the License for the',
    'specific language governing permissions and limitations under the License.',
    '',
  )

  return lines.join('\n')
}
