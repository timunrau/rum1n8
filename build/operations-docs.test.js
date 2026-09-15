import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const compose = readFileSync(new URL('../docker-compose.yml', import.meta.url), 'utf8')
const appDockerfile = readFileSync(new URL('../Dockerfile.app', import.meta.url), 'utf8')
const siteDockerfile = readFileSync(new URL('../Dockerfile.site', import.meta.url), 'utf8')
const cutover = readFileSync(new URL('../docs/domain-split-cutover.md', import.meta.url), 'utf8')
const hosting = readFileSync(new URL('../docs/hosting.md', import.meta.url), 'utf8')

describe('deployment operations documentation', () => {
  it('uses the Compose service name for proxy operations', () => {
    expect(compose).toContain('  webdav-proxy:')
    expect(cutover).not.toMatch(/^docker compose .*rum1n8-proxy/m)
    expect(hosting).toContain('docker compose logs -f webdav-proxy')
  })

  it('keeps one-time migration instructions out of persistent hosting notes', () => {
    expect(hosting.toLowerCase()).not.toContain('cutover')
    expect(hosting.toLowerCase()).not.toContain('domain split')
  })

  it('uses a simple, reversible Compose replacement', () => {
    const stop = cutover.indexOf('docker compose down')
    const replace = cutover.indexOf('git pull --ff-only')
    const start = cutover.indexOf('docker compose up -d')

    expect(cutover).toContain('cp docker-compose.yml docker-compose.before-domain-cutover.yml')
    expect(stop).toBeGreaterThan(-1)
    expect(replace).toBeGreaterThan(stop)
    expect(start).toBeGreaterThan(replace)
    expect(cutover).toContain('cp docker-compose.before-domain-cutover.yml docker-compose.yml')
    expect(cutover).not.toContain('docker stop rum1n8')
    expect(cutover).not.toContain('docker rm rum1n8')
  })

  it('probes Nginx over IPv4 so Alpine health checks match its listen socket', () => {
    for (const deploymentFile of [compose, appDockerfile, siteDockerfile]) {
      expect(deploymentFile).toContain('http://127.0.0.1/health')
      expect(deploymentFile).not.toContain('http://localhost/health')
    }
  })
})
