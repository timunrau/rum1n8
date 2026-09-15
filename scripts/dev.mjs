import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'

const sharedEnv = {
  ...process.env,
  VITE_APP_URL: 'http://127.0.0.1:5173/app/',
  VITE_MARKETING_URL: 'http://127.0.0.1:5174/',
}

const definitions = [
  { label: 'APP', command: process.execPath, args: ['node_modules/vite/bin/vite.js', '--config', 'vite.app.config.js'] },
  { label: 'SITE', command: process.execPath, args: ['node_modules/vite/bin/vite.js', '--config', 'vite.site.config.js'] },
  { label: 'PROXY', command: process.execPath, args: ['proxy-server.js'] },
]

const children = new Set()
let shuttingDown = false

function prefixOutput(stream, label, target) {
  const lines = createInterface({ input: stream })
  lines.on('line', (line) => target.write(`[${label}] ${line}\n`))
}

function stopAll(signal = 'SIGTERM') {
  if (shuttingDown) return
  shuttingDown = true
  for (const child of children) {
    if (!child.killed) child.kill(signal)
  }
}

for (const definition of definitions) {
  const child = spawn(definition.command, definition.args, {
    env: sharedEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  children.add(child)
  prefixOutput(child.stdout, definition.label, process.stdout)
  prefixOutput(child.stderr, definition.label, process.stderr)

  child.on('error', (error) => {
    console.error(`[${definition.label}] Failed to start: ${error.message}`)
    process.exitCode = 1
    stopAll()
  })
  child.on('exit', (code, signal) => {
    children.delete(child)
    if (!shuttingDown) {
      console.error(`[${definition.label}] Exited unexpectedly (${signal || code}).`)
      process.exitCode = code || 1
      stopAll()
    }
    if (children.size === 0) process.exit()
  })
}

console.log('App:       \u001b]8;;http://127.0.0.1:5173/app/\u0007http://127.0.0.1:5173/app/\u001b]8;;\u0007')
console.log('Marketing: \u001b]8;;http://127.0.0.1:5174/\u0007http://127.0.0.1:5174/\u001b]8;;\u0007')
console.log('WebDAV:    http://127.0.0.1:3001/health')

process.once('SIGINT', () => stopAll('SIGINT'))
process.once('SIGTERM', () => stopAll('SIGTERM'))
