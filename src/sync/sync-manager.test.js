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

  it('cleans collection parent links when the parent is deleted remotely', async () => {
    const { mergeData } = await import('./sync-manager.js')

    const result = mergeData([], [
      {
        id: 'child',
        name: 'Child',
        description: '',
        parentId: 'parent',
        createdAt: '2026-04-09T09:30:00.000Z',
        lastModified: '2026-04-09T09:30:00.000Z'
      }
    ], {
      verses: [],
      collections: [],
      deletedVerses: [],
      deletedCollections: [
        { id: 'parent', deletedAt: '2026-04-10T09:30:00.000Z' }
      ]
    })

    expect(result.collections).toEqual([
      {
        id: 'child',
        name: 'Child',
        description: '',
        parentId: null,
        createdAt: '2026-04-09T09:30:00.000Z',
        lastModified: '2026-04-09T09:30:00.000Z'
      }
    ])
  })

  it('repairs synced hierarchy cycles and duplicate siblings without dropping data', async () => {
    const { mergeData } = await import('./sync-manager.js')

    const result = mergeData([], [
      {
        id: 'a', name: 'Humility', description: '', parentId: 'b',
        createdAt: '2026-04-08T00:00:00.000Z', lastModified: '2026-04-08T00:00:00.000Z'
      },
      {
        id: 'b', name: 'Work', description: '', parentId: 'a',
        createdAt: '2026-04-09T00:00:00.000Z', lastModified: '2026-04-09T00:00:00.000Z'
      },
      {
        id: 'duplicate', name: 'humility', description: '', parentId: null,
        createdAt: '2026-04-10T00:00:00.000Z', lastModified: '2026-04-10T00:00:00.000Z'
      },
    ], {
      verses: [],
      collections: [],
      deletedVerses: [],
      deletedCollections: [],
    })

    expect(result.collections).toHaveLength(3)
    expect(result.collections.find(collection => collection.id === 'a').parentId).toBeNull()
    expect(result.collections.find(collection => collection.id === 'b').parentId).toBe('a')
    expect(result.collections.find(collection => collection.id === 'duplicate').name).toBe('humility (2)')
    expect(result.collectionRepairs.map(repair => repair.type)).toEqual(
      expect.arrayContaining(['cycle', 'duplicate-name'])
    )
  })
})
