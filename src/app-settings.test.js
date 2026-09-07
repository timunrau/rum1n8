import { describe, expect, it } from 'vitest'
import {
  DEFAULT_APP_SETTINGS,
  mergeAppSettingsRecords,
  normalizeAppSettings,
  normalizeAppSettingsRecord,
} from './app-settings.js'

describe('app settings', () => {
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
        'virtual:master-list': { criterion: 'nextReviewDate', direction: 'invalid' },
        'collection:broken': { criterion: 'unknown', direction: 'desc' },
      },
    }).verseSortPreferences).toEqual({
      'collection:promises': { criterion: 'lastReviewed', direction: 'desc' },
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
