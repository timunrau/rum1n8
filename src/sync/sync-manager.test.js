import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('sync deletion tracking', () => {
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

  it('keeps a recent local tombstone even when the verse is already gone on both sides', async () => {
    store['rum1n8-deleted-verses'] = JSON.stringify([
      { id: 'verse-1', deletedAt: '2026-04-10T12:00:00.000Z' }
    ])

    const { mergeData, getDeletedVerseEntries } = await import('./sync-manager.js')

    const result = mergeData([], [], {
      verses: [],
      collections: [],
      deletedVerses: [],
      deletedCollections: []
    })

    expect(result.verses).toEqual([])
    expect(getDeletedVerseEntries()).toEqual([
      { id: 'verse-1', deletedAt: '2026-04-10T12:00:00.000Z' }
    ])
  })

  it('imports remote delete tombstones into local sync state', async () => {
    const { mergeData, getDeletedVerseEntries } = await import('./sync-manager.js')

    const result = mergeData([], [], {
      verses: [],
      collections: [],
      deletedVerses: [
        { id: 'verse-2', deletedAt: '2026-04-09T09:30:00.000Z' }
      ],
      deletedCollections: []
    })

    expect(result.verses).toEqual([])
    expect(getDeletedVerseEntries()).toEqual([
      { id: 'verse-2', deletedAt: '2026-04-09T09:30:00.000Z' }
    ])
  })
})
