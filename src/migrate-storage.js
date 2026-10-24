const KEY_MIGRATIONS = [
  ['bible-memory-verses', 'rum1n8-verses'],
  ['bible-memory-collections', 'rum1n8-collections'],
  ['bible-memory-webdav-settings', 'rum1n8-webdav-settings'],
  ['bible-memory-sync-state', 'rum1n8-sync-state'],
  ['bible-memory-deleted-verses', 'rum1n8-deleted-verses'],
  ['bible-memory-deleted-collections', 'rum1n8-deleted-collections'],
  ['bible-memory-last-backup', 'rum1n8-last-backup'],
]

export function migrateStorage() {
  let migrated = 0
  for (const [oldKey, newKey] of KEY_MIGRATIONS) {
    const oldValue = localStorage.getItem(oldKey)
    if (oldValue !== null && localStorage.getItem(newKey) === null) {
      localStorage.setItem(newKey, oldValue)
      localStorage.removeItem(oldKey)
      migrated++
    }
  }
  if (migrated > 0) {
    console.log(`[migrate] Migrated ${migrated} localStorage keys from bible-memory to rum1n8`)
  }

  // Preserve the record's timestamp: retiring a setting is not a user edit and
  // must not make older local preferences win over newer synced preferences.
  try {
    const key = 'rum1n8-app-settings'
    const record = JSON.parse(localStorage.getItem(key))
    const settings = record?.appSettings ?? record
    if (settings && Object.hasOwn(settings, 'voicePracticeEnabled')) {
      delete settings.voicePracticeEnabled
      localStorage.setItem(key, JSON.stringify(record))
    }
  } catch {
    // Leave malformed or inaccessible storage alone; normalization also strips
    // the retired setting when records arrive through sync or backup restore.
  }
}

let voiceCleanup = null

// Keep this small migration permanently: dormant installs may skip releases.
// Retry on startup/foreground instead of marking it done, since an older open
// tab can recreate the cache. No model files need to be opened or downloaded.
export function cleanupRetiredVoiceModels(scope = globalThis) {
  if (voiceCleanup) return voiceCleanup
  voiceCleanup = Promise.resolve().then(async () => {
    const storage = scope.caches
    if (!storage?.keys || !storage?.delete) return
    const names = await storage.keys()
    await Promise.allSettled(names
      .filter(name => name.startsWith('ruminate-voice-model-'))
      .map(async name => storage.delete(name)))
  }).catch(() => {
    // Storage can be disabled or temporarily unavailable. Never block the app.
  }).finally(() => { voiceCleanup = null })
  return voiceCleanup
}
