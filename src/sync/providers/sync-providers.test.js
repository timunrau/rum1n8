import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import webdav from './webdav-provider.js'
import gdrive from './gdrive-provider.js'
import { syncData, setActiveProviderId } from '../sync-manager.js'

const now = new Date('2026-11-12T12:00:00Z')
let fetchMock
const response = (body = {}, status = 200) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })
const settingsRecord = { appSettings: { reviewMode: 'rotation', maxReviewIntervalDays: 30 }, appSettingsLastModified: '2026-11-10T12:00:00Z' }
const verses = [{ id: 'v', reference: 'John 3:16', interval: 7, reviewCount: 8,
  reviewHistory: [{ date: '2026-11-11T12:00:00Z', grade: 3 }], reviewSchedule: { earnedInterval: 7, anchorDate: '2026-11-11T12:00:00Z', appliedMaximumDays: 30, forceDue: false } }]
const collections = [{ id: 'c', name: 'Collection', parentId: null }]

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(now)
  const store = {}
  vi.stubGlobal('localStorage', { getItem: key => store[key] ?? null, setItem: (key, value) => { store[key] = value }, removeItem: key => { delete store[key] } })
  vi.stubGlobal('window', { location: { hostname: 'localhost', origin: 'http://localhost:5173' } })
  fetchMock = vi.fn(() => { throw new Error('Unexpected network request in provider test') })
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

for (const provider of [webdav, gdrive]) {
  it(`${provider.id} settings can be saved and disconnected`, () => {
    expect(provider.isConfigured()).toBe(false)
    provider.saveSettings({ url: 'https://example.com/dav', username: 'test', password: 'test', accessToken: 'test', refreshToken: 'test' })
    expect(provider.isConfigured()).toBe(true)
    provider.clearSettings()
    expect(provider.getSettings()).toBeNull()
    expect(provider.isConfigured()).toBe(false)
  })
}

describe('WebDAV transport', () => {
  const settings = { url: ' https://example.com/remote.php/dav/files/test ', folder: '/rum1n8/', username: 'test', password: 'synthetic-password' }

  it('uses the configured path, normalized folder, and Basic authentication', async () => {
    fetchMock.mockResolvedValue(response({ verses }))
    expect(await webdav.download(settings)).toEqual({ data: { verses } })
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith('https://example.com/remote.php/dav/files/test/rum1n8/rum1n8-data.json', {
      method: 'GET', headers: { Authorization: `Basic ${btoa('test:synthetic-password')}` },
    })
  })
  it.each(['development', 'production'])('preserves the target and path through the %s proxy', async environment => {
    if (environment === 'production') window.location = { hostname: 'rum1n8.unrau.xyz', origin: 'https://rum1n8.unrau.xyz' }
    fetchMock.mockResolvedValue(response({ verses }))
    await webdav.download({ ...settings, useProxy: environment === 'development', proxyUrl: 'http://localhost:3001' })
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe(`${environment === 'production' ? 'https://rum1n8.unrau.xyz/api/webdav' : 'http://localhost:3001'}/remote.php/dav/files/test/rum1n8/rum1n8-data.json`)
    expect(options.headers['X-WebDAV-Target']).toBe(settings.url.trim())
  })
  it('falls back to the legacy filename only when the current file is missing', async () => {
    fetchMock.mockResolvedValueOnce(response('', 404)).mockResolvedValueOnce(response({ verses }))
    expect(await webdav.download(settings)).toEqual({ data: { verses } })
    expect(fetchMock.mock.calls[1][0]).toMatch(/bible-memory-data\.json$/)
  })
  it('treats two missing filenames as a new account', async () => {
    fetchMock.mockResolvedValue(response('', 404))
    expect(await webdav.download(settings)).toEqual({ data: null })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
  it.each([401, 403, 500])('does not treat HTTP %i as an empty account or fall back', async status => {
    fetchMock.mockResolvedValue(response('', status))
    await expect(webdav.download(settings)).rejects.toThrow(`Download failed: ${status}`)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  it('refuses malformed JSON instead of overwriting the remote as an empty account', async () => {
    fetchMock.mockResolvedValue(response('not JSON'))
    await expect(webdav.download(settings)).rejects.toThrow()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  it('propagates network failure without trying to create an empty remote file', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(webdav.download(settings)).rejects.toThrow('Failed to fetch')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  it('uploads all review fields, settings, and inactive tombstones without mutating inputs', async () => {
    localStorage.setItem('rum1n8-deleted-verses', JSON.stringify([{ id: 'v', deletedAt: now.toISOString() }, { id: 'deleted', deletedAt: now.toISOString() }]))
    localStorage.setItem('rum1n8-deleted-collections', JSON.stringify([{ id: 'deleted-c', deletedAt: now.toISOString() }]))
    fetchMock.mockResolvedValue(response())
    const before = structuredClone({ verses, collections, settingsRecord })
    await webdav.upload(settings, verses, collections, null, settingsRecord)
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toMatch(/rum1n8-data\.json$/)
    expect(options.method).toBe('PUT')
    expect(JSON.parse(options.body)).toEqual({ verses, collections, ...settingsRecord, syncedAt: now.toISOString(),
      deletedVerses: [{ id: 'deleted', deletedAt: now.toISOString() }], deletedCollections: [{ id: 'deleted-c', deletedAt: now.toISOString() }] })
    expect({ verses, collections, settingsRecord }).toEqual(before)
  })
  it.each([401, 500])('reports upload HTTP %i as a failure', async status => {
    fetchMock.mockResolvedValue(response('', status))
    await expect(webdav.upload(settings, verses, [], null, settingsRecord)).rejects.toThrow(`Upload failed: ${status}`)
  })
  it.each([[207, true], [401, false], [403, false], [404, false], [500, false]])('tests connectivity with PROPFIND (HTTP %i)', async (status, success) => {
    fetchMock.mockResolvedValue(response('', status))
    expect((await webdav.testConnection(settings)).success).toBe(success)
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'PROPFIND', headers: { Depth: '0' } })
  })
})

describe('Google Drive transport', () => {
  const settings = { accessToken: 'synthetic-access', refreshToken: 'synthetic-refresh', tokenExpiry: '2026-11-12T13:00:00Z', folderId: 'folder' }
  beforeEach(() => { gdrive.saveSettings(settings) })

  function mockDrive({ fileId = 'file', cachedFolderMissing = false, createFolder = false, failUpload = false, expired = false } = {}) {
    let tokenRefreshes = 0
    fetchMock.mockImplementation(async (url, options = {}) => {
      if (url === 'https://oauth2.googleapis.com/token') {
        tokenRefreshes++
        return response({ access_token: 'refreshed-access', expires_in: 3600 })
      }
      expect(options.headers.Authorization).toBe(`Bearer ${expired ? 'refreshed-access' : settings.accessToken}`)
      if (url.includes('/upload/drive/')) return response({ id: 'file' }, failUpload ? 500 : 200)
      if (url.endsWith('/folder?fields=id,trashed')) return response({ id: 'folder', trashed: cachedFolderMissing })
      if (url.includes('/files?q=')) {
        const query = new URL(url).searchParams.get('q')
        if (query.includes('mimeType=')) return response({ files: createFolder ? [] : [{ id: 'folder' }] })
        return response({ files: fileId ? [{ id: fileId }] : [] })
      }
      if (options.method === 'POST' && url.endsWith('/files')) return response({ id: 'folder' })
      if (url.includes('?alt=media')) return response({ verses, collections, ...settingsRecord })
      throw new Error(`Unexpected Drive request: ${url}`)
    })
    return { tokenRefreshes: () => tokenRefreshes }
  }

  it('downloads an existing file using the cached folder and valid access token', async () => {
    mockDrive()
    expect(await gdrive.download(settings)).toEqual({ data: { verses, collections, ...settingsRecord } })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
  it('returns no data for a missing sync file', async () => {
    mockDrive({ fileId: null })
    expect(await gdrive.download(settings)).toEqual({ data: null })
    expect(fetchMock.mock.calls.some(([url]) => url.includes('?alt=media'))).toBe(false)
  })
  it.each([false, true])('recovers a trashed cached folder, creating one only when needed (%s)', createFolder => {
    mockDrive({ cachedFolderMissing: true, createFolder })
    return gdrive.download(settings).then(() => {
      expect(gdrive.getSettings()).toMatchObject({ ...settings, folderId: 'folder' })
      expect(fetchMock.mock.calls.filter(([, options]) => options.method === 'POST')).toHaveLength(createFolder ? 1 : 0)
    })
  })
  it.each(['existing', 'new'])('uploads a complete payload to an %s file using the correct HTTP method', async kind => {
    mockDrive({ fileId: kind === 'new' ? null : 'file' })
    localStorage.setItem('rum1n8-deleted-verses', JSON.stringify([{ id: 'deleted', deletedAt: now.toISOString() }]))
    await gdrive.upload(settings, verses, collections, null, settingsRecord)
    const [url, options] = fetchMock.mock.calls.find(([url]) => url.includes('/upload/drive/'))
    expect(options.method).toBe(kind === 'new' ? 'POST' : 'PATCH')
    expect(url).toContain(kind === 'new' ? '/files?uploadType=' : '/files/file?uploadType=')
    const boundary = options.headers['Content-Type'].split('boundary=')[1]
    const parts = options.body.split(`--${boundary}`)
    const parsePart = index => JSON.parse(parts[index].split('\r\n\r\n')[1].trim())
    expect(parsePart(1)).toEqual({ name: 'rum1n8-data.json', mimeType: 'application/json', ...(kind === 'new' ? { parents: ['folder'] } : {}) })
    expect(parsePart(2)).toEqual({ verses, collections, ...settingsRecord, syncedAt: now.toISOString(),
      deletedVerses: [{ id: 'deleted', deletedAt: now.toISOString() }], deletedCollections: [] })
  })
  it('refreshes an expired token and retains the refresh token and cached folder', async () => {
    const expired = { ...settings, tokenExpiry: '2026-11-12T11:00:00Z' }
    gdrive.saveSettings(expired)
    mockDrive({ expired: true })
    await gdrive.download(expired)
    expect(gdrive.getSettings()).toMatchObject({ ...settings, accessToken: 'refreshed-access', tokenExpiry: '2026-11-12T13:00:00.000Z' })
    expect(new URLSearchParams(fetchMock.mock.calls[0][1].body).get('grant_type')).toBe('refresh_token')
  })
  it('refreshes once for a complete download/merge/upload sync', async () => {
    gdrive.saveSettings({ ...settings, tokenExpiry: '2026-11-12T11:00:00Z' })
    setActiveProviderId('gdrive')
    const drive = mockDrive({ expired: true })
    expect((await syncData([], [])).success).toBe(true)
    expect(drive.tokenRefreshes()).toBe(1)
  })
  it('requires reauthentication on an invalid refresh grant', async () => {
    fetchMock.mockResolvedValue(response({ error: 'invalid_grant' }, 400))
    await expect(gdrive.ensureReady({ ...settings, tokenExpiry: null })).rejects.toThrow('sign-in expired')
    expect(gdrive.getSettings()).toEqual(settings)
  })
  it('fails without a refresh token instead of calling the network', async () => {
    await expect(gdrive.ensureReady({ accessToken: 'expired' })).rejects.toThrow('sign in again')
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('stops on unauthorized Drive access instead of creating an empty account', async () => {
    fetchMock.mockResolvedValue(response({}, 401))
    await expect(gdrive.download(settings)).rejects.toThrow('sign-in expired')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  it('propagates file upload errors', async () => {
    mockDrive({ failUpload: true })
    await expect(gdrive.upload(settings, verses, [], null, settingsRecord)).rejects.toThrow('Failed to upload file: 500')
  })
})
