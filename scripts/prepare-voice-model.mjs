#!/usr/bin/env node
// Download, checksum-verify, and stage the pinned voice model into the app build
// output. Used by the Docker build and by `npm run voice-model:prepare`.
//
// The ~167 MB archive is cached between runs under .cache/voice-model so local
// iterations and repeat Docker builds do not refetch it. A hash mismatch or a
// missing asset fails loudly rather than shipping a broken model.

import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, mkdtemp, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'
import {
  VOICE_MODEL_ARCHIVE,
  VOICE_MODEL_ASSETS,
  VOICE_MODEL_BASE_PATH,
  VOICE_MODEL_DIR,
  VOICE_MODEL_NOTICE_FILE,
  voiceModelNotices,
} from '../build/voice-model.mjs'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cacheDir = resolve(repoRoot, '.cache/voice-model')
const stagedDirName = VOICE_MODEL_BASE_PATH.split('/').filter(Boolean).pop()

function fail(message) {
  console.error(`voice-model: ${message}`)
  process.exit(1)
}

function mib(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`
}

async function exists(path) {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

async function sha256(file) {
  const hash = createHash('sha256')
  await pipeline(createReadStream(file), hash)
  return hash.digest('hex')
}

async function download(url, destination) {
  const response = await fetch(url, { redirect: 'follow' })
  if (!response.ok) fail(`download failed: ${response.status} ${response.statusText} (${url})`)

  const declared = Number(response.headers.get('content-length') || 0)
  await pipeline(response.body, createWriteStream(destination))

  const { size } = await stat(destination)
  if (declared && size !== declared) {
    fail(`download truncated: expected ${declared} bytes, wrote ${size}`)
  }
  return size
}

async function ensureArchive(log) {
  await mkdir(cacheDir, { recursive: true })
  const archivePath = join(cacheDir, VOICE_MODEL_ARCHIVE.name)

  if (await exists(archivePath)) {
    if (await sha256(archivePath) === VOICE_MODEL_ARCHIVE.sha256) {
      log(`cached archive verified (${mib(VOICE_MODEL_ARCHIVE.bytes)})`)
      return archivePath
    }
    log('cached archive failed checksum, refetching')
    await rm(archivePath, { force: true })
  }

  log(`downloading ${VOICE_MODEL_ARCHIVE.url}`)
  const partial = `${archivePath}.part`
  const size = await download(VOICE_MODEL_ARCHIVE.url, partial)
  if (size !== VOICE_MODEL_ARCHIVE.bytes) {
    await rm(partial, { force: true })
    fail(`archive size mismatch: expected ${VOICE_MODEL_ARCHIVE.bytes}, downloaded ${size}`)
  }
  const digest = await sha256(partial)
  if (digest !== VOICE_MODEL_ARCHIVE.sha256) {
    await rm(partial, { force: true })
    fail(`archive SHA-256 mismatch\n  expected ${VOICE_MODEL_ARCHIVE.sha256}\n  actual   ${digest}`)
  }
  await rename(partial, archivePath)
  log(`archive verified (${mib(size)})`)
  return archivePath
}

function extract(archivePath, into) {
  const result = spawnSync('tar', ['xjf', archivePath, '-C', into], { stdio: ['ignore', 'ignore', 'pipe'] })
  if (result.status !== 0) {
    // Busybox tar cannot read bzip2; Alpine images need `apk add tar bzip2`.
    fail(`could not extract ${VOICE_MODEL_ARCHIVE.name}: ${String(result.stderr || '').trim()}\n  (on Alpine, install it with: apk add --no-cache tar bzip2)`)
  }
}

// stage <outputRoot> -> writes <outputRoot>/voice-model/<version>/<assets>
export async function stage(outputRoot, { quiet = false } = {}) {
  const log = quiet ? () => {} : message => console.log(`voice-model: ${message}`)
  const destination = join(outputRoot, 'voice-model', stagedDirName)

  // Always rebuild from scratch so a removed asset cannot survive a rerun.
  await rm(destination, { force: true, recursive: true })
  await mkdir(destination, { recursive: true })

  const archivePath = await ensureArchive(log)
  const workspace = await mkdtemp(join(tmpdir(), 'voice-model-'))
  try {
    extract(archivePath, workspace)

    for (const asset of VOICE_MODEL_ASSETS) {
      const from = join(workspace, VOICE_MODEL_DIR, asset.file)
      if (!(await exists(from))) fail(`archive is missing ${asset.file}`)

      const { size } = await stat(from)
      if (size !== asset.bytes) {
        fail(`${asset.file} size mismatch: expected ${asset.bytes}, found ${size}`)
      }
      const digest = await sha256(from)
      if (digest !== asset.sha256) {
        fail(`${asset.file} SHA-256 mismatch\n  expected ${asset.sha256}\n  actual   ${digest}`)
      }
      await rename(from, join(destination, asset.file))
    }

    await writeFile(join(destination, VOICE_MODEL_NOTICE_FILE), voiceModelNotices())

    // The upstream demo must never be served, even accidentally.
    const staged = await readdir(destination)
    for (const forbidden of ['index.html', 'app-asr.js']) {
      if (staged.includes(forbidden)) fail(`${forbidden} must not be staged for production`)
    }

    const total = VOICE_MODEL_ASSETS.reduce((sum, asset) => sum + asset.bytes, 0)
    log(`staged ${staged.length} files in voice-model/${stagedDirName} (${mib(total)})`)
    return destination
  } finally {
    await rm(workspace, { force: true, recursive: true })
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outputRoot = resolve(process.cwd(), process.argv[2] || 'dist-app')
  stage(outputRoot).catch(error => fail(error.stack || String(error)))
}
