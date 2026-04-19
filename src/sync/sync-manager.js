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

export function getSyncState() {
  const stored = localStorage.getItem(SYNC_STATE_KEY)
  if (stored) {
    try {
      return JSON.parse(stored)
    } catch {
      return { lastSync: null, lastStatus: null, lastError: null }
    }
  }
  return { lastSync: null, lastStatus: null, lastError: null }
}

function saveSyncState(state) {
  localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(state))
}

/**
 * Translate provider/network errors into plain-English messages non-technical
 * users can act on. Unknown errors fall back to a generic reassurance.
 */
export function mapSyncError(error, providerId) {
  const raw = (error && (error.message || error)) || ''
  const msg = String(raw)
  const lower = msg.toLowerCase()

  if (lower.includes('sign-in') || lower.includes('token refresh') || lower.includes('expired') || lower.includes('401') || lower.includes('unauthorized')) {
    if (providerId === 'gdrive') {
      return 'Your Google sign-in expired. Please sign in again to keep syncing.'
    }
    return 'Sign-in expired or credentials are incorrect. Please check your sync settings.'
  }
  if (lower.includes('not configured')) {
    return 'Sync isn\u2019t set up yet. Tap Set up to connect Google Drive.'
  }
  if (lower.includes('cors')) {
    return 'Couldn\u2019t reach the server from your browser. If this keeps happening, check your sync settings.'
  }
  if (lower.includes('timeout') || lower.includes('timed out')) {
    return 'The server took too long to respond. Check your internet connection and try again.'
  }
  if (lower.includes('network') || lower.includes('failed to fetch') || lower.includes('offline')) {
    return 'Couldn\u2019t reach the internet. Your changes are saved on this device and will sync when you\u2019re back online.'
  }
  if (lower.includes('authentication failed') || lower.includes('invalid credentials')) {
    return 'Sign-in details are incorrect. Please check your sync settings.'
  }
  if (lower.includes('quota') || lower.includes('storage full')) {
    return 'Your cloud storage is full. Free up some space and try again.'
  }

  return 'Sync couldn\u2019t finish right now. Your verses are safe on this device \u2014 we\u2019ll try again soon.'
}

// --- Deletion tracking ---

function normalizeDeletionEntries(value) {
  if (!value) return []
  const parsed = typeof value === 'string' ? JSON.parse(value) : value
  if (!Array.isArray(parsed)) return []
  if (parsed.length === 0) return []

  return parsed.flatMap(entry => {
    if (typeof entry === 'string') {
      return [{ id: entry, deletedAt: new Date().toISOString() }]
    }

    if (!entry || typeof entry !== 'object' || typeof entry.id !== 'string') {
      return []
    }

    return [{
      id: entry.id,
      deletedAt: entry.deletedAt || new Date().toISOString()
    }]
  })
}

export function getDeletedVerseEntries() {
  return normalizeDeletionEntries(localStorage.getItem(DELETED_VERSES_KEY))
}

export function getDeletedCollectionEntries() {
  return normalizeDeletionEntries(localStorage.getItem(DELETED_COLLECTIONS_KEY))
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

  const remoteDeletedVerseEntries = normalizeDeletionEntries(remoteData.deletedVerses)
  const remoteDeletedCollectionEntries = normalizeDeletionEntries(remoteData.deletedCollections)
  const remoteDeletedVerseIds = new Set(remoteDeletedVerseEntries.map(entry => entry.id))
  const remoteDeletedCollectionIds = new Set(remoteDeletedCollectionEntries.map(entry => entry.id))
  const localDeletedVerseIds = new Set(getDeletedVerses())
  const localDeletedCollectionIds = new Set(getDeletedCollections())

  const deletedVerseIds = new Set([...remoteDeletedVerseIds, ...localDeletedVerseIds])
  const deletedCollectionIds = new Set([...remoteDeletedCollectionIds, ...localDeletedCollectionIds])

  const localVerseEntries = getDeletedVerseEntries()
  const localCollectionEntries = getDeletedCollectionEntries()
  const verseEntryMap = new Map(localVerseEntries.map(e => [e.id, e]))
  for (const entry of remoteDeletedVerseEntries) {
    const existing = verseEntryMap.get(entry.id)
    if (!existing) {
      verseEntryMap.set(entry.id, entry)
      continue
    }

    if (new Date(entry.deletedAt).getTime() > new Date(existing.deletedAt).getTime()) {
      verseEntryMap.set(entry.id, entry)
    }
  }
  const collectionEntryMap = new Map(localCollectionEntries.map(e => [e.id, e]))
  for (const entry of remoteDeletedCollectionEntries) {
    const existing = collectionEntryMap.get(entry.id)
    if (!existing) {
      collectionEntryMap.set(entry.id, entry)
      continue
    }

    if (new Date(entry.deletedAt).getTime() > new Date(existing.deletedAt).getTime()) {
      collectionEntryMap.set(entry.id, entry)
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
  const providerId = getActiveProviderId()
  if (!provider) {
    return { success: false, error: 'No sync provider configured', friendlyError: mapSyncError('not configured', null) }
  }

  const settings = provider.getSettings()
  if (!settings) {
    return { success: false, error: `${provider.name} not configured`, friendlyError: mapSyncError('not configured', providerId) }
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
      saveSyncState({ lastSync: new Date().toISOString(), lastStatus: 'success', lastError: null, providerId })
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
    saveSyncState({ lastSync: new Date().toISOString(), lastStatus: 'success', lastError: null, providerId })

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
    const raw = error.message || 'Sync failed'
    const friendly = mapSyncError(error, providerId)
    const prev = getSyncState()
    saveSyncState({
      lastSync: prev.lastSync || null,
      lastStatus: 'error',
      lastError: friendly,
      providerId
    })
    return { success: false, error: raw, friendlyError: friendly }
  }
}
