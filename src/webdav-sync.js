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
 * Get deleted verse IDs
 */
export function getDeletedVerses() {
  const stored = localStorage.getItem(DELETED_VERSES_KEY)
  if (stored) {
    return JSON.parse(stored)
  }
  return []
}

/**
 * Get deleted collection IDs
 */
export function getDeletedCollections() {
  const stored = localStorage.getItem(DELETED_COLLECTIONS_KEY)
  if (stored) {
    return JSON.parse(stored)
  }
  return []
}

/**
 * Add verse ID to deleted list
 */
export function markVerseDeleted(verseId) {
  const deleted = getDeletedVerses()
  if (!deleted.includes(verseId)) {
    deleted.push(verseId)
    localStorage.setItem(DELETED_VERSES_KEY, JSON.stringify(deleted))
    console.log('[WebDAV] Marked verse as deleted:', verseId, 'Deleted list:', deleted)
  }
}

/**
 * Add collection ID to deleted list
 */
export function markCollectionDeleted(collectionId) {
  const deleted = getDeletedCollections()
  if (!deleted.includes(collectionId)) {
    deleted.push(collectionId)
    localStorage.setItem(DELETED_COLLECTIONS_KEY, JSON.stringify(deleted))
    console.log('[WebDAV] Marked collection as deleted:', collectionId, 'Deleted list:', deleted)
  }
}

/**
 * Clear deleted IDs that are no longer in remote data (they've been synced)
 * Note: This is now handled in mergeData, but keeping for backward compatibility
 */
function clearSyncedDeletions(remoteVerses, remoteCollections) {
  // Deletion cleanup is now handled in mergeData
  // This function is kept for backward compatibility but does nothing
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
 * Download data from WebDAV
 */
export async function downloadFromWebDAV() {
  const settings = getWebDAVSettings()
  if (!settings) {
    throw new Error('WebDAV not configured')
  }

  try {
    const client = createWebDAVClient(settings)
    const filePath = getSyncFilePath(settings)
    
    // Check if file exists
    try {
      const fileInfo = await client.stat(filePath)
      if (!fileInfo) {
        console.log('[WebDAV] File does not exist on server, will upload local data')
        return null // No file on server yet
      }
    } catch (err) {
      // File doesn't exist (404 or other error)
      // Check if it's a 404 or similar "not found" error
      if (err.status === 404 || err.message?.includes('404') || err.message?.includes('Not Found') || err.message?.includes('not found')) {
        console.log('[WebDAV] File does not exist on server (404), will upload local data')
        return null
      }
      // For other errors, still return null but log them
      console.warn('[WebDAV] Error checking file existence:', err.message || err)
      return null
    }

    // Read file content
    try {
      const content = await client.getFileContents(filePath, { format: 'text' })
      const data = JSON.parse(content)
      console.log('[WebDAV] Successfully downloaded data from server')
      return data
    } catch (err) {
      // If reading fails, treat as if file doesn't exist
      if (err.status === 404 || err.message?.includes('404') || err.message?.includes('Not Found')) {
        console.log('[WebDAV] File does not exist on server (404), will upload local data')
        return null
      }
      throw err
    }
  } catch (error) {
    // Only throw if it's not a "file not found" error
    if (error.status === 404 || error.message?.includes('404') || error.message?.includes('Not Found')) {
      console.log('[WebDAV] File does not exist on server, will upload local data')
      return null
    }
    console.error('Error downloading from WebDAV:', error)
    throw error
  }
}

/**
 * Upload data to WebDAV
 */
export async function uploadToWebDAV(verses, collections) {
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
    
    // Upload file
    await client.putFileContents(filePath, content, { overwrite: true })
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
 * Merge local and remote data intelligently
 * Strategy: 
 * - Items with same ID: keep the one with more recent lastModified or lastReviewed
 * - New items: add both
 * - Deleted items: merge deletion lists from remote and local, exclude deleted items
 */
function mergeData(localVerses, localCollections, remoteData) {
  if (!remoteData || (!remoteData.verses && !remoteData.collections)) {
    // No remote data, return local
    return {
      verses: localVerses || [],
      collections: localCollections || []
    }
  }

  const remoteVerses = remoteData.verses || []
  const remoteCollections = remoteData.collections || []
  
  // Merge deletion lists from remote and local
  const remoteDeletedVerses = new Set(remoteData.deletedVerses || [])
  const remoteDeletedCollections = new Set(remoteData.deletedCollections || [])
  const localDeletedVerses = new Set(getDeletedVerses())
  const localDeletedCollections = new Set(getDeletedCollections())
  
  console.log('[WebDAV] mergeData - remote deleted collections:', Array.from(remoteDeletedCollections))
  console.log('[WebDAV] mergeData - local deleted collections:', Array.from(localDeletedCollections))
  
  // Combine deletions from both sources
  const allDeletedVerseIds = new Set([...remoteDeletedVerses, ...localDeletedVerses])
  const allDeletedCollectionIds = new Set([...remoteDeletedCollections, ...localDeletedCollections])
  
  // CRITICAL FIX: If an item is in the LOCAL deletion list, NEVER remove it from the deletion list
  // even if it exists in the local array. This handles the case where a collection was just deleted
  // but is still in the local array when mergeData is called (timing issue).
  const localVerseIds = new Set((localVerses || []).map(v => v.id))
  const localCollectionIds = new Set((localCollections || []).map(c => c.id))
  
  // For verses: Keep in deletion list if deleted remotely OR locally
  // Only remove if it exists locally AND is NOT in any deletion list (was re-added)
  const finalDeletedVerseIds = new Set([...allDeletedVerseIds].filter(id => {
    // Always keep if deleted remotely (another device deleted it)
    if (remoteDeletedVerses.has(id)) return true
    // Always keep if deleted locally (we just deleted it) - THIS IS THE KEY FIX
    if (localDeletedVerses.has(id)) return true
    // Only remove if it exists locally but wasn't in any deletion list (was re-added)
    return !localVerseIds.has(id)
  }))
  
  // For collections: Keep in deletion list if deleted remotely OR locally
  // Only remove if it exists locally AND is NOT in any deletion list (was re-added)
  const finalDeletedCollectionIds = new Set([...allDeletedCollectionIds].filter(id => {
    // Always keep if deleted remotely (another device deleted it)
    if (remoteDeletedCollections.has(id)) return true
    // Always keep if deleted locally (we just deleted it) - THIS IS THE KEY FIX
    if (localDeletedCollections.has(id)) return true
    // Only remove if it exists locally but wasn't in any deletion list (was re-added)
    return !localCollectionIds.has(id)
  }))
  
  console.log('[WebDAV] mergeData - final deleted collections:', Array.from(finalDeletedCollectionIds))
  console.log('[WebDAV] mergeData - local collection IDs:', Array.from(localCollectionIds))
  
  // Update localStorage with merged deletion lists
  localStorage.setItem(DELETED_VERSES_KEY, JSON.stringify([...finalDeletedVerseIds]))
  localStorage.setItem(DELETED_COLLECTIONS_KEY, JSON.stringify([...finalDeletedCollectionIds]))
  
  console.log('[WebDAV] Merged deletion lists - verses:', Array.from(finalDeletedVerseIds), 'collections:', Array.from(finalDeletedCollectionIds))

  // Merge verses
  const verseMap = new Map()
  
  // Add all local verses (excluding deleted ones)
  ;(localVerses || []).forEach(verse => {
    // Skip if this verse was deleted (locally or remotely)
    if (finalDeletedVerseIds.has(verse.id)) {
      return
    }
    verseMap.set(verse.id, { ...verse, source: 'local' })
  })
  
  // Merge remote verses (excluding deleted ones)
  remoteVerses.forEach(verse => {
    // Skip if this verse was deleted (locally or remotely)
    if (finalDeletedVerseIds.has(verse.id)) {
      return
    }
    
    const existing = verseMap.get(verse.id)
    if (!existing) {
      // New verse from remote
      verseMap.set(verse.id, { ...verse, source: 'remote' })
    } else {
      // Conflict: intelligently merge verses considering memorization completeness
      // For recently reviewed verses, prioritize lastReviewed over lastModified
      // Compare lastReviewed first if both exist, then fall back to lastModified, then createdAt
      const localLastReviewed = existing.lastReviewed || ''
      const remoteLastReviewed = verse.lastReviewed || ''
      const localLastModified = existing.lastModified || existing.createdAt || ''
      const remoteLastModified = verse.lastModified || verse.createdAt || ''
      
      // Use lastReviewed for comparison if either has it (recent review is most important)
      // Otherwise use lastModified
      const localTimestamp = localLastReviewed || localLastModified
      const remoteTimestamp = remoteLastReviewed || remoteLastModified
      
      // Check memorization completeness
      const remoteHasMemorization = verse.nextReviewDate && verse.interval > 0
      const localHasMemorization = existing.nextReviewDate && existing.interval > 0
      
      // Log merge decision for debugging
      console.log(`[WebDAV] Merging verse ${verse.id} (${verse.reference}):`)
      console.log(`[WebDAV]   Local: lastReviewed=${localLastReviewed || 'none'}, lastModified=${localLastModified || 'none'}, hasMemorization=${localHasMemorization}, interval=${existing.interval || 0}, nextReviewDate=${existing.nextReviewDate || 'none'}`)
      console.log(`[WebDAV]   Remote: lastReviewed=${remoteLastReviewed || 'none'}, lastModified=${remoteLastModified || 'none'}, hasMemorization=${remoteHasMemorization}, interval=${verse.interval || 0}, nextReviewDate=${verse.nextReviewDate || 'none'}`)
      
      let useRemote = false
      let reason = ''
      
      // Priority 1: If remote has memorization progress and local doesn't, prefer remote
      if (remoteHasMemorization && !localHasMemorization) {
        useRemote = true
        reason = 'remote has memorization progress that local lacks'
      }
      // Priority 2: If both have memorization, prioritize newer timestamp (recent review)
      // CRITICAL: Always prioritize lastReviewed if it exists, as it indicates a recent review
      // Special case: If remote timestamp is in the future - only reject when local was RECENTLY
      // updated (we just reviewed). Otherwise could be clock skew; prefer remote if it has more progress.
      // Special case: If local was reviewed today, always keep local (prevents overwriting fresh reviews)
      else if (remoteHasMemorization && localHasMemorization) {
        const now = new Date()
        const nowMs = now.getTime()
        const oneHourMs = 60 * 60 * 1000
        const twoHoursMs = 2 * 60 * 60 * 1000
        const remoteTime = remoteTimestamp ? new Date(remoteTimestamp).getTime() : 0
        const localTime = localTimestamp ? new Date(localTimestamp).getTime() : 0
        const remoteIsFuture = remoteTime > nowMs + oneHourMs
        const localIsRecent = localTime > nowMs - twoHoursMs

        if (remoteIsFuture && localTimestamp && localIsRecent) {
          useRemote = false
          reason = `remote timestamp is in the future (${remoteTimestamp}), local was recently updated - keeping local`
        } else if (remoteIsFuture && verse.interval > existing.interval) {
          useRemote = true
          reason = `remote timestamp appears future (clock skew?), but remote has longer interval (${verse.interval} vs ${existing.interval}) - using remote`
        } else if (remoteIsFuture && localTimestamp) {
          useRemote = false
          reason = `remote timestamp is in the future (${remoteTimestamp}), keeping local`
        } else {
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const localReviewedToday = localLastReviewed && new Date(localLastReviewed) >= today
        const remoteReviewedToday = remoteLastReviewed && new Date(remoteLastReviewed) >= today
        
        // If local was reviewed today but remote wasn't - only keep local if remote doesn't have more progress.
        // (Timezone difference can make "today" differ; remote with longer interval = more reviews = should win)
        if (localReviewedToday && !remoteReviewedToday) {
          if (verse.interval > existing.interval) {
            useRemote = true
            reason = `local reviewed today but remote has longer interval (${verse.interval} vs ${existing.interval}) - using remote`
          } else {
            useRemote = false
            reason = `local was reviewed today (${localLastReviewed}), keeping local version`
          }
        }
        // If remote was reviewed today but local wasn't, use remote
        else if (remoteReviewedToday && !localReviewedToday) {
          useRemote = true
          reason = `remote was reviewed today (${remoteLastReviewed}), using remote version`
        }
        // Both reviewed today or neither, compare timestamps
        else {
          // Compare timestamps first - newer timestamp means more recent review
          // (but we already handled remote-in-future above)
          if (localTimestamp && remoteTimestamp) {
            const localTime = new Date(localTimestamp).getTime()
            const remoteTime = new Date(remoteTimestamp).getTime()
            const timeDiff = Math.abs(localTime - remoteTime)
            const oneMinute = 60 * 1000
            
            // If timestamps differ by more than 1 minute, use the newer one
            if (timeDiff > oneMinute) {
              if (remoteTime > localTime) {
                useRemote = true
                reason = `remote has newer timestamp (${remoteTimestamp} vs ${localTimestamp})`
              } else {
                useRemote = false
                reason = `local has newer timestamp (${localTimestamp} vs ${remoteTimestamp})`
              }
            } else {
              // Timestamps are very close (within 1 minute), use interval as tiebreaker
              if (verse.interval > existing.interval) {
                useRemote = true
                reason = `timestamps close, remote has longer interval (${verse.interval} vs ${existing.interval})`
              } else {
                useRemote = false
                reason = `timestamps close, local has longer or equal interval (${existing.interval} vs ${verse.interval})`
              }
            }
          } else if (remoteTimestamp && !localTimestamp) {
            useRemote = true
            reason = 'remote has timestamp but local does not'
          } else if (!remoteTimestamp && localTimestamp) {
            useRemote = false
            reason = 'local has timestamp but remote does not'
          } else {
            // Neither has timestamp, use interval
            if (verse.interval > existing.interval) {
              useRemote = true
              reason = `no timestamps, remote has longer interval (${verse.interval} vs ${existing.interval})`
            } else {
              useRemote = false
              reason = `no timestamps, local has longer or equal interval (${existing.interval} vs ${verse.interval})`
            }
          }
        }
        }
      }
      // Priority 3: Use timestamp comparison for other cases
      else {
        const nowMs = new Date().getTime()
        const remoteTime = remoteTimestamp ? new Date(remoteTimestamp).getTime() : 0
        const localTime = localTimestamp ? new Date(localTimestamp).getTime() : 0
        const remoteIsFuture = remoteTime > nowMs + 60 * 60 * 1000
        const localIsRecent = localTime > nowMs - 2 * 60 * 60 * 1000
        if (remoteIsFuture && localTimestamp && localIsRecent) {
          useRemote = false
          reason = `remote timestamp is in the future (${remoteTimestamp}), local was recently updated - keeping local`
        } else if (remoteIsFuture && verse.interval > (existing.interval || 0)) {
          useRemote = true
          reason = `remote timestamp appears future (clock skew?), but remote has longer interval - using remote`
        } else if (remoteIsFuture && localTimestamp) {
          useRemote = false
          reason = `remote timestamp is in the future (${remoteTimestamp}), keeping local`
        } else if (remoteTimestamp && localTimestamp) {
          if (remoteTimestamp > localTimestamp) {
            useRemote = true
            reason = `remote has newer timestamp (${remoteTimestamp} vs ${localTimestamp})`
          } else {
            useRemote = false
            reason = `local has newer timestamp (${localTimestamp} vs ${remoteTimestamp})`
          }
        } else if (remoteTimestamp && !localTimestamp) {
          useRemote = true
          reason = 'remote has timestamp but local does not'
        } else if (!remoteTimestamp && localTimestamp) {
          useRemote = false
          reason = 'local has timestamp but remote does not'
        } else {
          useRemote = false
          reason = 'neither has timestamp, keeping local (default)'
        }
      }
      
      if (useRemote) {
        console.log(`[WebDAV] Using remote version for verse ${verse.id}: ${reason}`)
        verseMap.set(verse.id, { ...verse, source: 'merged' })
      } else {
        console.log(`[WebDAV] Keeping local version for verse ${verse.id}: ${reason}`)
        // Local version already in map, no action needed
      }
    }
  })
  
  // Remove 'source' property from merged verses (it was only for debugging)
  const mergedVerses = Array.from(verseMap.values()).map(verse => {
    const { source, ...verseWithoutSource } = verse
    return verseWithoutSource
  })

  // Merge collections
  const collectionMap = new Map()
  
  console.log('[WebDAV] Merging collections - local:', localCollections.length, 'remote:', remoteCollections.length)
  console.log('[WebDAV] Deleted collection IDs:', Array.from(finalDeletedCollectionIds))
  
  // Add all local collections (excluding deleted ones)
  ;(localCollections || []).forEach(collection => {
    // Skip if this collection was deleted (locally or remotely)
    if (finalDeletedCollectionIds.has(collection.id)) {
      console.log('[WebDAV] Skipping deleted local collection:', collection.id)
      return
    }
    collectionMap.set(collection.id, { ...collection, source: 'local' })
  })
  
  // Merge remote collections (excluding deleted ones)
  remoteCollections.forEach(collection => {
    // Skip if this collection was deleted (locally or remotely)
    if (finalDeletedCollectionIds.has(collection.id)) {
      console.log('[WebDAV] Skipping deleted remote collection:', collection.id)
      return
    }
    
    const existing = collectionMap.get(collection.id)
    if (!existing) {
      // New collection from remote
      console.log('[WebDAV] Adding new collection from remote:', collection.id)
      collectionMap.set(collection.id, { ...collection, source: 'remote' })
    } else {
      // Conflict: use the one with more recent modification
      // Prefer lastModified, then createdAt
      const localTime = existing.lastModified || existing.createdAt || ''
      const remoteTime = collection.lastModified || collection.createdAt || ''
      
      if (remoteTime && localTime) {
        if (remoteTime > localTime) {
          collectionMap.set(collection.id, { ...collection, source: 'merged' })
        }
      } else if (remoteTime && !localTime) {
        collectionMap.set(collection.id, { ...collection, source: 'merged' })
      }
      // Otherwise keep local
    }
  })
  
  // Remove 'source' property from merged collections (it was only for debugging)
  const mergedCollections = Array.from(collectionMap.values()).map(collection => {
    const { source, ...collectionWithoutSource } = collection
    return collectionWithoutSource
  })
  console.log('[WebDAV] Merged collections count:', mergedCollections.length)

  return {
    verses: mergedVerses,
    collections: mergedCollections
  }
}

/**
 * Perform two-way sync
 */
export async function syncData(localVerses, localCollections) {
  const settings = getWebDAVSettings()
  if (!settings) {
    return { success: false, error: 'WebDAV not configured' }
  }

  try {
    // Download from WebDAV
    console.log('[WebDAV] Starting sync...')
    const remoteData = await downloadFromWebDAV()
    
    // If no remote data exists, just upload local data
    if (!remoteData) {
      console.log('[WebDAV] No remote data found, uploading local data')
      await uploadToWebDAV(localVerses, localCollections)
      console.log('[WebDAV] Sync complete: uploaded local data')
      return { 
        success: true, 
        action: 'uploaded',
        verses: localVerses,
        collections: localCollections
      }
    }
    
    // Apply remote deletions to local data before merging
    // This ensures that items deleted on other devices are removed locally
    const remoteDeletedVerses = new Set(remoteData.deletedVerses || [])
    const remoteDeletedCollections = new Set(remoteData.deletedCollections || [])
    const localDeletedVerses = new Set(getDeletedVerses())
    const localDeletedCollections = new Set(getDeletedCollections())
    
    console.log('[WebDAV] Remote deletions - verses:', Array.from(remoteDeletedVerses), 'collections:', Array.from(remoteDeletedCollections))
    console.log('[WebDAV] Local deletions before merge - verses:', Array.from(localDeletedVerses), 'collections:', Array.from(localDeletedCollections))
    
    // Filter out ALL deleted items (both remote and local) from local arrays
    // This ensures that locally deleted items don't get re-added from remote
    let cleanedLocalVerses = (localVerses || []).filter(v => {
      return !remoteDeletedVerses.has(v.id) && !localDeletedVerses.has(v.id)
    })
    let cleanedLocalCollections = (localCollections || []).filter(c => {
      return !remoteDeletedCollections.has(c.id) && !localDeletedCollections.has(c.id)
    })
    
    console.log('[WebDAV] After filtering ALL deletions - verses:', cleanedLocalVerses.length, 'collections:', cleanedLocalCollections.length)
    
    // Remove deleted collection IDs from verses (both remote and local deletions)
    const allDeletedCollections = new Set([...remoteDeletedCollections, ...localDeletedCollections])
    cleanedLocalVerses = cleanedLocalVerses.map(verse => {
      if (verse.collectionIds && verse.collectionIds.length > 0) {
        const cleanedCollectionIds = verse.collectionIds.filter(id => !allDeletedCollections.has(id))
        return { ...verse, collectionIds: cleanedCollectionIds }
      }
      return verse
    })
    
    // Merge data (using cleaned local data)
    const merged = mergeData(cleanedLocalVerses, cleanedLocalCollections, remoteData)
    
    // Get the final merged deletion lists (updated by mergeData)
    const finalDeletedVerses = new Set(getDeletedVerses())
    const finalDeletedCollections = new Set(getDeletedCollections())
    
    console.log('[WebDAV] Final deletion lists after merge - verses:', Array.from(finalDeletedVerses), 'collections:', Array.from(finalDeletedCollections))
    console.log('[WebDAV] Merged result before final filter - verses:', merged.verses.length, 'collections:', merged.collections.length)
    
    // Final safety check: ensure no deleted items are in the merged result
    const finalVerses = merged.verses.filter(v => {
      if (finalDeletedVerses.has(v.id)) {
        console.log('[WebDAV] Filtering out deleted verse:', v.id)
        return false
      }
      return true
    })
    const finalCollections = merged.collections.filter(c => {
      if (finalDeletedCollections.has(c.id)) {
        console.log('[WebDAV] Filtering out deleted collection:', c.id)
        return false
      }
      return true
    })
    
    // Remove deleted collection IDs from final verses
    const cleanedFinalVerses = finalVerses.map(verse => {
      if (verse.collectionIds && verse.collectionIds.length > 0) {
        const cleanedCollectionIds = verse.collectionIds.filter(id => !finalDeletedCollections.has(id))
        if (cleanedCollectionIds.length !== verse.collectionIds.length) {
          console.log('[WebDAV] Removed deleted collection IDs from verse:', verse.id, 'removed:', verse.collectionIds.filter(id => finalDeletedCollections.has(id)))
        }
        return { ...verse, collectionIds: cleanedCollectionIds }
      }
      return verse
    })
    
    console.log('[WebDAV] Final result after filtering - verses:', cleanedFinalVerses.length, 'collections:', finalCollections.length)
    
    // Upload merged data (with deletions included in the upload)
    await uploadToWebDAV(cleanedFinalVerses, finalCollections)
    
    // Clear deletions that have been synced (no longer in remote data)
    clearSyncedDeletions(remoteData.verses, remoteData.collections)
    
    return {
      success: true,
      action: 'synced',
      verses: cleanedFinalVerses,
      collections: finalCollections
    }
  } catch (error) {
    console.error('Sync error:', error)
    return {
      success: false,
      error: error.message || 'Sync failed'
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
