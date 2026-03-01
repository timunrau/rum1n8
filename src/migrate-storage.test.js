import { describe, it, expect, beforeEach, vi } from 'vitest'

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
