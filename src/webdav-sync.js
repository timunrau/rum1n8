import { createClient } from 'webdav'

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
 * Prune deletion entries older than 30 days that no longer appear in remote data.
 * Both conditions must be true before an entry is removed.
 */
function pruneDeletionList(entries, remoteIds) {
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000
  const cutoff = Date.now() - thirtyDaysMs
  return entries.filter(entry => {
    const age = new Date(entry.deletedAt).getTime()
    // Keep if younger than 30 days OR still present in remote data
    return age > cutoff || remoteIds.has(entry.id)
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
 * Create WebDAV client from settings
 */
function createWebDAVClient(settings) {
  if (!settings || !settings.url || !settings.username || !settings.password) {
    throw new Error('WebDAV settings incomplete')
  }

  let baseUrl = settings.url.trim()
  let proxyUrl = null
  let customHeaders = {}
  
  // In production, always use the proxy to avoid CORS issues
  // In development, use proxy if explicitly enabled
  const shouldUseProxy = isProduction() || settings.useProxy
  
  console.log('[WebDAV] isProduction:', isProduction())
  console.log('[WebDAV] shouldUseProxy:', shouldUseProxy)
  console.log('[WebDAV] Original baseUrl:', baseUrl)
  
  if (shouldUseProxy) {
    // In production, use the nginx proxy endpoint (absolute URL needed for webdav library)
    if (isProduction()) {
      // Use absolute URL so webdav library doesn't try to resolve relative paths
      proxyUrl = window.location.origin + '/api/webdav'
    } else {
      // In development, use the explicit proxy URL or default
      proxyUrl = (settings.proxyUrl || 'http://localhost:3001').trim()
    }
    
    // Parse the Nextcloud URL to get the path
    try {
      const nextcloudUrl = new URL(baseUrl)
      const nextcloudPath = nextcloudUrl.pathname
      
      // For production proxy, pass the target URL via custom header
      // and use the proxy endpoint with the Nextcloud path
      if (isProduction()) {
        // Store the original target URL in a header for the proxy to use
        const originalTargetUrl = baseUrl
        customHeaders['X-WebDAV-Target'] = originalTargetUrl
        // Use proxy endpoint with the Nextcloud path
        baseUrl = proxyUrl + nextcloudPath
        console.log('[WebDAV] Production mode - using proxy:', proxyUrl)
        console.log('[WebDAV] Setting X-WebDAV-Target header to:', originalTargetUrl)
        console.log('[WebDAV] Final baseUrl for client:', baseUrl)
      } else {
        // Use proxy URL as base, but we need to prepend the Nextcloud path to all requests
        // The webdav library will append paths to the base URL, so we need to include
        // the Nextcloud path in the base URL when using proxy
        baseUrl = proxyUrl + nextcloudPath
        console.log('[WebDAV] Development mode - using proxy:', baseUrl)
      }
    } catch (e) {
      // If URL parsing fails, just use proxy URL
      if (isProduction()) {
        customHeaders['X-WebDAV-Target'] = baseUrl
        baseUrl = proxyUrl
        console.log('[WebDAV] URL parse error in production, using proxy:', baseUrl)
      } else {
        baseUrl = proxyUrl
        console.log('[WebDAV] URL parse error, using proxy:', baseUrl)
      }
    }
  }

  // Ensure URL ends with /
  if (!baseUrl.endsWith('/')) {
    baseUrl += '/'
  }

  // Add folder path if specified
  let path = baseUrl
  if (settings.folder && settings.folder.trim()) {
    const folder = settings.folder.trim().replace(/^\//, '').replace(/\/$/, '')
    if (folder) {
      path = baseUrl + folder + '/'
    }
  }

  // Build client options
  const clientOptions = {
    username: settings.username,
    password: settings.password
  }
  
  // Add custom headers if using proxy in production
  if (Object.keys(customHeaders).length > 0) {
    clientOptions.headers = customHeaders
  }

  return createClient(path, clientOptions)
}

/**
 * Get full file path for sync file
 * Note: The folder is already included in the client's baseUrl, so we just return the filename
 */
function getSyncFilePath(settings) {
  // The folder is already included in the baseUrl when creating the client,
  // so we just need to return the filename
  return SYNC_FILENAME
}

/**
 * Check if an error is a "not found" (404) response
 */
function isNotFoundError(err) {
  return err.status === 404 ||
    err.message?.includes('404') ||
    err.message?.includes('Not Found') ||
    err.message?.includes('not found')
}

/**
 * Download data from WebDAV. Returns { data, etag } where etag may be null.
 */
export async function downloadFromWebDAV() {
  const settings = getWebDAVSettings()
  if (!settings) {
    throw new Error('WebDAV not configured')
  }

  try {
    const client = createWebDAVClient(settings)
    const filePath = getSyncFilePath(settings)

    // Check if file exists and get its ETag
    let etag = null
    try {
      const fileInfo = await client.stat(filePath)
      if (!fileInfo) {
        console.log('[WebDAV] File does not exist on server, will upload local data')
        return { data: null, etag: null }
      }
      etag = fileInfo.etag || null
    } catch (err) {
      if (isNotFoundError(err)) {
        console.log('[WebDAV] File does not exist on server (404), will upload local data')
        return { data: null, etag: null }
      }
      console.warn('[WebDAV] Error checking file existence:', err.message || err)
      return { data: null, etag: null }
    }

    // Read file content
    try {
      const content = await client.getFileContents(filePath, { format: 'text' })
      const data = JSON.parse(content)
      console.log('[WebDAV] Successfully downloaded data from server')
      return { data, etag }
    } catch (err) {
      if (isNotFoundError(err)) {
        console.log('[WebDAV] File does not exist on server (404), will upload local data')
        return { data: null, etag: null }
      }
      throw err
    }
  } catch (error) {
    if (isNotFoundError(error)) {
      console.log('[WebDAV] File does not exist on server, will upload local data')
      return { data: null, etag: null }
    }
    console.error('Error downloading from WebDAV:', error)
    throw error
  }
}

/**
 * Upload data to WebDAV.
 * If etag is provided, uses If-Match for optimistic concurrency.
 * Throws an error with status 412 if the file was modified since download.
 */
export async function uploadToWebDAV(verses, collections, etag) {
  const settings = getWebDAVSettings()
  if (!settings) {
    throw new Error('WebDAV not configured')
  }

  try {
    const client = createWebDAVClient(settings)
    const filePath = getSyncFilePath(settings)
    
    console.log(`[WebDAV] Uploading data to: ${filePath}`)
    
    // Get deleted IDs to include in sync data
    const deletedVerses = getDeletedVerses()
    const deletedCollections = getDeletedCollections()
    
    // Prepare data to upload
    const data = {
      verses: verses || [],
      collections: collections || [],
      deletedVerses: deletedVerses || [],
      deletedCollections: deletedCollections || [],
      syncedAt: new Date().toISOString()
    }
    
    const content = JSON.stringify(data, null, 2)
    console.log(`[WebDAV] Uploading ${data.verses.length} verses and ${data.collections.length} collections`)
    console.log(`[WebDAV] Uploading ${deletedVerses.length} deleted verses and ${deletedCollections.length} deleted collections`)
    
    // Ensure directory exists (for folder option, though Nextcloud paths usually don't need this)
    if (settings.folder && settings.folder.trim()) {
      const folder = settings.folder.trim().replace(/^\//, '').replace(/\/$/, '')
      if (folder) {
        const folderPath = folder.split('/')
        let currentPath = ''
        for (const segment of folderPath) {
          currentPath += '/' + segment
          try {
            await client.createDirectory(currentPath)
            console.log(`[WebDAV] Created directory: ${currentPath}`)
          } catch (err) {
            // Directory might already exist, ignore
            if (!err.message?.includes('405') && !err.message?.includes('Method Not Allowed')) {
              console.log(`[WebDAV] Directory ${currentPath} already exists or cannot be created`)
            }
          }
        }
      }
    }
    
    // Upload file (with optimistic concurrency if ETag available)
    const putOptions = { overwrite: true }
    if (etag) {
      putOptions.headers = { 'If-Match': etag }
    }
    await client.putFileContents(filePath, content, putOptions)
    console.log(`[WebDAV] Successfully uploaded data to ${filePath}`)
    
    // Update sync state
    saveSyncState({ lastSync: new Date().toISOString() })
    
    return true
  } catch (error) {
    console.error('[WebDAV] Error uploading to WebDAV:', error)
    throw error
  }
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

  // Persist merged deletion lists (with timestamps for pruning)
  const localVerseEntries = getDeletedVerseEntries()
  const localCollectionEntries = getDeletedCollectionEntries()
  const now = new Date().toISOString()

  // Build entries map from local entries, then add any new remote-only deletions
  const verseEntryMap = new Map(localVerseEntries.map(e => [e.id, e]))
  for (const id of remoteDeletedVerseIds) {
    if (!verseEntryMap.has(id)) {
      verseEntryMap.set(id, { id, deletedAt: now })
    }
  }
  const collectionEntryMap = new Map(localCollectionEntries.map(e => [e.id, e]))
  for (const id of remoteDeletedCollectionIds) {
    if (!collectionEntryMap.has(id)) {
      collectionEntryMap.set(id, { id, deletedAt: now })
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
 * Perform two-way sync with optimistic concurrency.
 * If maxRetries > 0, retries on ETag conflict (412).
 */
export async function syncData(localVerses, localCollections, maxRetries = 1) {
  const settings = getWebDAVSettings()
  if (!settings) {
    return { success: false, error: 'WebDAV not configured' }
  }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[WebDAV] Starting sync (attempt ${attempt + 1})...`)
      const { data: remoteData, etag } = await downloadFromWebDAV()

      // No remote data — just upload local data
      if (!remoteData) {
        console.log('[WebDAV] No remote data found, uploading local data')
        await uploadToWebDAV(localVerses, localCollections)
        return { success: true, action: 'uploaded', verses: localVerses, collections: localCollections }
      }

      // Merge local + remote (mergeData handles all deletion filtering internally)
      const merged = mergeData(localVerses, localCollections, remoteData)

      // Upload merged data (ETag enables optimistic concurrency)
      await uploadToWebDAV(merged.verses, merged.collections, etag)

      // Prune old deletion entries after successful sync
      const remoteVerseIds = new Set((remoteData.verses || []).map(v => v.id))
      const remoteCollectionIds = new Set((remoteData.collections || []).map(c => c.id))
      const prunedVerseEntries = pruneDeletionList(getDeletedVerseEntries(), remoteVerseIds)
      const prunedCollectionEntries = pruneDeletionList(getDeletedCollectionEntries(), remoteCollectionIds)
      localStorage.setItem(DELETED_VERSES_KEY, JSON.stringify(prunedVerseEntries))
      localStorage.setItem(DELETED_COLLECTIONS_KEY, JSON.stringify(prunedCollectionEntries))

      return { success: true, action: 'synced', verses: merged.verses, collections: merged.collections }
    } catch (error) {
      // Retry on 412 Precondition Failed (ETag mismatch = concurrent edit)
      const is412 = error.status === 412 || error.message?.includes('412') || error.message?.includes('Precondition Failed')
      if (is412 && attempt < maxRetries) {
        console.log('[WebDAV] Conflict detected (412), retrying...')
        continue
      }
      console.error('Sync error:', error)
      return { success: false, error: error.message || 'Sync failed' }
    }
  }
}

/**
 * Test WebDAV connection
 */
export async function testWebDAVConnection(settings) {
  try {
    const client = createWebDAVClient(settings)
    const filePath = getSyncFilePath(settings)
    
    // Try to list directory (this tests authentication)
    const parentDir = filePath.substring(0, filePath.lastIndexOf('/') || 0) || '/'
    await client.getDirectoryContents(parentDir || '/')
    
    return { success: true }
  } catch (error) {
    let errorMessage = error.message || String(error) || 'Connection failed'
    const errorString = errorMessage.toLowerCase()
    
    // Check for CORS/fetch errors (most common issue)
    if (errorString.includes('failed to fetch') || 
        errorString.includes('fetch') ||
        errorString.includes('cors') ||
        errorString.includes('networkerror') ||
        (error.name && error.name === 'TypeError' && errorString.includes('fetch'))) {
      errorMessage = 'CORS Error: The WebDAV server is blocking requests from your browser.\n\n' +
        'Possible solutions:\n' +
        '• Configure your WebDAV server to allow CORS (add CORS headers)\n' +
        '• Use a CORS proxy service\n' +
        '• Verify the URL is correct and accessible\n' +
        '• Some servers (Nextcloud, ownCloud) may need special configuration for browser access'
    } else if (errorString.includes('401') || errorString.includes('unauthorized')) {
      errorMessage = 'Authentication failed: Check your username and password are correct.'
    } else if (errorString.includes('404') || errorString.includes('not found')) {
      errorMessage = 'Server not found: Check that the URL is correct and the server is accessible.'
    } else if (errorString.includes('403') || errorString.includes('forbidden')) {
      errorMessage = 'Access forbidden: Check your credentials and folder permissions.'
    } else if (errorString.includes('networkerror') || errorString.includes('network')) {
      errorMessage = 'Network error: Check your internet connection and that the server URL is correct.'
    } else if (errorString.includes('timeout')) {
      errorMessage = 'Connection timeout: The server took too long to respond. Check the URL and try again.'
    }
    
    return {
      success: false,
      error: errorMessage
    }
  }
}
