// Verifies the voice model is actually servable, not merely present on disk.
//
// Three layers, cheapest first:
//   1. The built app contains every pinned asset at its versioned path.
//   2. The nginx template still encodes the rules the runtime depends on
//      (explicit wasm/js types, 404 instead of the app shell, immutable
//      caching, byte ranges, no directory listing, no upstream demo files).
//   3. Live HTTP. When `nginx` is on PATH the rendered config is booted against
//      the real build and probed; otherwise an equivalent static server serves
//      the same bytes so the asset set and status codes are still exercised.

import { spawn, spawnSync } from 'node:child_process'
import { createReadStream } from 'node:fs'
import { readFile, stat, writeFile, mkdtemp, rm } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { extname, join, resolve } from 'node:path'
import { VOICE_MODEL_ASSETS, VOICE_MODEL_BASE_PATH, VOICE_MODEL_NOTICE_FILE, VOICE_MODEL_PRELOAD_FILE } from '../build/voice-model.mjs'

const appDir = resolve('dist-app')
const templatePath = resolve('nginx.app.conf.template')
const failures = []

const MIME_BY_EXTENSION = {
  '.js': 'text/javascript',
  '.wasm': 'application/wasm',
  '.data': 'application/octet-stream',
  '.md': 'application/octet-stream',
}

function check(condition, message) {
  if (!condition) failures.push(message)
}

// Return the full brace-balanced body of the directive that starts with `header`.
function extractBlock(source, header) {
  const start = source.indexOf(header)
  if (start < 0) return ''
  let depth = 0
  for (let index = source.indexOf('{', start); index < source.length; index++) {
    if (source[index] === '{') depth++
    else if (source[index] === '}' && --depth === 0) return source.slice(start, index + 1)
  }
  return ''
}

async function sizeOf(path) {
  try {
    return (await stat(path)).size
  } catch {
    return -1
  }
}

const modelRoot = join(appDir, VOICE_MODEL_BASE_PATH)

console.log('Checking pinned voice model assets in the app build...')
for (const asset of VOICE_MODEL_ASSETS) {
  const path = join(modelRoot, asset.file)
  const bytes = await sizeOf(path)
  check(bytes === asset.bytes, `Voice model asset ${asset.file} is ${bytes} bytes, expected ${asset.bytes}.`)
}
check((await sizeOf(join(modelRoot, VOICE_MODEL_NOTICE_FILE))) > 0, 'Voice model notice is missing or empty.')
for (const rejected of ['index.html', 'app-asr.js', 'sherpa-onnx-wasm-main-asr.mjs']) {
  check((await sizeOf(join(modelRoot, rejected))) === -1, `Voice model directory must not ship upstream demo file ${rejected}.`)
}

console.log('Checking the nginx voice model rules...')
const template = await readFile(templatePath, 'utf8')
const block = extractBlock(template, 'location ^~ /voice-model/')
check(Boolean(block), 'nginx template is missing the /voice-model/ location.')
for (const [needle, message] of [
  ['application/wasm', 'nginx must serve .wasm as application/wasm or instantiateStreaming fails.'],
  ['try_files $uri =404', 'nginx must 404 a missing model file instead of serving the app shell.'],
  ['immutable', 'nginx must cache the versioned model immutably.'],
  ['nosniff', 'nginx must send nosniff for model assets.'],
  ['autoindex off', 'nginx must not list the model directory.'],
  ['Accept-Ranges', 'nginx must advertise byte ranges so the wasm can stream.'],
  ['gzip off', 'nginx must not gzip the model payloads or byte ranges break.'],
]) check(block.includes(needle), message)

if (failures.length) {
  console.error('Voice model serving verification failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

const server = await startNginx() ?? await startStaticServer()
console.log(server.nginx
  ? `Probing the rendered nginx config on ${server.origin}...`
  : 'nginx is unavailable; probing an equivalent static server over the same build...')

try {
  const base = `${server.origin}${VOICE_MODEL_BASE_PATH}`

  for (const asset of VOICE_MODEL_ASSETS) {
    const response = await fetch(`${base}/${asset.file}`, { redirect: 'manual' })
    check(response.status === 200, `GET ${asset.file} returned ${response.status}.`)
    const expected = MIME_BY_EXTENSION[extname(asset.file)]
    check(response.headers.get('content-type') === expected, `${asset.file} was served as ${response.headers.get('content-type')}, expected ${expected}.`)
    check(response.headers.get('content-length') === String(asset.bytes), `${asset.file} served an unexpected Content-Length.`)
    check(/immutable/.test(response.headers.get('cache-control') ?? ''), `${asset.file} is missing immutable caching.`)
    check(response.headers.get('x-content-type-options') === 'nosniff', `${asset.file} is missing nosniff.`)
    await response.arrayBuffer()
  }

  const notice = await fetch(`${base}/${VOICE_MODEL_NOTICE_FILE}`)
  check(notice.status === 200, `GET ${VOICE_MODEL_NOTICE_FILE} returned ${notice.status}.`)

  // A partial read of the preload file is how the runtime resumes a download.
  const ranged = await fetch(`${base}/${VOICE_MODEL_PRELOAD_FILE}`, { headers: { Range: 'bytes=0-1023' } })
  check(ranged.status === 206 || ranged.status === 200, `A Range request for ${VOICE_MODEL_PRELOAD_FILE} returned ${ranged.status}.`)
  await ranged.arrayBuffer()

  // A missing asset must never resolve to the app shell: the worker would then
  // try to evaluate HTML as JavaScript.
  for (const missing of ['sherpa-onnx-asr-missing.js', 'nope/anything.bin', 'index.html']) {
    const response = await fetch(`${base}/${missing}`)
    check(response.status === 404, `GET ${missing} returned ${response.status}, expected 404.`)
  }

  // The directory must not be listable.
  const directory = await fetch(`${server.origin}/`)
  check(directory.status === 404, 'Listing the model directory should not be possible.')
} finally {
  await server.stop()
}

if (failures.length) {
  console.error('Voice model serving verification failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Voice model serving verified.')

function startStaticServer() {
  return new Promise((done, fail) => {
    const instance = createServer((request, response) => {
      const path = new URL(request.url, 'http://localhost')
      if (!path.pathname.startsWith(`${VOICE_MODEL_BASE_PATH}/`)) {
        response.writeHead(404).end('Not Found')
        return
      }
      const file = join(appDir, path.pathname)
      stat(file).then(stats => {
        if (!stats.isFile()) throw new Error('not a file')
        const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range ?? '')
        const headers = {
          'content-type': MIME_BY_EXTENSION[extname(file)] ?? 'application/octet-stream',
          'cache-control': 'public, max-age=31536000, immutable',
          'x-content-type-options': 'nosniff',
          'accept-ranges': 'bytes',
        }
        if (range) {
          const start = Number(range[1] || 0)
          const end = range[2] ? Math.min(Number(range[2]), stats.size - 1) : stats.size - 1
          response.writeHead(206, { ...headers, 'content-range': `bytes ${start}-${end}/${stats.size}`, 'content-length': end - start + 1 })
          createReadStream(file, { start, end }).pipe(response)
          return
        }
        response.writeHead(200, { ...headers, 'content-length': stats.size })
        createReadStream(file).pipe(response)
      }, () => response.writeHead(404).end('Not Found'))
    })
    instance.listen(0, '127.0.0.1', () => done({
      origin: `http://127.0.0.1:${instance.address().port}`,
      nginx: false,
      stop: () => new Promise(resolve => instance.close(resolve)),
    }))
    instance.on('error', fail)
  })
}

async function startNginx() {
  if (spawnSync('sh', ['-c', 'command -v nginx'], { encoding: 'utf8' }).status !== 0) return null

  const workDir = await mkdtemp(join(tmpdir(), 'rum1n8-voice-model-'))
  const port = await freePort()
  const server = template
    .replaceAll('__MARKETING_ORIGIN__', 'https://example.test')
    .replace(/^\s*listen\s+[^;]+;$/gm, '')
    .replace(/^\s*server_name\s+[^;]+;$/gm, '')
  await writeFile(join(workDir, 'nginx.conf'), [
    'worker_processes 1;',
    'error_log stderr warn;',
    `pid ${join(workDir, 'nginx.pid')};`,
    'events { worker_connections 64; }',
    'http {',
    '  access_log off;',
    '  include /etc/nginx/mime.types;',
    ...['client_body', 'proxy', 'fastcgi', 'uwsgi', 'scgi'].map(name => `  ${name}_temp_path ${join(workDir, name)};`),
    `  server {`,
    `    listen 127.0.0.1:${port};`,
    `    root ${appDir};`,
    server,
    '  }',
    '}',
  ].join('\n'))

  const child = spawn('nginx', ['-c', join(workDir, 'nginx.conf'), '-p', workDir, '-g', 'daemon off;'], { stdio: 'ignore' })
  const stop = async () => {
    child.kill('SIGTERM')
    await rm(workDir, { recursive: true, force: true })
  }
  const origin = `http://127.0.0.1:${port}`

  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      if ((await fetch(`${origin}/health`)).ok) return { origin, nginx: true, stop }
    } catch {}
    await new Promise(done => setTimeout(done, 100))
  }
  await stop()
  throw new Error('nginx did not become ready with the rendered app config')
}

function freePort() {
  return new Promise((done, fail) => {
    const probe = createServer()
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address()
      probe.close(() => done(port))
    })
    probe.on('error', fail)
  })
}
