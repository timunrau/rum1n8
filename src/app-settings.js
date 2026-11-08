import { normalizeVerseSortPreference } from './utils/verse-sort.js'
import { normalizeMaxReviewInterval } from './review-schedule.js'

const APP_SETTINGS_KEY = 'rum1n8-app-settings'
const EXISTING_INSTALL_KEYS = [
  'rum1n8-verses',
  'rum1n8-collections',
  'rum1n8-ui-state',
  'rum1n8-webdav-settings',
  'rum1n8-gdrive-settings',
  'rum1n8-sync-provider',
  'rum1n8-sync-state',
  'rum1n8-last-backup',
  'rum1n8-deleted-verses',
  'rum1n8-deleted-collections',
]

// Missing preferences in existing records, backups, and sync files retain Classic.
export const DEFAULT_APP_SETTINGS = Object.freeze({
  requireReferenceTyping: false,
  showMasterPlaceholderLines: true,
  analyticsOptOut: false,
  defaultBibleVersion: '',
  reviewMode: 'classic',
  maxReviewIntervalDays: 90,
  verseSortPreferences: {}
})

function normalizeVerseSortPreferences(preferences) {
  if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)) return {}

  return Object.fromEntries(Object.entries(preferences)
    .filter(([key, preference]) => key && preference && typeof preference === 'object' && !Array.isArray(preference))
    .map(([key, preference]) => [key, normalizeVerseSortPreference(preference)]))
}

export function normalizeAppSettings(settings = {}) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) settings = {}
  const currentSettings = { ...settings }
  // Older clients and backups may still send this retired preference.
  delete currentSettings.voicePracticeEnabled
  const defaultBibleVersion = typeof settings.defaultBibleVersion === 'string'
    ? settings.defaultBibleVersion.trim().toUpperCase()
    : ''

  return {
    ...DEFAULT_APP_SETTINGS,
    ...currentSettings,
    requireReferenceTyping: !!settings.requireReferenceTyping,
    showMasterPlaceholderLines: settings.showMasterPlaceholderLines !== false,
    analyticsOptOut: !!settings.analyticsOptOut,
    defaultBibleVersion,
    reviewMode: settings.reviewMode === 'rotation' ? 'rotation' : 'classic',
    maxReviewIntervalDays: normalizeMaxReviewInterval(settings.maxReviewIntervalDays),
    verseSortPreferences: normalizeVerseSortPreferences(settings.verseSortPreferences)
  }
}

export function normalizeAppSettingsRecord(record = null) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return {
      appSettings: normalizeAppSettings(),
      appSettingsLastModified: null
    }
  }

  if (Object.prototype.hasOwnProperty.call(record, 'appSettings')) {
    return {
      appSettings: normalizeAppSettings(record.appSettings),
      appSettingsLastModified: record.appSettingsLastModified || null
    }
  }

  return {
    appSettings: normalizeAppSettings(record),
    appSettingsLastModified: null
  }
}

export function getAppSettingsRecord() {
  const stored = localStorage.getItem(APP_SETTINGS_KEY)
  if (stored === null) {
    const existingInstall = EXISTING_INSTALL_KEYS.some(key => localStorage.getItem(key) !== null)
    const initialRecord = {
      appSettings: normalizeAppSettings({ reviewMode: existingInstall ? 'classic' : 'rotation' }),
      appSettingsLastModified: null,
    }
    // Pin the first-launch choice before verses are added. No edit timestamp:
    // restored account preferences must beat an automatic installation default.
    localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(initialRecord))
    return initialRecord
  }

  try {
    return normalizeAppSettingsRecord(JSON.parse(stored))
  } catch {
    return normalizeAppSettingsRecord()
  }
}

export function getAppSettings() {
  return getAppSettingsRecord().appSettings
}

export function saveAppSettingsRecord(record) {
  const normalized = normalizeAppSettingsRecord(record)
  const payload = {
    appSettings: normalized.appSettings,
    appSettingsLastModified: normalized.appSettingsLastModified || new Date().toISOString()
  }
  localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(payload))
  return payload
}

export function saveAppSettings(appSettings, lastModified = new Date().toISOString()) {
  return saveAppSettingsRecord({
    appSettings,
    appSettingsLastModified: lastModified
  })
}

export function mergeAppSettingsRecords(localRecord, remoteData) {
  const local = normalizeAppSettingsRecord(localRecord)
  const remoteHasSettings = remoteData && Object.prototype.hasOwnProperty.call(remoteData, 'appSettings')

  if (!remoteHasSettings) {
    const remoteHasLibrary = remoteData && (Array.isArray(remoteData.verses) || Array.isArray(remoteData.collections))
    if (remoteHasLibrary && !local.appSettingsLastModified) {
      return { ...local, appSettings: { ...local.appSettings, reviewMode: 'classic' } }
    }
    return local
  }

  const remote = normalizeAppSettingsRecord({
    appSettings: remoteData.appSettings,
    appSettingsLastModified: remoteData.appSettingsLastModified
  })

  const localTime = local.appSettingsLastModified ? new Date(local.appSettingsLastModified).getTime() : 0
  const remoteTime = remote.appSettingsLastModified ? new Date(remote.appSettingsLastModified).getTime() : 0

  if (remoteTime > localTime) return remote
  if (localTime > remoteTime) return local
  if (remote.appSettingsLastModified && !local.appSettingsLastModified) return remote
  // An untimestamped installation default is not a deliberate user preference.
  if (!remote.appSettingsLastModified && !local.appSettingsLastModified) return remote
  return local
}
