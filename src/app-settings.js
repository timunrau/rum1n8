const APP_SETTINGS_KEY = 'rum1n8-app-settings'

export const DEFAULT_APP_SETTINGS = Object.freeze({
  requireReferenceTyping: false
})

export function normalizeAppSettings(settings = {}) {
  return {
    ...DEFAULT_APP_SETTINGS,
    ...settings,
    requireReferenceTyping: !!settings.requireReferenceTyping
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
  if (!stored) {
    return normalizeAppSettingsRecord()
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
  return local
}
