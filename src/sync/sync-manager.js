import { getProvider, getAllProviders } from './providers/index.js'
import { getAppSettingsRecord, saveAppSettingsRecord, mergeAppSettingsRecords } from '../app-settings.js'

const SYNC_STATE_KEY = 'rum1n8-sync-state'
const SYNC_PROVIDER_KEY = 'rum1n8-sync-provider'
const DELETED_VERSES_KEY = 'rum1n8-deleted-verses'
const DELETED_COLLECTIONS_KEY = 'rum1n8-deleted-collections'

// --- Active provider ---

export function getActiveProviderId() {
  return localStorage.getItem(SYNC_PROVIDER_KEY) || null
}

export function setActiveProviderId(id) {
  if (id) {
    localStorage.setItem(SYNC_PROVIDER_KEY, id)
  } else {
    localStorage.removeItem(SYNC_PROVIDER_KEY)
  }
}

export function getActiveProvider() {
  const id = getActiveProviderId()
  return id ? getProvider(id) : null
}

/**
 * Check if any sync provider is configured and active
 */
export function isSyncConfigured() {
  const provider = getActiveProvider()
  return provider ? provider.isConfigured() : false
}

/**
 * Auto-detect active provider on first load after upgrade.
 * If webdav settings exist but no provider is set, default to webdav.
 */
export function migrateProviderSetting() {
  if (!getActiveProviderId()) {
    const webdavSettings = localStorage.getItem('rum1n8-webdav-settings')
    if (webdavSettings) {
      setActiveProviderId('webdav')
    }
  }
}

// --- Sync state ---

function getSyncState() {
  const stored = localStorage.getItem(SYNC_STATE_KEY)
  if (stored) {
    return JSON.parse(stored)
  }
  return { lastSync: null }
}

function saveSyncState(state) {
  localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(state))
}

// --- Deletion tracking ---

function migrateDeletionList(stored) {
  if (!stored) return []
  const parsed = JSON.parse(stored)
  if (!Array.isArray(parsed)) return []
  if (parsed.length === 0) return []
  if (typeof parsed[0] === 'string') {
    const now = new Date().toISOString()
    return parsed.map(id => ({ id, deletedAt: now }))
  }
  return parsed
}

export function getDeletedVerseEntries() {
  return migrateDeletionList(localStorage.getItem(DELETED_VERSES_KEY))
}

export function getDeletedCollectionEntries() {
  return migrateDeletionList(localStorage.getItem(DELETED_COLLECTIONS_KEY))
}

export function getDeletedVerses() {
  return getDeletedVerseEntries().map(e => e.id)
}

export function getDeletedCollections() {
  return getDeletedCollectionEntries().map(e => e.id)
}

export function markVerseDeleted(verseId) {
  const entries = getDeletedVerseEntries()
  if (!entries.some(e => e.id === verseId)) {
    entries.push({ id: verseId, deletedAt: new Date().toISOString() })
    localStorage.setItem(DELETED_VERSES_KEY, JSON.stringify(entries))
    console.log('[Sync] Marked verse as deleted:', verseId)
  }
}

export function markCollectionDeleted(collectionId) {
  const entries = getDeletedCollectionEntries()
  if (!entries.some(e => e.id === collectionId)) {
    entries.push({ id: collectionId, deletedAt: new Date().toISOString() })
    localStorage.setItem(DELETED_COLLECTIONS_KEY, JSON.stringify(entries))
    console.log('[Sync] Marked collection as deleted:', collectionId)
  }
}

function pruneDeletionList(entries, remoteIds) {
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000
  const cutoff = Date.now() - sevenDaysMs
  return entries.filter(entry => {
    const deletedAtMs = new Date(entry.deletedAt).getTime()
    return remoteIds.has(entry.id) || deletedAtMs > cutoff
  })
}

// --- Conflict resolution ---

/**
 * Resolve a conflict between local and remote versions of the same verse.
 *
 * Algorithm:
 *   1. Reject remote if its timestamp is >1hr in the future (clock skew)
 *   2. Pick whichever has the later lastReviewed
 *   3. If neither has lastReviewed, pick later lastModified
 *   4. Tiebreaker: pick longer interval (more review progress)
 *   5. Default: keep local
 */
export function resolveVerseConflict(local, remote) {
  const oneHourMs = 60 * 60 * 1000
  const nowMs = Date.now()

  const localLastReviewed = local.lastReviewed ? new Date(local.lastReviewed).getTime() : 0
  const remoteLastReviewed = remote.lastReviewed ? new Date(remote.lastReviewed).getTime() : 0
  const localLastModified = local.lastModified ? new Date(local.lastModified).getTime() : (local.createdAt ? new Date(local.createdAt).getTime() : 0)
  const remoteLastModified = remote.lastModified ? new Date(remote.lastModified).getTime() : (remote.createdAt ? new Date(remote.createdAt).getTime() : 0)

  const remoteTimestamp = remoteLastReviewed || remoteLastModified
  if (remoteTimestamp > nowMs + oneHourMs) {
    if ((remote.interval || 0) > (local.interval || 0)) {
      return { useRemote: true, reason: 'remote timestamp future (clock skew?), but remote has more progress' }
    }
    return { useRemote: false, reason: 'remote timestamp is in the future, keeping local' }
  }

  if (localLastReviewed && remoteLastReviewed) {
    if (remoteLastReviewed > localLastReviewed) {
      return { useRemote: true, reason: 'remote has newer lastReviewed' }
    }
    if (localLastReviewed > remoteLastReviewed) {
      return { useRemote: false, reason: 'local has newer lastReviewed' }
    }
  } else if (remoteLastReviewed && !localLastReviewed) {
    return { useRemote: true, reason: 'remote has lastReviewed, local does not' }
  } else if (localLastReviewed && !remoteLastReviewed) {
    return { useRemote: false, reason: 'local has lastReviewed, remote does not' }
  }

  if (localLastModified && remoteLastModified) {
    if (remoteLastModified > localLastModified) {
      return { useRemote: true, reason: 'remote has newer lastModified' }
    }
    if (localLastModified > remoteLastModified) {
      return { useRemote: false, reason: 'local has newer lastModified' }
    }
  } else if (remoteLastModified && !localLastModified) {
    return { useRemote: true, reason: 'remote has lastModified, local does not' }
  } else if (localLastModified && !remoteLastModified) {
    return { useRemote: false, reason: 'local has lastModified, remote does not' }
  }

  if ((remote.interval || 0) > (local.interval || 0)) {
    return { useRemote: true, reason: 'timestamps equal, remote has longer interval' }
  }

  return { useRemote: false, reason: 'keeping local (default)' }
}

// --- Merge ---

/**
 * Merge local and remote data.
 * - Combines deletion lists from both sides
 * - Excludes deleted items
 * - Resolves per-item conflicts using resolveVerseConflict
 * - Cleans deleted collection IDs from verse.collectionIds
 */
export function mergeData(localVerses, localCollections, remoteData) {
  const mergedAppSettingsRecord = mergeAppSettingsRecords(getAppSettingsRecord(), remoteData)

  if (!remoteData || (!remoteData.verses && !remoteData.collections)) {
    return {
      verses: localVerses || [],
      collections: localCollections || [],
      appSettings: mergedAppSettingsRecord.appSettings,
      appSettingsLastModified: mergedAppSettingsRecord.appSettingsLastModified
    }
  }

  const remoteVerses = remoteData.verses || []
  const remoteCollections = remoteData.collections || []

  const remoteDeletedVerseIds = new Set(remoteData.deletedVerses || [])
  const remoteDeletedCollectionIds = new Set(remoteData.deletedCollections || [])
  const localDeletedVerseIds = new Set(getDeletedVerses())
  const localDeletedCollectionIds = new Set(getDeletedCollections())

  const deletedVerseIds = new Set([...remoteDeletedVerseIds, ...localDeletedVerseIds])
  const deletedCollectionIds = new Set([...remoteDeletedCollectionIds, ...localDeletedCollectionIds])

  const localVerseEntries = getDeletedVerseEntries()
  const localCollectionEntries = getDeletedCollectionEntries()
  const now = new Date().toISOString()

  const localActiveVerseIds = new Set((localVerses || []).map(v => v.id))
  const remoteActiveVerseIds = new Set(remoteVerses.map(v => v.id))
  const localActiveCollectionIds = new Set((localCollections || []).map(c => c.id))
  const remoteActiveCollectionIds = new Set(remoteCollections.map(c => c.id))

  const verseEntryMap = new Map(localVerseEntries.map(e => [e.id, e]))
  for (const id of remoteDeletedVerseIds) {
    if (!verseEntryMap.has(id) && localActiveVerseIds.has(id)) {
      verseEntryMap.set(id, { id, deletedAt: now })
    }
  }
  const collectionEntryMap = new Map(localCollectionEntries.map(e => [e.id, e]))
  for (const id of remoteDeletedCollectionIds) {
    if (!collectionEntryMap.has(id) && localActiveCollectionIds.has(id)) {
      collectionEntryMap.set(id, { id, deletedAt: now })
    }
  }

  for (const [id] of verseEntryMap) {
    const stillExists = localActiveVerseIds.has(id) || remoteActiveVerseIds.has(id)
    if (!stillExists) {
      verseEntryMap.delete(id)
    }
  }
  for (const [id] of collectionEntryMap) {
    const stillExists = localActiveCollectionIds.has(id) || remoteActiveCollectionIds.has(id)
    if (!stillExists) {
      collectionEntryMap.delete(id)
    }
  }

  localStorage.setItem(DELETED_VERSES_KEY, JSON.stringify([...verseEntryMap.values()]))
  localStorage.setItem(DELETED_COLLECTIONS_KEY, JSON.stringify([...collectionEntryMap.values()]))

  // Merge verses
  const verseMap = new Map()
  for (const verse of (localVerses || [])) {
    if (!deletedVerseIds.has(verse.id)) {
      verseMap.set(verse.id, verse)
    }
  }
  for (const verse of remoteVerses) {
    if (deletedVerseIds.has(verse.id)) continue
    const existing = verseMap.get(verse.id)
    if (!existing) {
      verseMap.set(verse.id, verse)
    } else {
      const { useRemote, reason } = resolveVerseConflict(existing, verse)
      console.log(`[Sync] Merge ${verse.id} (${verse.reference}): ${reason}`)
      if (useRemote) {
        verseMap.set(verse.id, verse)
      }
    }
  }

  const mergedVerses = Array.from(verseMap.values()).map(verse => {
    if (verse.collectionIds && verse.collectionIds.length > 0) {
      const cleaned = verse.collectionIds.filter(id => !deletedCollectionIds.has(id))
      return { ...verse, collectionIds: cleaned }
    }
    return verse
  })

  // Merge collections
  const collectionMap = new Map()
  for (const collection of (localCollections || [])) {
    if (!deletedCollectionIds.has(collection.id)) {
      collectionMap.set(collection.id, collection)
    }
  }
  for (const collection of remoteCollections) {
    if (deletedCollectionIds.has(collection.id)) continue
    const existing = collectionMap.get(collection.id)
    if (!existing) {
      collectionMap.set(collection.id, collection)
    } else {
      const localTime = existing.lastModified || existing.createdAt || ''
      const remoteTime = collection.lastModified || collection.createdAt || ''
      if (remoteTime > localTime) {
        collectionMap.set(collection.id, collection)
      }
    }
  }

  return {
    verses: mergedVerses,
    collections: Array.from(collectionMap.values()),
    appSettings: mergedAppSettingsRecord.appSettings,
    appSettingsLastModified: mergedAppSettingsRecord.appSettingsLastModified
  }
}

// --- Sync orchestrator ---

/**
 * Perform two-way sync using the active provider: download, merge, upload.
 */
export async function syncData(localVerses, localCollections) {
  const provider = getActiveProvider()
  if (!provider) {
    return { success: false, error: 'No sync provider configured' }
  }

  const settings = provider.getSettings()
  if (!settings) {
    return { success: false, error: `${provider.name} not configured` }
  }

  try {
    console.log(`[Sync] Starting sync with ${provider.name}...`)

    // Ensure provider is ready (e.g. refresh expired tokens)
    if (provider.ensureReady) {
      await provider.ensureReady(settings)
    }

    const { data: remoteData } = await provider.download(settings)

    if (!remoteData) {
      console.log(`[Sync] No remote data found, uploading local data`)
      const localAppSettingsRecord = getAppSettingsRecord()
      await provider.upload(settings, localVerses, localCollections, null, localAppSettingsRecord)
      saveSyncState({ lastSync: new Date().toISOString() })
      return {
        success: true,
        action: 'uploaded',
        verses: localVerses,
        collections: localCollections,
        appSettings: localAppSettingsRecord.appSettings,
        appSettingsLastModified: localAppSettingsRecord.appSettingsLastModified
      }
    }

    const merged = mergeData(localVerses, localCollections, remoteData)
    saveAppSettingsRecord({
      appSettings: merged.appSettings,
      appSettingsLastModified: merged.appSettingsLastModified
    })
    await provider.upload(settings, merged.verses, merged.collections, remoteData, {
      appSettings: merged.appSettings,
      appSettingsLastModified: merged.appSettingsLastModified
    })
    saveSyncState({ lastSync: new Date().toISOString() })

    // Prune old deletion entries
    const remoteVerseIds = new Set((remoteData.verses || []).map(v => v.id))
    const remoteCollectionIds = new Set((remoteData.collections || []).map(c => c.id))
    const prunedVerseEntries = pruneDeletionList(getDeletedVerseEntries(), remoteVerseIds)
    const prunedCollectionEntries = pruneDeletionList(getDeletedCollectionEntries(), remoteCollectionIds)
    localStorage.setItem(DELETED_VERSES_KEY, JSON.stringify(prunedVerseEntries))
    localStorage.setItem(DELETED_COLLECTIONS_KEY, JSON.stringify(prunedCollectionEntries))

    return {
      success: true,
      action: 'synced',
      verses: merged.verses,
      collections: merged.collections,
      appSettings: merged.appSettings,
      appSettingsLastModified: merged.appSettingsLastModified
    }
  } catch (error) {
    console.error('Sync error:', error)
    return { success: false, error: error.message || 'Sync failed' }
  }
}
