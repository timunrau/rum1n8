#!/usr/bin/env node
// Verify the staged voice model: every pinned asset is present at the exact
// pinned size and SHA-256, the notice is present, and the upstream demo files
// were not staged. Run after the Vite build and inside the Docker build so a
// broken or partial model can never reach an image.

import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'
import {
  VOICE_MODEL_ASSETS,
  VOICE_MODEL_BASE_PATH,
  VOICE_MODEL_NOTICE_FILE,
} from '../build/voice-model.mjs'

const problems = []

async function sha256(file) {
  const hash = createHash('sha256')
  await pipeline(createReadStream(file), hash)
  return hash.digest('hex')
}

async function exists(path) {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

export async function verify(outputRoot = process.cwd()) {
  const root = join(resolve(outputRoot), VOICE_MODEL_BASE_PATH.replace(/^\//, ''))

  if (!(await exists(root))) {
    problems.push(`${VOICE_MODEL_BASE_PATH}/ is missing. Run: npm run voice-model:prepare`)
    return problems
  }

  for (const asset of VOICE_MODEL_ASSETS) {
    const file = join(root, asset.file)
    if (!(await exists(file))) {
      problems.push(`${asset.file} is missing`)
      continue
    }
    const { size } = await stat(file)
    if (size !== asset.bytes) {
      problems.push(`${asset.file} is ${size} bytes, expected ${asset.bytes}`)
      continue
    }
    const digest = await sha256(file)
    if (digest !== asset.sha256) {
      problems.push(`${asset.file} SHA-256 is ${digest}, expected ${asset.sha256}`)
    }
  }

  if (!(await exists(join(root, VOICE_MODEL_NOTICE_FILE)))) {
    problems.push(`${VOICE_MODEL_NOTICE_FILE} is missing`)
  }

  for (const forbidden of ['index.html', 'app-asr.js']) {
    if (await exists(join(root, forbidden))) problems.push(`${forbidden} must not be served`)
  }

  const staged = await readdir(root)
  const expected = new Set([...VOICE_MODEL_ASSETS.map(asset => asset.file), VOICE_MODEL_NOTICE_FILE])
  for (const entry of staged) {
    if (!expected.has(entry)) problems.push(`unexpected staged file ${entry}`)
  }

  return problems
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = process.argv[2] || 'dist-app'
  verify(root).then(found => {
    if (found.length) {
      console.error('voice-model verify: FAILED')
      for (const problem of found) console.error(`  - ${problem}`)
      process.exit(1)
    }
    console.log(`voice-model verify: OK (${VOICE_MODEL_ASSETS.length} assets at ${VOICE_MODEL_BASE_PATH}/)`)
  }).catch(error => {
    console.error(`voice-model verify: ${error.stack || error}`)
    process.exit(1)
  })
}
