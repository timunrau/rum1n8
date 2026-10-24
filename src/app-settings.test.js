import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_APP_SETTINGS,
  mergeAppSettingsRecords,
  normalizeAppSettings,
  normalizeAppSettingsRecord,
  getAppSettingsRecord,
  saveAppSettingsRecord,
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
