import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('migrateStorage', () => {
  let store

  beforeEach(() => {
    vi.resetModules()
    store = {}
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key) => store[key] ?? null),
      setItem: vi.fn((key, value) => { store[key] = value }),
      removeItem: vi.fn((key) => { delete store[key] }),
    })
  })

  afterEach(() => vi.unstubAllGlobals())

  it.each([true, false])('removes the retired voice setting (%s) without changing other data or timestamps', async (enabled) => {
    const record = {
      appSettings: { voicePracticeEnabled: enabled, requireReferenceTyping: true, futureSetting: 'keep' },
      appSettingsLastModified: '2026-06-20T12:00:00.000Z',
      metadata: 'keep',
    }
    store['rum1n8-app-settings'] = JSON.stringify(record)
    store['rum1n8-verses'] = '[{"id":"keep","reviewHistory":[{"grade":2}]}]'
    store['rum1n8-webdav-settings'] = '{"url":"keep"}'
    const before = { ...store }
    const { migrateStorage } = await import('./migrate-storage.js')

    migrateStorage()
    delete record.appSettings.voicePracticeEnabled
    expect(store).toEqual({ ...before, 'rum1n8-app-settings': JSON.stringify(record) })
    localStorage.setItem.mockClear()
    migrateStorage()
    expect(localStorage.setItem).not.toHaveBeenCalled()
  })

  it('cleans a flat legacy settings record without adding a timestamp', async () => {
    store['rum1n8-app-settings'] = '{"voicePracticeEnabled":true,"analyticsOptOut":true}'
    const { migrateStorage } = await import('./migrate-storage.js')
    migrateStorage()
    expect(JSON.parse(store['rum1n8-app-settings'])).toEqual({ analyticsOptOut: true })
  })

  it.each(['broken json', 'null', '[]', '{"appSettings":null}'])('leaves malformed settings alone: %s', async (stored) => {
    store['rum1n8-app-settings'] = stored
    const { migrateStorage } = await import('./migrate-storage.js')
    expect(() => migrateStorage()).not.toThrow()
    expect(store['rum1n8-app-settings']).toBe(stored)
    expect(localStorage.setItem).not.toHaveBeenCalled()
  })

  it('allows a failed settings cleanup to be retried', async () => {
    store['rum1n8-app-settings'] = '{"voicePracticeEnabled":true}'
    localStorage.setItem.mockImplementationOnce(() => { throw new Error('blocked') })
    const { migrateStorage } = await import('./migrate-storage.js')
    expect(() => migrateStorage()).not.toThrow()
    expect(store['rum1n8-app-settings']).toBe('{"voicePracticeEnabled":true}')
    migrateStorage()
    expect(store['rum1n8-app-settings']).toBe('{}')
  })

  it('migrates all old keys to new keys', async () => {
    store['bible-memory-verses'] = '[{"id":"1"}]'
    store['bible-memory-collections'] = '[]'
    store['bible-memory-webdav-settings'] = '{"url":"https://example.com"}'
    store['bible-memory-sync-state'] = '{"lastSync":null}'
    store['bible-memory-deleted-verses'] = '[]'
    store['bible-memory-deleted-collections'] = '[]'
    store['bible-memory-last-backup'] = '2025-01-01T00:00:00Z'

    const { migrateStorage } = await import('./migrate-storage.js')
    migrateStorage()

    expect(store['rum1n8-verses']).toBe('[{"id":"1"}]')
    expect(store['rum1n8-collections']).toBe('[]')
    expect(store['rum1n8-webdav-settings']).toBe('{"url":"https://example.com"}')
    expect(store['rum1n8-sync-state']).toBe('{"lastSync":null}')
    expect(store['rum1n8-deleted-verses']).toBe('[]')
    expect(store['rum1n8-deleted-collections']).toBe('[]')
    expect(store['rum1n8-last-backup']).toBe('2025-01-01T00:00:00Z')

    // Old keys removed
    expect(store['bible-memory-verses']).toBeUndefined()
    expect(store['bible-memory-collections']).toBeUndefined()
    expect(store['bible-memory-last-backup']).toBeUndefined()
  })

  it('does not overwrite existing new keys', async () => {
    store['bible-memory-verses'] = '[{"id":"old"}]'
    store['rum1n8-verses'] = '[{"id":"new"}]'

    const { migrateStorage } = await import('./migrate-storage.js')
    migrateStorage()

    expect(store['rum1n8-verses']).toBe('[{"id":"new"}]')
    // Old key left alone since new key already existed
    expect(store['bible-memory-verses']).toBe('[{"id":"old"}]')
  })

  it('is a no-op when no old keys exist', async () => {
    const { migrateStorage } = await import('./migrate-storage.js')
    migrateStorage()

    expect(localStorage.setItem).not.toHaveBeenCalled()
    expect(localStorage.removeItem).not.toHaveBeenCalled()
  })

  it('handles partial migration (some old keys present)', async () => {
    store['bible-memory-verses'] = '[]'
    store['bible-memory-last-backup'] = '2025-06-01T00:00:00Z'

    const { migrateStorage } = await import('./migrate-storage.js')
    migrateStorage()

    expect(store['rum1n8-verses']).toBe('[]')
    expect(store['rum1n8-last-backup']).toBe('2025-06-01T00:00:00Z')
    expect(store['bible-memory-verses']).toBeUndefined()
    expect(store['bible-memory-last-backup']).toBeUndefined()
    // Keys that didn't exist in old storage should not exist in new storage
    expect(store['rum1n8-collections']).toBeUndefined()
  })
})

describe('cleanupRetiredVoiceModels', () => {
  beforeEach(() => vi.resetModules())

  it('deletes all retired model versions, including empty/partial caches, and preserves every other cache', async () => {
    const names = [
      'ruminate-voice-model-sherpa-en-v1.13.7',
      'ruminate-voice-model-older',
      'ruminate-voice-model-partial',
      'rum1n8-bible-manifest-v1',
      'rum1n8-bible-text-v1-bsb',
      'workbox-precache-v2-app',
      'google-fonts-cache',
      'unrelated-ruminate-voice-model-test',
    ]
    const caches = { keys: vi.fn(async () => names), delete: vi.fn(async () => true) }
    const { cleanupRetiredVoiceModels } = await import('./migrate-storage.js')
    await cleanupRetiredVoiceModels({ caches })
    expect(caches.delete.mock.calls.map(([name]) => name)).toEqual(names.slice(0, 3))
  })

  it('coalesces concurrent runs, then detects caches recreated by an older tab', async () => {
    let finish
    const caches = {
      keys: vi.fn(() => new Promise(resolve => { finish = resolve })),
      delete: vi.fn(async () => true),
    }
    const { cleanupRetiredVoiceModels } = await import('./migrate-storage.js')
    const first = cleanupRetiredVoiceModels({ caches })
    expect(cleanupRetiredVoiceModels({ caches })).toBe(first)
    await Promise.resolve()
    finish(['ruminate-voice-model-first'])
    await first
    caches.keys.mockResolvedValue(['ruminate-voice-model-recreated'])
    await cleanupRetiredVoiceModels({ caches })
    expect(caches.keys).toHaveBeenCalledTimes(2)
    expect(caches.delete.mock.calls.map(([name]) => name)).toEqual([
      'ruminate-voice-model-first', 'ruminate-voice-model-recreated',
    ])
  })

  it('continues after an individual deletion fails and retries on the next run', async () => {
    const caches = {
      keys: vi.fn(async () => ['ruminate-voice-model-a', 'ruminate-voice-model-b']),
      delete: vi.fn().mockImplementationOnce(() => { throw new Error('blocked') }).mockResolvedValue(true),
    }
    const { cleanupRetiredVoiceModels } = await import('./migrate-storage.js')
    await expect(cleanupRetiredVoiceModels({ caches })).resolves.toBeUndefined()
    expect(caches.delete).toHaveBeenCalledTimes(2)
    await cleanupRetiredVoiceModels({ caches })
    expect(caches.delete).toHaveBeenCalledTimes(4)
  })

  it('handles absent storage, denied access, and enumeration failures without rejecting', async () => {
    const { cleanupRetiredVoiceModels } = await import('./migrate-storage.js')
    await expect(cleanupRetiredVoiceModels({})).resolves.toBeUndefined()
    await expect(cleanupRetiredVoiceModels({ get caches() { throw new Error('denied') } })).resolves.toBeUndefined()
    const caches = { keys: vi.fn().mockRejectedValueOnce(new Error('blocked')).mockResolvedValue([]), delete: vi.fn() }
    await expect(cleanupRetiredVoiceModels({ caches })).resolves.toBeUndefined()
    await cleanupRetiredVoiceModels({ caches })
    expect(caches.keys).toHaveBeenCalledTimes(2)
    expect(caches.delete).not.toHaveBeenCalled()
  })
})
