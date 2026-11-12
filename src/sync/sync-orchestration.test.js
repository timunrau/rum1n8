import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getProvider } from './providers/index.js'
import { getAppSettingsRecord } from '../app-settings.js'
import { getSyncState, markVerseDeleted, markCollectionDeleted, unmarkVersesDeleted, syncData,
  getActiveProviderId, setActiveProviderId, migrateProviderSetting, isSyncConfigured, mapSyncError } from './sync-manager.js'

const now = new Date('2026-11-12T12:00:00Z')
const yesterday = '2026-11-11T12:00:00.000Z'
const verse = { id: 'v', reference: 'John 3:16', content: 'For God', memorizationStatus: 'mastered', interval: 7,
  lastReviewed: yesterday, lastModified: yesterday, nextReviewDate: '2026-11-18T12:00:00.000Z', collectionIds: [] }
let store

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(now)
  store = {}
  vi.stubGlobal('localStorage', { getItem: key => store[key] ?? null, setItem: (key, value) => { store[key] = value }, removeItem: key => { delete store[key] } })
})
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); vi.unstubAllGlobals() })

describe('provider selection and deletion state', () => {
  it('does not make network calls without an active provider', async () => {
    expect(await syncData([verse], [])).toMatchObject({ success: false, error: 'No sync provider configured' })
    expect(isSyncConfigured()).toBe(false)
    expect(getSyncState()).toEqual({ lastSync: null, lastStatus: null, lastError: null })
  })
  it('migrates legacy WebDAV once without replacing an explicitly selected provider', () => {
    store['rum1n8-webdav-settings'] = '{}'
    migrateProviderSetting()
    expect(getActiveProviderId()).toBe('webdav')
    setActiveProviderId('gdrive')
    migrateProviderSetting()
    expect(getActiveProviderId()).toBe('gdrive')
    setActiveProviderId(null)
    expect(getActiveProviderId()).toBeNull()
  })
  it('deduplicates delete actions and supports undo without clearing other tombstones', () => {
    markVerseDeleted('v'); markVerseDeleted('v'); markVerseDeleted('other')
    markCollectionDeleted('c'); markCollectionDeleted('c')
    unmarkVersesDeleted(['v'])
    expect(JSON.parse(store['rum1n8-deleted-verses'])).toEqual([{ id: 'other', deletedAt: now.toISOString() }])
    expect(JSON.parse(store['rum1n8-deleted-collections'])).toHaveLength(1)
  })
  it('recovers unreadable sync-status storage', () => {
    store['rum1n8-sync-state'] = 'invalid'
    expect(getSyncState()).toEqual({ lastSync: null, lastStatus: null, lastError: null })
  })
})

for (const providerId of ['webdav', 'gdrive']) {
  describe(`${providerId} orchestration contract`, () => {
    let provider, settings, download, upload
    beforeEach(() => {
      setActiveProviderId(providerId)
      provider = getProvider(providerId)
      settings = { test: 'synthetic settings' }
      vi.spyOn(provider, 'getSettings').mockReturnValue(settings)
      download = vi.spyOn(provider, 'download').mockResolvedValue({ data: { verses: [], collections: [] } })
      upload = vi.spyOn(provider, 'upload').mockResolvedValue(undefined)
      if (provider.ensureReady) vi.spyOn(provider, 'ensureReady').mockResolvedValue(undefined)
    })
    it('reports missing configuration without downloading or uploading', async () => {
      provider.getSettings.mockReturnValue(null)
      expect(await syncData([verse], [])).toMatchObject({ success: false })
      expect(download).not.toHaveBeenCalled()
      expect(upload).not.toHaveBeenCalled()
    })
    it('uploads a local library when the remote file does not exist', async () => {
      download.mockResolvedValue({ data: null })
      const source = structuredClone([verse])
      const result = await syncData(source, [])
      expect(result).toMatchObject({ success: true, action: 'uploaded', verses: [verse] })
      expect(upload).toHaveBeenCalledExactlyOnceWith(settings, result.verses, [], null, expect.objectContaining({ appSettings: result.appSettings }))
      expect(source).toEqual([verse])
      expect(getSyncState()).toMatchObject({ lastStatus: 'success', lastSync: now.toISOString(), providerId })
    })
    it('merges both libraries and uploads the exact schedule, history, and settings it returns', async () => {
      const reviewed = { ...verse, interval: 1, lastReviewed: now.toISOString(), lastModified: now.toISOString(),
        reviewHistory: [{ date: now.toISOString(), grade: 0, accuracy: 0, mistakes: 2 }], lastGrade: 0 }
      const remote = { verses: [reviewed, { ...verse, id: 'remote-only' }], collections: [],
        appSettings: { reviewMode: 'rotation', maxReviewIntervalDays: 30 }, appSettingsLastModified: yesterday }
      download.mockResolvedValue({ data: remote })
      const result = await syncData([verse], [])
      expect(result.success).toBe(true)
      expect(result.verses.find(v => v.id === 'v')).toMatchObject(reviewed)
      expect(result.verses).toHaveLength(2)
      expect(upload).toHaveBeenCalledExactlyOnceWith(settings, result.verses, result.collections, remote,
        { appSettings: result.appSettings, appSettingsLastModified: result.appSettingsLastModified })
      expect(getAppSettingsRecord().appSettings).toEqual(result.appSettings)
    })
    it('downloads completely before uploading', async () => {
      await syncData([verse], [])
      expect(download.mock.invocationCallOrder[0]).toBeLessThan(upload.mock.invocationCallOrder[0])
      if (provider.ensureReady) expect(provider.ensureReady.mock.invocationCallOrder[0]).toBeLessThan(download.mock.invocationCallOrder[0])
    })
    for (const phase of ['download', 'upload']) {
      it(`preserves local input and the last successful sync time on ${phase} failure`, async () => {
        store['rum1n8-sync-state'] = JSON.stringify({ lastSync: yesterday, lastStatus: 'success' })
        const source = structuredClone([verse])
        const original = structuredClone(source)
        ;(phase === 'download' ? download : upload).mockRejectedValue(new Error('Network offline'))
        const result = await syncData(source, [])
        expect(result).toMatchObject({ success: false, error: 'Network offline' })
        expect(result.friendlyError).toContain('saved on this device')
        expect(source).toEqual(original)
        expect(getSyncState()).toMatchObject({ lastSync: yesterday, lastStatus: 'error', providerId })
        if (phase === 'download') expect(upload).not.toHaveBeenCalled()
      })
    }
    it('can recover normally after a failed upload without dropping the pending review', async () => {
      upload.mockRejectedValueOnce(new Error('Network offline'))
      const source = [{ ...verse, interval: 1, lastReviewed: now.toISOString(), lastModified: now.toISOString() }]
      expect((await syncData(source, [])).success).toBe(false)
      const result = await syncData(source, [])
      expect(result.success).toBe(true)
      expect(result.verses[0]).toMatchObject(source[0])
      expect(getSyncState()).toMatchObject({ lastStatus: 'success', lastError: null })
    })
    it('prunes only old tombstones already absent from the remote, after upload succeeds', async () => {
      const old = '2026-10-01T12:00:00.000Z'
      store['rum1n8-deleted-verses'] = JSON.stringify([{ id: 'gone', deletedAt: old }, { id: 'still-remote', deletedAt: old }, { id: 'recent', deletedAt: yesterday }])
      store['rum1n8-deleted-collections'] = JSON.stringify([{ id: 'gone', deletedAt: old }, { id: 'recent', deletedAt: yesterday }])
      download.mockResolvedValue({ data: { verses: [{ ...verse, id: 'still-remote' }], collections: [] } })
      await syncData([], [])
      expect(JSON.parse(store['rum1n8-deleted-verses']).map(e => e.id)).toEqual(['still-remote', 'recent'])
      expect(JSON.parse(store['rum1n8-deleted-collections']).map(e => e.id)).toEqual(['recent'])
    })
    it('does not prune deletion history after a failed upload', async () => {
      store['rum1n8-deleted-verses'] = JSON.stringify([{ id: 'gone', deletedAt: '2026-10-01T12:00:00Z' }])
      upload.mockRejectedValue(new Error('Upload failed'))
      await syncData([], [])
      expect(JSON.parse(store['rum1n8-deleted-verses'])).toHaveLength(1)
    })
    it('converges across repeated syncs instead of increasing review counts or intervals', async () => {
      let remote = { verses: [{ ...verse, id: 'remote-only' }], collections: [] }
      download.mockImplementation(async () => ({ data: structuredClone(remote) }))
      upload.mockImplementation(async (_settings, verses, collections, _old, preferences) => { remote = structuredClone({ verses, collections, ...preferences }) })
      const first = await syncData([verse], [])
      const second = await syncData(first.verses, first.collections)
      expect(second.verses).toEqual(first.verses)
      expect(second.collections).toEqual(first.collections)
      expect(second.appSettings).toEqual(first.appSettings)
    })
  })
}

it('a Google token refresh failure stops the sync before download', async () => {
  setActiveProviderId('gdrive')
  const provider = getProvider('gdrive')
  vi.spyOn(provider, 'getSettings').mockReturnValue({ refreshToken: 'test' })
  vi.spyOn(provider, 'ensureReady').mockRejectedValue(new Error('Google sign-in expired'))
  const download = vi.spyOn(provider, 'download')
  expect(await syncData([], [])).toMatchObject({ success: false, friendlyError: expect.stringContaining('sign-in expired') })
  expect(download).not.toHaveBeenCalled()
})

it.each([
  ['401 Unauthorized', 'gdrive', 'Google sign-in expired'], ['401 Unauthorized', 'webdav', 'credentials'],
  ['CORS blocked', 'webdav', 'browser'], ['Request timed out', 'webdav', 'too long'],
  ['Failed to fetch', 'webdav', 'saved on this device'], ['quota exceeded', 'gdrive', 'storage is full'],
  ['invalid credentials', 'webdav', 'Sign-in details'], ['Unknown server error', 'webdav', 'verses are safe'],
])('maps %s to actionable feedback', (error, providerId, expected) => {
  expect(mapSyncError(new Error(error), providerId)).toContain(expected)
})
