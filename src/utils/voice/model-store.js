// Owns the on-device voice model's lifecycle in Cache Storage.
//
// This cache is the single source of truth for the model: the service worker has
// no runtime rule for /voice-model/, so nothing else may write these entries and
// a cached .data file can never be paired with mismatched JS or Wasm. The cache
// name carries the pinned version, so a new model version starts from a clean
// bucket and the previous one stays usable until the replacement is complete.
//
// Audio and transcripts are never written here or anywhere else. Only the pinned
// model files live in this cache.

import { VOICE_MODEL_FILES, VOICE_MODEL_NOTICE_FILE, VOICE_MODEL_TOTAL_BYTES, VOICE_MODEL_VERSION } from './model-manifest.js'

const CACHE_PREFIX = 'ruminate-voice-model-'

// One byte of slack: some browsers report a stored Response length that differs
// from the network Content-Length after transparent compression accounting.
const LENGTH_SLACK = 4096

export const voiceModelCacheName = `${CACHE_PREFIX}${VOICE_MODEL_VERSION}`

function storageSupported(scope = globalThis) {
  return typeof scope.caches?.open === 'function'
}

async function openCache(scope) {
  return scope.caches.open(voiceModelCacheName)
}

// Cache Storage keys are absolute URLs. Use the app origin so a reverse proxy
// or a TWA origin change cannot silently miss the cache.
function modelRequest(info) {
  return new Request(info.url, { cache: 'reload', credentials: 'same-origin' })
}

export async function modelStorageHeadroom(scope = globalThis) {
  const estimate = await scope.navigator?.storage?.estimate?.().catch(() => null)
  if (!estimate) return null
  return {
    usage: Number(estimate.usage) || 0,
    quota: Number(estimate.quota) || 0,
    available: Math.max(0, (Number(estimate.quota) || 0) - (Number(estimate.usage) || 0)),
  }
}

// Ask the browser to keep this origin's data. Best effort: a rejection just
// means the model may be evicted under storage pressure.
export async function requestPersistentStorage(scope = globalThis) {
  try {
    if (await scope.navigator?.storage?.persisted?.()) return true
    return await scope.navigator?.storage?.persist?.() === true
  } catch {
    return false
  }
}

async function cachedSize(cache, info) {
  const response = await cache.match(modelRequest(info))
  if (!response) return null
  const length = Number(response.headers.get('content-length'))
  if (!Number.isFinite(length) || length <= 0) return null
  if (Math.abs(length - info.bytes) > LENGTH_SLACK) return null
  return length
}

// 'ready' only when every pinned file is present at the right size. A partial
// cache (interrupted download, eviction, storage pressure) reports 'partial' so
// the UI can offer a clean re-download rather than claiming offline readiness.
export async function modelCacheState(scope = globalThis) {
  if (!storageSupported(scope)) return { state: 'unsupported', cached: 0, total: VOICE_MODEL_TOTAL_BYTES }
  let cache
  try {
    cache = await openCache(scope)
  } catch {
    return { state: 'unsupported', cached: 0, total: VOICE_MODEL_TOTAL_BYTES }
  }

  let cached = 0
  const missing = []
  for (const info of VOICE_MODEL_FILES) {
    const size = await cachedSize(cache, info).catch(() => null)
    if (size) cached += size
    else missing.push(info.file)
  }

  return {
    state: !missing.length ? 'ready' : (cached ? 'partial' : 'missing'),
    cached,
    missing,
    total: VOICE_MODEL_TOTAL_BYTES,
  }
}

export class ModelStorageError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'ModelStorageError'
    this.code = code
  }
}

export async function deleteVoiceModel(scope = globalThis) {
  if (!storageSupported(scope)) return
  await scope.caches.delete(voiceModelCacheName)
  // Remove older model versions once a newer one is confirmed present.
  for (const name of await scope.caches.keys()) {
    if (name.startsWith(CACHE_PREFIX) && name !== voiceModelCacheName) {
      await scope.caches.delete(name)
    }
  }
}

async function streamToCache(cache, info, onProgress, signal) {
  const response = await fetch(modelRequest(info), { signal })
  if (!response.ok) {
    throw new ModelStorageError('fetch-failed', `${info.file} could not be downloaded (${response.status}).`)
  }
  if (!response.body) {
    throw new ModelStorageError('no-body', `${info.file} could not be read.`)
  }

  const declared = Number(response.headers.get('content-length')) || info.bytes
  let seen = 0
  const counter = new TransformStream({
    transform(chunk, controller) {
      seen += chunk.byteLength
      onProgress?.(seen, declared)
      controller.enqueue(chunk)
    },
  })

  if (signal?.aborted) throw new ModelStorageError('aborted', 'Download cancelled.')

  const tracked = new Response(response.body.pipeThrough(counter, { signal }), {
    headers: response.headers,
    status: response.status,
  })
  await cache.put(info.url, tracked)
  if (signal?.aborted) throw new ModelStorageError('aborted', 'Download cancelled.')
}

// Explicit, cancelable, opt-in download. Never runs during app install and
// never blocks ordinary app start.
export async function downloadVoiceModel({
  scope = globalThis,
  onProgress = () => {},
  signal,
  onFileStart = () => {},
} = {}) {
  if (!storageSupported(scope)) {
    throw new ModelStorageError('unsupported', 'This browser cannot store the voice model for offline use.')
  }
  if (!scope.isSecureContext) {
    throw new ModelStorageError('insecure', 'The voice model needs a secure (HTTPS) connection.')
  }

  const headroom = await modelStorageHeadroom(scope)
  if (headroom && headroom.available < VOICE_MODEL_TOTAL_BYTES) {
    throw new ModelStorageError('no-space', `Not enough free storage for the voice model (${Math.round(VOICE_MODEL_TOTAL_BYTES / 1024 / 1024)} MB).`)
  }

  // A clean slate keeps a half-written file from surviving a retry.
  await scope.caches.delete(voiceModelCacheName)
  const cache = await openCache(scope)
  await requestPersistentStorage(scope)

  // Smallest first so a failure on the big payload leaves an obviously
  // incomplete cache rather than a subtly wrong one.
  const ordered = [...VOICE_MODEL_FILES].sort((a, b) => a.bytes - b.bytes)
  const started = performance.now()
  let completedBytes = 0

  try {
    for (const info of ordered) {
      if (signal?.aborted) throw new ModelStorageError('aborted', 'Download cancelled.')
      onFileStart(info)
      await streamToCache(cache, info, (fileSeen, fileTotal) => {
        onProgress({
          phase: 'downloading',
          file: info.file,
          fileReceived: fileSeen,
          fileTotal,
          received: completedBytes + fileSeen,
          total: VOICE_MODEL_TOTAL_BYTES,
        })
      }, signal)
      completedBytes += info.bytes
    }

    // Read back what actually landed. Only a verified cache may be called ready.
    const state = await modelCacheState(scope)
    if (signal?.aborted) throw new ModelStorageError('aborted', 'Download cancelled.')
    if (state.state !== 'ready') {
      throw new ModelStorageError('incomplete', 'The voice model download did not finish correctly.')
    }

    onProgress({ phase: 'ready', received: state.cached, total: state.total, elapsedMs: Math.round(performance.now() - started) })
    return state
  } catch (error) {
    await scope.caches.delete(voiceModelCacheName)
    if (signal?.aborted) throw new ModelStorageError('aborted', 'Download cancelled.')
    throw error
  }
}

export async function readModelAsset(file, scope = globalThis) {
  const info = VOICE_MODEL_FILES.find(entry => entry.file === file)
  if (!info) throw new ModelStorageError('unknown-asset', `Unknown voice model file ${file}.`)
  const cache = await openCache(scope)
  const response = await cache.match(modelRequest(info))
  if (!response) throw new ModelStorageError('not-cached', `${file} is not downloaded yet.`)
  return response
}

export function voiceModelNoticesUrl() {
  return `${VOICE_MODEL_FILES[0].url.replace(/\/[^/]*$/, '')}/${VOICE_MODEL_NOTICE_FILE}`
}
