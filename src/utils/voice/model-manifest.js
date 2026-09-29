// Browser-facing view of the pinned voice model. The values come straight from
// build/voice-model.mjs (pure data, no Node APIs) so the build scripts and the
// running app can never drift apart.

import {
  VOICE_MODEL_ARCHIVE,
  VOICE_MODEL_ASSETS,
  VOICE_MODEL_BASE_PATH,
  VOICE_MODEL_NOTICE_FILE,
  VOICE_MODEL_PRELOAD_FILE,
  VOICE_MODEL_TOTAL_BYTES,
  VOICE_MODEL_VERSION,
  voiceModelAssetUrl,
  voiceModelNotices,
} from '../../../build/voice-model.mjs'

export {
  VOICE_MODEL_BASE_PATH,
  VOICE_MODEL_NOTICE_FILE,
  VOICE_MODEL_PRELOAD_FILE,
  VOICE_MODEL_TOTAL_BYTES,
  VOICE_MODEL_VERSION,
  voiceModelAssetUrl,
  voiceModelNotices,
}

export const VOICE_MODEL_SAMPLE_RATE = 16000

export const VOICE_MODEL_ATTRIBUTION = Object.freeze({
  runtime: 'sherpa-onnx (WebAssembly)',
  model: 'sherpa-onnx-streaming-zipformer-en-2023-06-21',
  license: 'Apache-2.0',
  source: VOICE_MODEL_ARCHIVE.url,
})

// Files the worker must be able to read offline before we may claim readiness.
export const VOICE_MODEL_FILES = Object.freeze(
  VOICE_MODEL_ASSETS.map(asset => Object.freeze({
    file: asset.file,
    role: asset.role,
    bytes: asset.bytes,
    url: voiceModelAssetUrl(asset.file),
  })),
)

export function formatModelSize(bytes) {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  return `${Math.round(bytes / (1024 * 1024))} MB`
}

export const VOICE_MODEL_SIZE_LABEL = formatModelSize(VOICE_MODEL_TOTAL_BYTES)
