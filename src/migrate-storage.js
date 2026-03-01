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
}
