import { describe, it, expect, beforeEach, vi } from 'vitest'
import { resolveVerseConflict } from './webdav-sync.js'

describe('resolveVerseConflict', () => {
  const base = {
    id: '1',
    reference: 'Psalm 23:1',
    content: 'The LORD is my shepherd',
    interval: 7,
    lastReviewed: null,
    lastModified: null,
    createdAt: null,
  }

  function verse(overrides) {
    return { ...base, ...overrides }
  }

  it('picks remote when remote has newer lastReviewed', () => {
    const local = verse({ lastReviewed: '2025-01-01T00:00:00Z' })
    const remote = verse({ lastReviewed: '2025-01-02T00:00:00Z' })
    const { useRemote } = resolveVerseConflict(local, remote)
    expect(useRemote).toBe(true)
  })

  it('keeps local when local has newer lastReviewed', () => {
    const local = verse({ lastReviewed: '2025-01-03T00:00:00Z' })
    const remote = verse({ lastReviewed: '2025-01-02T00:00:00Z' })
    const { useRemote } = resolveVerseConflict(local, remote)
    expect(useRemote).toBe(false)
  })

  it('picks remote when remote has lastReviewed and local does not', () => {
    const local = verse({ lastReviewed: null })
    const remote = verse({ lastReviewed: '2025-01-02T00:00:00Z' })
    const { useRemote } = resolveVerseConflict(local, remote)
    expect(useRemote).toBe(true)
  })

  it('keeps local when local has lastReviewed and remote does not', () => {
    const local = verse({ lastReviewed: '2025-01-02T00:00:00Z' })
    const remote = verse({ lastReviewed: null })
    const { useRemote } = resolveVerseConflict(local, remote)
    expect(useRemote).toBe(false)
  })

  it('falls back to lastModified when neither has lastReviewed', () => {
    const local = verse({ lastModified: '2025-01-01T00:00:00Z' })
    const remote = verse({ lastModified: '2025-01-02T00:00:00Z' })
    const { useRemote } = resolveVerseConflict(local, remote)
    expect(useRemote).toBe(true)
  })

  it('keeps local when lastModified is newer on local and no lastReviewed', () => {
    const local = verse({ lastModified: '2025-01-03T00:00:00Z' })
    const remote = verse({ lastModified: '2025-01-02T00:00:00Z' })
    const { useRemote } = resolveVerseConflict(local, remote)
    expect(useRemote).toBe(false)
  })

  it('uses interval as tiebreaker when timestamps are equal', () => {
    const ts = '2025-01-02T00:00:00Z'
    const local = verse({ lastReviewed: ts, interval: 7 })
    const remote = verse({ lastReviewed: ts, interval: 14 })
    const { useRemote } = resolveVerseConflict(local, remote)
    expect(useRemote).toBe(true)
  })

  it('keeps local when timestamps equal and intervals equal', () => {
    const ts = '2025-01-02T00:00:00Z'
    const local = verse({ lastReviewed: ts, interval: 7 })
    const remote = verse({ lastReviewed: ts, interval: 7 })
    const { useRemote } = resolveVerseConflict(local, remote)
    expect(useRemote).toBe(false)
  })

  it('rejects remote with future timestamp (>1hr ahead)', () => {
    const futureDate = new Date(Date.now() + 10 * 86400000).toISOString()
    const local = verse({ lastReviewed: new Date().toISOString(), interval: 14 })
    const remote = verse({ lastReviewed: futureDate, interval: 14 })
    const { useRemote } = resolveVerseConflict(local, remote)
    expect(useRemote).toBe(false)
  })

  it('accepts remote with future timestamp when remote has strictly more progress', () => {
    const futureDate = new Date(Date.now() + 10 * 86400000).toISOString()
    const local = verse({ lastReviewed: new Date().toISOString(), interval: 7 })
    const remote = verse({ lastReviewed: futureDate, interval: 14 })
    const { useRemote } = resolveVerseConflict(local, remote)
    expect(useRemote).toBe(true)
  })

  it('keeps local when both have no timestamps and no intervals', () => {
    const local = verse({})
    const remote = verse({})
    const { useRemote } = resolveVerseConflict(local, remote)
    expect(useRemote).toBe(false)
  })

  it('falls back to createdAt when lastModified is missing', () => {
    const local = verse({ createdAt: '2025-01-01T00:00:00Z' })
    const remote = verse({ createdAt: '2025-01-03T00:00:00Z' })
    const { useRemote } = resolveVerseConflict(local, remote)
    expect(useRemote).toBe(true)
  })

  it('regression: future remote does not overwrite local with same interval', () => {
    // This was the Luke 11:9-13 bug
    const yesterday = new Date(Date.now() - 86400000).toISOString()
    const futureDate = new Date(Date.now() + 10 * 86400000).toISOString()
    const local = verse({ lastReviewed: yesterday, interval: 14 })
    const remote = verse({ lastReviewed: futureDate, interval: 14 })
    const { useRemote } = resolveVerseConflict(local, remote)
    expect(useRemote).toBe(false)
  })
})

describe('mergeData (via localStorage mock)', () => {
  // mergeData is not exported, but we can test it indirectly through syncData
  // or we can test the deletion list helpers directly

  beforeEach(() => {
    // Mock localStorage
    const store = {}
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key) => store[key] ?? null),
      setItem: vi.fn((key, value) => { store[key] = value }),
      removeItem: vi.fn((key) => { delete store[key] }),
    })
  })

  it('migrateDeletionList: handles old string[] format', async () => {
    // Seed old-format deletion list
    localStorage.setItem('rum1n8-deleted-verses', JSON.stringify(['id-1', 'id-2']))

    const { getDeletedVerses, getDeletedVerseEntries } = await import('./webdav-sync.js')
    const ids = getDeletedVerses()
    expect(ids).toEqual(['id-1', 'id-2'])

    const entries = getDeletedVerseEntries()
    expect(entries).toHaveLength(2)
    expect(entries[0]).toHaveProperty('id', 'id-1')
    expect(entries[0]).toHaveProperty('deletedAt')
  })

  it('migrateDeletionList: handles new {id, deletedAt}[] format', async () => {
    const now = new Date().toISOString()
    localStorage.setItem('rum1n8-deleted-verses', JSON.stringify([
      { id: 'id-1', deletedAt: now },
    ]))

    const { getDeletedVerses } = await import('./webdav-sync.js')
    expect(getDeletedVerses()).toEqual(['id-1'])
  })

  it('markVerseDeleted adds entry with timestamp', async () => {
    const { markVerseDeleted, getDeletedVerseEntries } = await import('./webdav-sync.js')
    markVerseDeleted('v-1')
    const entries = getDeletedVerseEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0].id).toBe('v-1')
    expect(entries[0].deletedAt).toBeTruthy()
  })

  it('markVerseDeleted is idempotent', async () => {
    const { markVerseDeleted, getDeletedVerseEntries } = await import('./webdav-sync.js')
    markVerseDeleted('v-1')
    markVerseDeleted('v-1')
    expect(getDeletedVerseEntries()).toHaveLength(1)
  })
})
