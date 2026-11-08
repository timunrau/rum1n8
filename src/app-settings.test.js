import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_APP_SETTINGS,
  mergeAppSettingsRecords,
  normalizeAppSettings,
  normalizeAppSettingsRecord,
  getAppSettingsRecord,
  saveAppSettingsRecord,
  saveAppSettings,
} from './app-settings.js'

describe('app settings', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('ignores the retired voice preference while preserving unrelated settings and the input object', () => {
    const settings = { voicePracticeEnabled: true, requireReferenceTyping: true, futureSetting: 'keep' }
    const normalized = normalizeAppSettings(settings)
    expect(normalized).not.toHaveProperty('voicePracticeEnabled')
    expect(normalized).toMatchObject({ requireReferenceTyping: true, futureSetting: 'keep' })
    expect(settings.voicePracticeEnabled).toBe(true)
  })

  it.each([true, false])('strips legacy voice settings on load and backup restore (%s) without changing timestamps', enabled => {
    let stored = JSON.stringify({
      appSettings: { voicePracticeEnabled: enabled, analyticsOptOut: true, defaultBibleVersion: 'BSB' },
      appSettingsLastModified: '2026-06-20T12:00:00.000Z',
    })
    vi.stubGlobal('localStorage', {
      getItem: () => stored,
      setItem: (key, value) => { stored = value },
    })
    const loaded = getAppSettingsRecord()
    expect(loaded.appSettings).not.toHaveProperty('voicePracticeEnabled')
    const saved = saveAppSettingsRecord(JSON.parse(stored))
    expect(saved).toEqual(loaded)
    expect(JSON.parse(stored)).toEqual(loaded)
    expect(saved.appSettingsLastModified).toBe('2026-06-20T12:00:00.000Z')
    expect(saved.appSettings).toMatchObject({ analyticsOptOut: true, defaultBibleVersion: 'BSB' })
  })

  it.each([['2026-06-21', '2026-06-20'], ['2026-06-20', '2026-06-21']])('strips the voice preference whichever synced record wins (%s / %s)', (localTime, remoteTime) => {
    const record = (time, version) => ({
      appSettings: { voicePracticeEnabled: true, defaultBibleVersion: version },
      appSettingsLastModified: `${time}T12:00:00.000Z`,
    })
    const local = record(localTime, 'BSB')
    const remote = record(remoteTime, 'KJV')
    const merged = mergeAppSettingsRecords(local, remote)
    const winner = localTime > remoteTime ? local : remote
    expect(merged.appSettings).not.toHaveProperty('voicePracticeEnabled')
    expect(merged.appSettings.defaultBibleVersion).toBe(winner.appSettings.defaultBibleVersion)
    expect(merged.appSettingsLastModified).toBe(winner.appSettingsLastModified)
  })
  it('defaults the Bible version setting for older settings records', () => {
    expect(normalizeAppSettings({ requireReferenceTyping: true })).toEqual({
      ...DEFAULT_APP_SETTINGS,
      requireReferenceTyping: true,
      analyticsOptOut: false,
      defaultBibleVersion: ''
    })
  })

  it('normalizes default Bible versions to trimmed uppercase strings', () => {
    expect(normalizeAppSettings({
      analyticsOptOut: true,
      defaultBibleVersion: ' bsb '
    })).toMatchObject({
      analyticsOptOut: true,
      defaultBibleVersion: 'BSB'
    })

    expect(normalizeAppSettingsRecord({
      appSettings: { defaultBibleVersion: 123 },
      appSettingsLastModified: '2026-06-20T12:00:00.000Z'
    })).toEqual({
      appSettings: normalizeAppSettings(),
      appSettingsLastModified: '2026-06-20T12:00:00.000Z'
    })
  })

  it('normalizes per-context verse sort preferences for sync and backup compatibility', () => {
    expect(normalizeAppSettings({
      verseSortPreferences: {
        'collection:promises': { criterion: 'lastReviewed', direction: 'desc' },
        'collection:alphabetical': { criterion: 'alphabetical', direction: 'desc' },
        'virtual:master-list': { criterion: 'nextReviewDate', direction: 'invalid' },
        'collection:broken': { criterion: 'unknown', direction: 'desc' },
      },
    }).verseSortPreferences).toEqual({
      'collection:promises': { criterion: 'lastReviewed', direction: 'desc' },
      'collection:alphabetical': { criterion: 'alphabetical', direction: 'desc' },
      'virtual:master-list': { criterion: 'nextReviewDate', direction: 'asc' },
      'collection:broken': { criterion: 'reference', direction: 'asc' },
    })
  })

  it('defaults malformed verse sort preference maps to an empty object', () => {
    expect(normalizeAppSettings({ verseSortPreferences: null }).verseSortPreferences).toEqual({})
    expect(normalizeAppSettings({ verseSortPreferences: [] }).verseSortPreferences).toEqual({})
  })

  it('keeps per-context sort preferences when synced settings win', () => {
    const merged = mergeAppSettingsRecords(
      {
        appSettings: {
          verseSortPreferences: {
            'collection:local': { criterion: 'createdAt', direction: 'desc' },
          },
        },
        appSettingsLastModified: '2026-08-01T00:00:00.000Z',
      },
      {
        appSettings: {
          verseSortPreferences: {
            'collection:remote': { criterion: 'lastReviewed', direction: 'asc' },
          },
        },
        appSettingsLastModified: '2026-08-02T00:00:00.000Z',
      }
    )

    expect(merged.appSettings.verseSortPreferences).toEqual({
      'collection:remote': { criterion: 'lastReviewed', direction: 'asc' },
    })
  })
})

describe('review preferences and installation defaults', () => {
  afterEach(() => vi.unstubAllGlobals())

  function storage(entries = {}) {
    const values = new Map(Object.entries(entries))
    vi.stubGlobal('localStorage', {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    })
    return values
  }

  it('pins Rotation for fresh installs without inventing a user-edit timestamp', () => {
    const values = storage()
    const first = getAppSettingsRecord()
    expect(first.appSettings).toMatchObject({ reviewMode: 'rotation', maxReviewIntervalDays: 90 })
    expect(first.appSettingsLastModified).toBeNull()
    values.set('rum1n8-verses', '[{"id":"first-verse"}]')
    expect(getAppSettingsRecord()).toEqual(first)
  })

  it.each(['rum1n8-verses', 'rum1n8-collections', 'rum1n8-ui-state', 'rum1n8-webdav-settings'])('keeps existing installs on Classic when %s exists', key => {
    storage({ [key]: '[]' })
    expect(getAppSettingsRecord().appSettings.reviewMode).toBe('classic')
  })

  it('preserves older preferences and their timestamps while defaulting missing mode to Classic', () => {
    storage({ 'rum1n8-app-settings': JSON.stringify({
      appSettings: { requireReferenceTyping: true }, appSettingsLastModified: '2026-01-01T00:00:00Z',
    }) })
    expect(getAppSettingsRecord()).toMatchObject({
      appSettings: { requireReferenceTyping: true, reviewMode: 'classic' },
      appSettingsLastModified: '2026-01-01T00:00:00Z',
    })
    expect(normalizeAppSettingsRecord({ appSettings: {} }).appSettings.reviewMode).toBe('classic')
  })

  it.each(['classic', 'rotation'])('preserves a deliberate %s choice through save and load', reviewMode => {
    storage()
    saveAppSettings({ reviewMode, maxReviewIntervalDays: 365 })
    expect(getAppSettingsRecord().appSettings).toMatchObject({ reviewMode, maxReviewIntervalDays: 365 })
  })

  it.each([0, 366, 10.5, '30', null])('rejects an invalid saved maximum (%s)', maxReviewIntervalDays => {
    expect(normalizeAppSettings({ reviewMode: 'unknown', maxReviewIntervalDays })).toMatchObject({
      reviewMode: 'classic', maxReviewIntervalDays: 90,
    })
  })

  it.each([null, [], 'invalid', 42])('restores malformed legacy settings safely (%s)', appSettings => {
    expect(normalizeAppSettingsRecord({ appSettings }).appSettings).toMatchObject({
      reviewMode: 'classic', maxReviewIntervalDays: 90,
    })
  })

  it('restores untimestamped legacy account settings over a fresh installation default', () => {
    storage()
    const fresh = getAppSettingsRecord()
    expect(mergeAppSettingsRecords(fresh, { appSettings: { requireReferenceTyping: true } }).appSettings)
      .toMatchObject({ reviewMode: 'classic', requireReferenceTyping: true })
    expect(mergeAppSettingsRecords(fresh, { verses: [], collections: [] }).appSettings.reviewMode).toBe('classic')
    expect(mergeAppSettingsRecords(fresh, null).appSettings.reviewMode).toBe('rotation')
  })

  it('keeps a deliberate Rotation choice when a legacy sync file has no settings', () => {
    storage()
    const chosen = saveAppSettings({ reviewMode: 'rotation', maxReviewIntervalDays: 30 })
    expect(mergeAppSettingsRecords(chosen, { verses: [], collections: [] })).toEqual(chosen)
    expect(mergeAppSettingsRecords(chosen, { appSettings: {} })).toEqual(chosen)
  })
})
