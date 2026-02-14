const STORAGE_KEY = 'bible-memory-verses'
const COLLECTIONS_KEY = 'bible-memory-collections'
const WEBDAV_SETTINGS_KEY = 'bible-memory-webdav-settings'
const SYNC_STATE_KEY = 'bible-memory-sync-state'
const DELETED_VERSES_KEY = 'bible-memory-deleted-verses'
const DELETED_COLLECTIONS_KEY = 'bible-memory-deleted-collections'

// Default filename for synced data
const SYNC_FILENAME = 'bible-memory-data.json'

/**
 * Get WebDAV settings from localStorage
 */
export function getWebDAVSettings() {
  const stored = localStorage.getItem(WEBDAV_SETTINGS_KEY)
  if (stored) {
    return JSON.parse(stored)
  }
  return null
}

/**
 * Save WebDAV settings to localStorage
 */
export function saveWebDAVSettings(settings) {
  localStorage.setItem(WEBDAV_SETTINGS_KEY, JSON.stringify(settings))
}

/**
 * Get sync state (last sync timestamp, etc.)
 */
function getSyncState() {
  const stored = localStorage.getItem(SYNC_STATE_KEY)
  if (stored) {
    return JSON.parse(stored)
  }
  return { lastSync: null }
}

/**
 * Save sync state
 */
function saveSyncState(state) {
  localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(state))
}

/**
 * Migrate deletion list from old format (string[]) to new format ({id, deletedAt}[]).
 * Old bare string IDs get deletedAt = now.
 */
function migrateDeletionList(stored) {
  if (!stored) return []
  const parsed = JSON.parse(stored)
  if (!Array.isArray(parsed)) return []
  if (parsed.length === 0) return []
  // If first entry is a string, migrate the whole list
  if (typeof parsed[0] === 'string') {
    const now = new Date().toISOString()
    return parsed.map(id => ({ id, deletedAt: now }))
  }
  return parsed
}

/**
 * Get deleted verse entries with timestamps
 */
export function getDeletedVerseEntries() {
  return migrateDeletionList(localStorage.getItem(DELETED_VERSES_KEY))
}

/**
 * Get deleted collection entries with timestamps
 */
export function getDeletedCollectionEntries() {
  return migrateDeletionList(localStorage.getItem(DELETED_COLLECTIONS_KEY))
}

/**
 * Get deleted verse IDs (convenience — returns just the ID strings)
 */
export function getDeletedVerses() {
  return getDeletedVerseEntries().map(e => e.id)
}

/**
 * Get deleted collection IDs (convenience — returns just the ID strings)
 */
export function getDeletedCollections() {
  return getDeletedCollectionEntries().map(e => e.id)
}

/**
 * Add verse ID to deleted list
 */
export function markVerseDeleted(verseId) {
  const entries = getDeletedVerseEntries()
  if (!entries.some(e => e.id === verseId)) {
    entries.push({ id: verseId, deletedAt: new Date().toISOString() })
    localStorage.setItem(DELETED_VERSES_KEY, JSON.stringify(entries))
    console.log('[WebDAV] Marked verse as deleted:', verseId)
  }
}

/**
 * Add collection ID to deleted list
 */
export function markCollectionDeleted(collectionId) {
  const entries = getDeletedCollectionEntries()
  if (!entries.some(e => e.id === collectionId)) {
    entries.push({ id: collectionId, deletedAt: new Date().toISOString() })
    localStorage.setItem(DELETED_COLLECTIONS_KEY, JSON.stringify(entries))
    console.log('[WebDAV] Marked collection as deleted:', collectionId)
  }
}

/**
 * Prune deletion entries that are no longer needed.
 * A deletion entry is only needed if the item still exists in remote data
 * (so the other side knows to delete it). Once the remote no longer has it,
 * the deletion has taken effect and can be forgotten.
 * As a safety margin, keep entries younger than 7 days even if not in remote,
 * in case remote hasn't synced yet.
 */
function pruneDeletionList(entries, remoteIds) {
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000
  const cutoff = Date.now() - sevenDaysMs
  return entries.filter(entry => {
    const deletedAtMs = new Date(entry.deletedAt).getTime()
    // Keep if still present in remote (deletion not yet effective) OR younger than 7 days
    return remoteIds.has(entry.id) || deletedAtMs > cutoff
  })
}

/**
 * Detect if we're in production
 */
function isProduction() {
  if (typeof window === 'undefined') return false
  const hostname = window.location.hostname
  // Check if we're on the production domain
  return hostname === 'bible-memory.unrau.xyz' || hostname.includes('unrau.xyz')
}


/**
 * Build the full URL for the sync file, applying proxy logic.
 * Returns { url, headers } where headers includes auth and proxy headers.
 */
function buildSyncFileUrl(settings) {
  let baseUrl = settings.url.trim()
  const headers = {
    'Authorization': 'Basic ' + btoa(settings.username + ':' + settings.password)
  }

  const shouldUseProxy = isProduction() || settings.useProxy

  if (shouldUseProxy) {
    let proxyUrl
    if (isProduction()) {
      proxyUrl = window.location.origin + '/api/webdav'
    } else {
      proxyUrl = (settings.proxyUrl || 'http://localhost:3001').trim()
    }

    // Tell the proxy where to forward requests
    headers['X-WebDAV-Target'] = baseUrl

    try {
      const nextcloudUrl = new URL(baseUrl)
      baseUrl = proxyUrl + nextcloudUrl.pathname
    } catch (e) {
      baseUrl = proxyUrl
    }
  }

  if (!baseUrl.endsWith('/')) baseUrl += '/'

  if (settings.folder && settings.folder.trim()) {
    const folder = settings.folder.trim().replace(/^\//, '').replace(/\/$/, '')
    if (folder) baseUrl += folder + '/'
  }

  return { url: baseUrl + SYNC_FILENAME, headers }
}

/**
 * Download data from WebDAV.
 */
export async function downloadFromWebDAV() {
  const settings = getWebDAVSettings()
  if (!settings) throw new Error('WebDAV not configured')

  const { url, headers } = buildSyncFileUrl(settings)

  try {
    const response = await fetch(url, { method: 'GET', headers })

    if (response.status === 404) {
      console.log('[WebDAV] File does not exist on server (404), will upload local data')
      return { data: null }
    }

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`)
    }

    const text = await response.text()
    const data = JSON.parse(text)
    console.log('[WebDAV] Successfully downloaded data from server')
    return { data }
  } catch (error) {
    if (error.message?.includes('404')) {
      return { data: null }
    }
    console.error('Error downloading from WebDAV:', error)
    throw error
  }
}

/**
 * Upload data to WebDAV using a simple PUT request.
 * Only includes deletion IDs that are still relevant (items that exist in
 * the active verse/collection set being uploaded need not be tracked as deleted).
 */
export async function uploadToWebDAV(verses, collections, remoteData) {
  const settings = getWebDAVSettings()
  if (!settings) throw new Error('WebDAV not configured')

  const { url, headers } = buildSyncFileUrl(settings)

  // Only include deletion IDs that still appear in remote data —
  // if the remote doesn't have the item, the deletion is already effective
  const activeVerseIds = new Set((verses || []).map(v => v.id))
  const activeCollectionIds = new Set((collections || []).map(c => c.id))
  const remoteVerseIds = new Set((remoteData?.verses || []).map(v => v.id))
  const remoteCollectionIds = new Set((remoteData?.collections || []).map(c => c.id))

  const deletedVerses = getDeletedVerses().filter(id =>
    !activeVerseIds.has(id) && remoteVerseIds.has(id)
  )
  const deletedCollections = getDeletedCollections().filter(id =>
    !activeCollectionIds.has(id) && remoteCollectionIds.has(id)
  )

  const data = {
    verses: verses || [],
    collections: collections || [],
    deletedVerses,
    deletedCollections,
    syncedAt: new Date().toISOString()
  }

  // Use compact JSON (no pretty-printing) to minimize payload size
  const content = JSON.stringify(data)
  console.log(`[WebDAV] Uploading ${data.verses.length} verses and ${data.collections.length} collections`)
  console.log(`[WebDAV] Uploading ${deletedVerses.length} deleted verses and ${deletedCollections.length} deleted collections`)

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      ...headers,
      'Content-Type': 'application/json'
    },
    body: content
  })

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status} ${response.statusText}`)
  }

  console.log('[WebDAV] Successfully uploaded data')
  saveSyncState({ lastSync: new Date().toISOString() })
  return true
}

/**
 * Resolve a conflict between local and remote versions of the same verse.
 * Returns true if remote should be used, false to keep local.
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

  // Step 1: Reject future remote timestamps (unless remote has strictly more progress)
  const remoteTimestamp = remoteLastReviewed || remoteLastModified
  if (remoteTimestamp > nowMs + oneHourMs) {
    if ((remote.interval || 0) > (local.interval || 0)) {
      return { useRemote: true, reason: 'remote timestamp future (clock skew?), but remote has more progress' }
    }
    return { useRemote: false, reason: 'remote timestamp is in the future, keeping local' }
  }

  // Step 2: Compare lastReviewed (most important signal)
  if (localLastReviewed && remoteLastReviewed) {
    if (remoteLastReviewed > localLastReviewed) {
      return { useRemote: true, reason: 'remote has newer lastReviewed' }
    }
    if (localLastReviewed > remoteLastReviewed) {
      return { useRemote: false, reason: 'local has newer lastReviewed' }
    }
    // lastReviewed is equal — fall through to tiebreaker
  } else if (remoteLastReviewed && !localLastReviewed) {
    return { useRemote: true, reason: 'remote has lastReviewed, local does not' }
  } else if (localLastReviewed && !remoteLastReviewed) {
    return { useRemote: false, reason: 'local has lastReviewed, remote does not' }
  }

  // Step 3: Compare lastModified
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

  // Step 4: Tiebreaker — longer interval means more review progress
  if ((remote.interval || 0) > (local.interval || 0)) {
    return { useRemote: true, reason: 'timestamps equal, remote has longer interval' }
  }

  // Step 5: Default — keep local
  return { useRemote: false, reason: 'keeping local (default)' }
}

/**
 * Merge local and remote data.
 * - Combines deletion lists from both sides
 * - Excludes deleted items
 * - Resolves per-item conflicts using resolveVerseConflict
 * - Cleans deleted collection IDs from verse.collectionIds
 */
function mergeData(localVerses, localCollections, remoteData) {
  if (!remoteData || (!remoteData.verses && !remoteData.collections)) {
    return { verses: localVerses || [], collections: localCollections || [] }
  }

  const remoteVerses = remoteData.verses || []
  const remoteCollections = remoteData.collections || []

  // Build combined deletion sets (union of remote + local)
  const remoteDeletedVerseIds = new Set(remoteData.deletedVerses || [])
  const remoteDeletedCollectionIds = new Set(remoteData.deletedCollections || [])
  const localDeletedVerseIds = new Set(getDeletedVerses())
  const localDeletedCollectionIds = new Set(getDeletedCollections())

  const deletedVerseIds = new Set([...remoteDeletedVerseIds, ...localDeletedVerseIds])
  const deletedCollectionIds = new Set([...remoteDeletedCollectionIds, ...localDeletedCollectionIds])

  // Persist merged deletion lists (with timestamps for pruning).
  // Only keep entries where the item actually exists in local or remote active data —
  // if neither side has it, the deletion is already effective.
  const localVerseEntries = getDeletedVerseEntries()
  const localCollectionEntries = getDeletedCollectionEntries()
  const now = new Date().toISOString()

  const localActiveVerseIds = new Set((localVerses || []).map(v => v.id))
  const remoteActiveVerseIds = new Set(remoteVerses.map(v => v.id))
  const localActiveCollectionIds = new Set((localCollections || []).map(c => c.id))
  const remoteActiveCollectionIds = new Set(remoteCollections.map(c => c.id))

  // Build entries map from local entries, then selectively add remote deletions.
  // Only import a remote deletion if the item exists locally (so we know to remove it).
  // If neither side has the item as active data, the deletion is already effective
  // and there's no reason to store it locally.
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

  // Filter existing local entries: remove those where the item no longer exists anywhere
  for (const [id, entry] of verseEntryMap) {
    const stillExists = localActiveVerseIds.has(id) || remoteActiveVerseIds.has(id)
    if (!stillExists) {
      verseEntryMap.delete(id)
    }
  }
  for (const [id, entry] of collectionEntryMap) {
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
      console.log(`[WebDAV] Merge ${verse.id} (${verse.reference}): ${reason}`)
      if (useRemote) {
        verseMap.set(verse.id, verse)
      }
    }
  }

  // Clean deleted collection IDs from verses
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
    collections: Array.from(collectionMap.values())
  }
}

/**
 * Perform two-way sync: download, merge, upload.
 */
export async function syncData(localVerses, localCollections) {
  const settings = getWebDAVSettings()
  if (!settings) {
    return { success: false, error: 'WebDAV not configured' }
  }

  try {
    console.log('[WebDAV] Starting sync...')
    const { data: remoteData } = await downloadFromWebDAV()

    // No remote data — just upload local data (no deletions needed since remote is empty)
    if (!remoteData) {
      console.log('[WebDAV] No remote data found, uploading local data')
      await uploadToWebDAV(localVerses, localCollections, null)
      return { success: true, action: 'uploaded', verses: localVerses, collections: localCollections }
    }

    // Merge local + remote
    const merged = mergeData(localVerses, localCollections, remoteData)

    // Upload merged data, passing remoteData so we can filter deletion lists
    await uploadToWebDAV(merged.verses, merged.collections, remoteData)

    // Prune old deletion entries after successful sync
    const remoteVerseIds = new Set((remoteData.verses || []).map(v => v.id))
    const remoteCollectionIds = new Set((remoteData.collections || []).map(c => c.id))
    const prunedVerseEntries = pruneDeletionList(getDeletedVerseEntries(), remoteVerseIds)
    const prunedCollectionEntries = pruneDeletionList(getDeletedCollectionEntries(), remoteCollectionIds)
    localStorage.setItem(DELETED_VERSES_KEY, JSON.stringify(prunedVerseEntries))
    localStorage.setItem(DELETED_COLLECTIONS_KEY, JSON.stringify(prunedCollectionEntries))

    return { success: true, action: 'synced', verses: merged.verses, collections: merged.collections }
  } catch (error) {
    console.error('Sync error:', error)
    return { success: false, error: error.message || 'Sync failed' }
  }
}

/**
 * Test WebDAV connection
 */
export async function testWebDAVConnection(settings) {
  try {
    const { url, headers } = buildSyncFileUrl(settings)

    // Try a PROPFIND on the parent directory to test auth
    const parentUrl = url.substring(0, url.lastIndexOf('/') + 1)
    const response = await fetch(parentUrl, {
      method: 'PROPFIND',
      headers: {
        ...headers,
        'Depth': '0'
      }
    })

    if (response.status === 401) {
      return { success: false, error: 'Authentication failed: Check your username and password are correct.' }
    }
    if (response.status === 403) {
      return { success: false, error: 'Access forbidden: Check your credentials and folder permissions.' }
    }
    if (response.status === 404) {
      return { success: false, error: 'Server not found: Check that the URL is correct and the server is accessible.' }
    }
    if (!response.ok && response.status !== 207) {
      return { success: false, error: `Connection failed: ${response.status} ${response.statusText}` }
    }

    return { success: true }
  } catch (error) {
    let errorMessage = error.message || String(error) || 'Connection failed'
    const errorString = errorMessage.toLowerCase()

    if (errorString.includes('failed to fetch') ||
        errorString.includes('cors') ||
        errorString.includes('networkerror') ||
        (error.name === 'TypeError' && errorString.includes('fetch'))) {
      errorMessage = 'CORS Error: The WebDAV server is blocking requests from your browser.\n\n' +
        'Possible solutions:\n' +
        '• Configure your WebDAV server to allow CORS (add CORS headers)\n' +
        '• Use a CORS proxy service\n' +
        '• Verify the URL is correct and accessible'
    } else if (errorString.includes('timeout')) {
      errorMessage = 'Connection timeout: The server took too long to respond. Check the URL and try again.'
    }

    return { success: false, error: errorMessage }
  }
}
