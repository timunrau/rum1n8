import { spawn } from 'node:child_process'
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('../', import.meta.url))
const devDistDir = fileURLToPath(new URL('../dev-dist/', import.meta.url))
const playwrightCli = fileURLToPath(
  new URL('../node_modules/@playwright/test/cli.js', import.meta.url)
)

async function snapshotDirectory(dir) {
  const files = new Map()

  async function walk(currentDir) {
    let entries
    try {
      entries = await readdir(currentDir, { withFileTypes: true })
    } catch (error) {
      if (error.code === 'ENOENT') return false
      throw error
    }

    for (const entry of entries) {
      const entryPath = `${currentDir}/${entry.name}`
      if (entry.isDirectory()) {
        await walk(entryPath)
      } else if (entry.isFile()) {
        files.set(relative(dir, entryPath), await readFile(entryPath))
      }
    }

    return true
  }

  const existed = await walk(dir)
  return { existed, files }
}

async function restoreDirectory(dir, snapshot) {
  await rm(dir, { force: true, recursive: true })

  if (!snapshot.existed) return

  for (const [filePath, contents] of snapshot.files) {
    const targetPath = `${dir}/${filePath}`
    await mkdir(dirname(targetPath), { recursive: true })
    await writeFile(targetPath, contents)
  }
}

async function runPlaywright(args) {
  let child

  const forwardSignal = (signal) => {
    if (child && !child.killed) {
      child.kill(signal)
    }
  }

  const forwardSigint = () => forwardSignal('SIGINT')
  const forwardSigterm = () => forwardSignal('SIGTERM')

  process.once('SIGINT', forwardSigint)
  process.once('SIGTERM', forwardSigterm)

  try {
    return await new Promise((resolve, reject) => {
      child = spawn(process.execPath, [playwrightCli, 'test', ...args], {
        cwd: repoRoot,
        stdio: 'inherit',
      })

      child.on('error', reject)
      child.on('close', (code, signal) => {
        if (signal) {
          resolve(1)
          return
        }

        resolve(code ?? 1)
      })
    })
  } finally {
    process.removeListener('SIGINT', forwardSigint)
    process.removeListener('SIGTERM', forwardSigterm)
  }
}

const devDistSnapshot = await snapshotDirectory(devDistDir)
let exitCode = 1

try {
  exitCode = await runPlaywright(process.argv.slice(2))
} finally {
  await restoreDirectory(devDistDir, devDistSnapshot)
}

process.exitCode = exitCode
