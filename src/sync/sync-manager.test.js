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

describe('synced review schedules', () => {
  let store
  beforeEach(() => {
    vi.resetModules()
    store = {}
    vi.stubGlobal('localStorage', {
      getItem: key => store[key] ?? null,
      setItem: (key, value) => { store[key] = value },
      removeItem: key => { delete store[key] },
    })
  })

  async function cappedVerse() {
    const { addReviewDays, reconcileReviewSchedule } = await import('../review-schedule.js')
    const anchor = new Date(2026, 6, 1, 12)
    const verse = {
      id: 'v', memorizationStatus: 'mastered', interval: 90, reviewCount: 10, easeFactor: 2.5,
      lastReviewed: anchor.toISOString(), lastModified: anchor.toISOString(),
      nextReviewDate: addReviewDays(anchor, 90), collectionIds: [],
    }
    reconcileReviewSchedule(verse, 30, anchor)
    return verse
  }

  it('uses merged settings to restore earned spacing and keeps repeated merges stable', async () => {
    const local = await cappedVerse()
    store['rum1n8-app-settings'] = JSON.stringify({
      appSettings: { reviewMode: 'rotation', maxReviewIntervalDays: 30 }, appSettingsLastModified: '2026-08-01T00:00:00Z',
    })
    const remote = {
      verses: [structuredClone(local)], collections: [],
      appSettings: { reviewMode: 'rotation', maxReviewIntervalDays: 90 }, appSettingsLastModified: '2026-08-02T00:00:00Z',
    }
    const { mergeData } = await import('./sync-manager.js')
    const merged = mergeData([local], [], remote)
    expect(merged.verses[0]).toMatchObject({ interval: 90, reviewSchedule: { earnedInterval: 90 } })
    expect(local.interval).toBe(30)
    expect(remote.verses[0].interval).toBe(30)
    const repeated = mergeData(merged.verses, [], { ...remote, verses: merged.verses })
    expect(repeated.verses).toEqual(merged.verses)
  })

  it('preserves metadata over a legacy interval tiebreaker, regardless of which side has it', async () => {
    const capped = await cappedVerse()
    const legacy = { ...capped, interval: 90, nextReviewDate: '2026-09-29T12:00:00Z' }
    delete legacy.reviewSchedule
    const { resolveVerseConflict } = await import('./sync-manager.js')
    expect(resolveVerseConflict(capped, legacy).useRemote).toBe(false)
    expect(resolveVerseConflict(legacy, capped).useRemote).toBe(true)
  })

  it('a newer real review wins over older earned-spacing metadata', async () => {
    const local = await cappedVerse()
    store['rum1n8-app-settings'] = JSON.stringify({
      appSettings: { maxReviewIntervalDays: 90 }, appSettingsLastModified: '2026-08-01T00:00:00Z',
    })
    const remoteVerse = {
      ...local, interval: 7, lastReviewed: '2026-07-10T12:00:00Z', lastModified: '2026-07-10T12:00:00Z',
      nextReviewDate: '2026-07-17T12:00:00Z',
    }
    delete remoteVerse.reviewSchedule
    const { mergeData } = await import('./sync-manager.js')
    const merged = mergeData([local], [], { verses: [remoteVerse], collections: [] })
    expect(merged.verses[0]).toMatchObject({ interval: 7, reviewSchedule: { earnedInterval: 7 } })
  })
})
