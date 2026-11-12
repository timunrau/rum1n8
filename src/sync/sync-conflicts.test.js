import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addReviewDays, applyReviewFrequencyOverride, reconcileReviewSchedule } from '../review-schedule.js'
import { mergeData, resolveVerseConflict } from './sync-manager.js'

const now = new Date('2026-11-12T12:00:00.000Z')
const date = days => addReviewDays(now, days)
const verse = (overrides = {}) => ({
  id: 'v', reference: 'John 3:16', content: 'For God', bibleVersion: 'BSB',
  memorizationStatus: 'mastered', createdAt: date(-100), masteredAt: date(-90),
  lastModified: date(-10), lastReviewed: date(-10), nextReviewDate: date(20),
  interval: 30, easeFactor: 2.5, reviewCount: 10, reviewHistory: [], collectionIds: [],
  ...overrides,
})

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(now)
  const store = {}
  vi.stubGlobal('localStorage', {
    getItem: key => store[key] ?? null,
    setItem: (key, value) => { store[key] = value },
    removeItem: key => { delete store[key] },
  })
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

// Run both directions: the same action must win on either device.
function expectWinner(older, newer) {
  expect(resolveVerseConflict(older, newer).useRemote).toBe(true)
  expect(resolveVerseConflict(newer, older).useRemote).toBe(false)
  for (const [local, remote] of [[older, newer], [newer, older]]) {
    const result = mergeData([local], [], { verses: [remote], collections: [] })
    expect(result.verses[0]).toMatchObject(newer)
    expect(mergeData(result.verses, [], { ...result }).verses).toEqual(result.verses)
  }
}

describe('existing conflict-resolution guarantees', () => {
  it.each([1, 7, 60])('the newer real review wins even when its interval is %i days', interval => {
    expectWinner(verse(), verse({ lastReviewed: date(-1), lastModified: date(-1), interval, nextReviewDate: date(interval - 1) }))
  })
  it('a stale content edit cannot replace a newer review or its first-attempt result', () => {
    const staleEdit = verse({ content: 'Edited on another device', lastModified: date(0) })
    const reviewed = verse({ lastReviewed: date(-1), lastModified: date(-1), interval: 1,
      nextReviewDate: date(0), lastGrade: 0, lastAccuracy: '0.0', reviewHistory: [{ date: date(-1), grade: 0 }] })
    expectWinner(staleEdit, reviewed)
  })
  it.each(['unmemorized', 'learned', 'memorized', undefined])('editing an old unreviewed %s copy is not a reset of newer remote progress', memorizationStatus => {
    const edited = verse({ memorizationStatus, lastReviewed: null, masteredAt: null,
      lastModified: date(0), interval: 0, nextReviewDate: null, reviewCount: 0 })
    expectWinner(edited, verse({ lastReviewed: date(-1), lastModified: date(-1) }))
  })
  it('newer edits win when the review dates are equal', () => {
    expectWinner(verse(), verse({ content: 'Edited text', lastModified: date(-1) }))
  })
  it('newer edits win for unreviewed verses', () => {
    expectWinner(verse({ lastReviewed: null }), verse({ lastReviewed: null, lastModified: date(-1) }))
  })
  it('uses createdAt when legacy records have no lastModified', () => {
    expectWinner(verse({ lastReviewed: null, lastModified: null, createdAt: date(-20) }),
      verse({ lastReviewed: null, lastModified: null, createdAt: date(-10) }))
  })
  it('preserves the reversible schedule instead of a legacy longer-interval tie', () => {
    const capped = verse({ interval: 90, nextReviewDate: date(80) })
    const legacy = structuredClone(capped)
    reconcileReviewSchedule(capped, 30, now)
    expect(resolveVerseConflict(legacy, capped).useRemote).toBe(true)
    expect(resolveVerseConflict(capped, legacy).useRemote).toBe(false)
  })
  it('keeps local on exact ties and uses a longer interval only as the last tiebreaker', () => {
    expect(resolveVerseConflict(verse(), verse()).useRemote).toBe(false)
    expect(resolveVerseConflict(verse(), verse({ interval: 60 })).useRemote).toBe(true)
    expect(resolveVerseConflict(verse({ interval: 60 }), verse()).useRemote).toBe(false)
  })
  it('accepts ordinary small clock drift within one hour', () => {
    expect(resolveVerseConflict(verse(), verse({ lastReviewed: new Date(+now + 30 * 60000).toISOString() })).useRemote).toBe(true)
  })
})

describe('explicit scheduling actions across devices', () => {
  it.each(['unmemorized', 'learned', 'memorized'])('a newer reset/progression to %s survives an older reviewed copy', memorizationStatus => {
    expectWinner(verse(), verse({ memorizationStatus, lastReviewed: null, lastModified: date(0), reviewScheduleModifiedAt: date(0),
      nextReviewDate: null, interval: 0, reviewCount: 0, masteredAt: null, reviewHistory: [] }))
  })
  it('a verse mastered again after reset survives the pre-reset review', () => {
    expectWinner(verse(), verse({ lastReviewed: null, lastModified: date(0), masteredAt: date(0),
      nextReviewDate: date(1), interval: 0, reviewCount: 0 }))
  })
  it.each([0, 1, 7, 60])('a newer manual %i-day override wins despite older review history', days => {
    const manual = verse({ lastReviewed: date(-20) })
    applyReviewFrequencyOverride(manual, days, now)
    expectWinner(verse(), manual)
  })
  it.each([0, 7])('a real review after a manual %i-day override wins', days => {
    const manual = verse()
    applyReviewFrequencyOverride(manual, days, new Date(date(-2)))
    expectWinner(manual, verse({ lastReviewed: date(-1), lastModified: date(-1), interval: 1, nextReviewDate: date(0) }))
  })
  it('a real review after a reset wins', () => {
    expectWinner(verse({ memorizationStatus: 'unmemorized', lastReviewed: null, lastModified: date(-2), nextReviewDate: null, interval: 0 }),
      verse({ lastReviewed: date(-1), lastModified: date(-1) }))
  })
  it('undoing a synced reset restores the schedule even though lastReviewed becomes older again', () => {
    const reset = verse({ memorizationStatus: 'unmemorized', lastReviewed: null, lastModified: date(-1),
      interval: 0, nextReviewDate: null, masteredAt: null, reviewCount: 0 })
    expectWinner(reset, verse({ lastModified: date(0), reviewScheduleModifiedAt: date(0) }))
  })
  it('undoing an override is a newer action than the override being undone', () => {
    const manual = verse()
    applyReviewFrequencyOverride(manual, 1, new Date(date(-1)))
    expectWinner(manual, verse({ lastModified: date(0), reviewScheduleModifiedAt: date(0) }))
  })
  it('a content edit after an override does not give that old override priority over a later review', () => {
    const manual = verse()
    applyReviewFrequencyOverride(manual, 7, new Date(date(-3)))
    manual.lastModified = date(0)
    expectWinner(manual, verse({ lastReviewed: date(-1), lastModified: date(-1) }))
  })
  it('an initialized legacy anchor does not pretend to be a newer manual change', () => {
    const legacy = verse({ nextReviewDate: date(25), lastModified: date(0) })
    reconcileReviewSchedule(legacy, 90, now)
    expectWinner(legacy, verse({ lastReviewed: date(-1), lastModified: date(-1) }))
  })
})

describe('clock skew cannot undo a legitimate schedule', () => {
  it.each([1, 30, 90])('rejects a remote record ten days in the future with interval %i', interval => {
    const local = verse({ interval: 7, lastReviewed: date(0), lastModified: date(0), nextReviewDate: date(7) })
    const remote = verse({ interval, lastReviewed: date(10), lastModified: date(10) })
    expect(resolveVerseConflict(local, remote).useRemote).toBe(false)
  })
  it('checks a future edit timestamp even when lastReviewed looks valid', () => {
    expect(resolveVerseConflict(verse(), verse({ lastModified: date(10) })).useRemote).toBe(false)
  })
  it('recovers from a future-dated local copy using a trustworthy remote copy', () => {
    expect(resolveVerseConflict(verse({ lastReviewed: date(10), lastModified: date(10) }), verse()).useRemote).toBe(true)
  })
  it('does not guess progress when both copies have implausible future timestamps', () => {
    expect(resolveVerseConflict(verse({ lastReviewed: date(10) }), verse({ lastReviewed: date(20), interval: 90 })).useRemote).toBe(false)
  })
})

describe('merge, deletion, and convergence', () => {
  it.each([null, {}, { verses: [], collections: [] }])('retains local data when the remote has no library (%j)', remote => {
    expect(mergeData([verse()], [], remote).verses[0]).toMatchObject(verse())
  })
  it('combines additions from both devices, without duplicates or input mutation', () => {
    const local = [verse(), verse({ id: 'local-only' })]
    const remote = { verses: [verse(), verse({ id: 'remote-only' })], collections: [] }
    const originals = structuredClone({ local, remote })
    const result = mergeData(local, [], remote)
    expect(result.verses.map(v => v.id).sort()).toEqual(['local-only', 'remote-only', 'v'])
    expect({ local, remote }).toEqual(originals)
    expect(mergeData(result.verses, [], result).verses).toEqual(result.verses)
  })
  it.each(['local', 'remote'])('honors %s verse and collection deletions over stale live copies', side => {
    const tombstones = { deletedVerses: [{ id: 'v', deletedAt: date(-1) }], deletedCollections: [{ id: 'parent', deletedAt: date(-1) }] }
    if (side === 'local') {
      localStorage.setItem('rum1n8-deleted-verses', JSON.stringify(tombstones.deletedVerses))
      localStorage.setItem('rum1n8-deleted-collections', JSON.stringify(tombstones.deletedCollections))
    }
    const parent = { id: 'parent', name: 'Parent', parentId: null }
    const child = { id: 'child', name: 'Child', parentId: 'parent' }
    const result = mergeData([verse(), verse({ id: 'keep', collectionIds: ['parent', 'child'] })], [parent, child], {
      verses: [verse()], collections: [parent, child], ...(side === 'remote' ? tombstones : {}),
    })
    expect(result.verses.map(v => v.id)).toEqual(['keep'])
    expect(result.verses[0].collectionIds).toEqual(['child'])
    expect(result.collections).toEqual([{ ...child, parentId: null }])
  })
  it('retains the latest deletion timestamp from either side', () => {
    localStorage.setItem('rum1n8-deleted-verses', JSON.stringify([{ id: 'a', deletedAt: date(-1) }, { id: 'b', deletedAt: date(-2) }]))
    mergeData([], [], { verses: [], collections: [], deletedVerses: [{ id: 'a', deletedAt: date(-2) }, { id: 'b', deletedAt: date(-1) }] })
    expect(JSON.parse(localStorage.getItem('rum1n8-deleted-verses'))).toEqual([{ id: 'a', deletedAt: date(-1) }, { id: 'b', deletedAt: date(-1) }])
  })
  it('accepts legacy string deletion lists', () => {
    expect(mergeData([verse()], [], { verses: [verse()], collections: [], deletedVerses: ['v'] }).verses).toEqual([])
  })
  it.each(['local', 'remote'])('preserves the %s newer collection edit', side => {
    const older = { id: 'c', name: 'Old', description: '', parentId: null, createdAt: date(-10), lastModified: date(-10) }
    const newer = { ...older, name: 'New', lastModified: date(-1) }
    expect(mergeData([], [side === 'local' ? newer : older], { verses: [], collections: [side === 'remote' ? newer : older] }).collections).toEqual([newer])
  })
  it.each([1, 30, 90, 365])('applies the newer synced %i-day maximum without changing review history', maximum => {
    const source = verse({ interval: 90, nextReviewDate: date(80), reviewHistory: [{ date: date(-10), grade: 5 }] })
    localStorage.setItem('rum1n8-app-settings', JSON.stringify({ appSettings: { maxReviewIntervalDays: 30 }, appSettingsLastModified: date(-2) }))
    const result = mergeData([source], [], { verses: [], collections: [], appSettings: { maxReviewIntervalDays: maximum }, appSettingsLastModified: date(-1) })
    expect(result.verses[0].interval).toBe(Math.min(90, maximum))
    expect(result.verses[0].reviewSchedule.earnedInterval).toBe(90)
    expect(result.verses[0].reviewHistory).toEqual(source.reviewHistory)
    expect(result.verses[0].lastModified).toBe(source.lastModified)
  })
})
