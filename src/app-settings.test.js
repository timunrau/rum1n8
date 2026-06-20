import { describe, expect, it } from 'vitest'
import { DEFAULT_APP_SETTINGS, normalizeAppSettings, normalizeAppSettingsRecord } from './app-settings.js'

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
})
