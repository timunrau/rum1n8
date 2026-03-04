import { getDeletedVerses, getDeletedCollections } from '../sync-manager.js'

const WEBDAV_SETTINGS_KEY = 'rum1n8-webdav-settings'
const SYNC_FILENAME = 'rum1n8-data.json'
const LEGACY_SYNC_FILENAME = 'bible-memory-data.json'

function isProduction() {
  if (typeof window === 'undefined') return false
  const hostname = window.location.hostname
  return hostname === 'bible-memory.unrau.xyz' || hostname.includes('unrau.xyz')
}

function buildSyncFileUrl(settings, filename = SYNC_FILENAME) {
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

  return { url: baseUrl + filename, headers }
}

const isDev = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')

export default {
  id: 'webdav',
  name: 'WebDAV',

  getSettingsFields() {
    return [
      {
        key: 'url',
        label: 'WebDAV Server URL',
        type: 'url',
        placeholder: 'https://example.com/webdav',
        hint: 'Full URL to your WebDAV server',
        required: true
      },
      {
        key: 'folder',
        label: 'Folder Path (optional)',
        type: 'text',
        placeholder: 'rum1n8',
        hint: 'Subfolder path on your WebDAV server (leave empty for root)',
        required: false
      },
      {
        key: 'username',
        label: 'Username',
        type: 'text',
        placeholder: 'your-username',
        required: true
      },
      {
        key: 'password',
        label: 'Password',
        type: 'password',
        placeholder: 'your-password',
        required: true
      },
      {
        key: 'useProxy',
        label: 'Use CORS Proxy (for development with Nextcloud)',
        type: 'checkbox',
        devOnly: true
      },
      {
        key: 'proxyUrl',
        label: 'Proxy Server URL',
        type: 'url',
        placeholder: 'http://localhost:3001',
        hint: 'URL of the CORS proxy server (default: http://localhost:3001)',
        devOnly: true,
        showIf: (settings) => settings.useProxy
      }
    ]
  },

  getSettings() {
    const stored = localStorage.getItem(WEBDAV_SETTINGS_KEY)
    return stored ? JSON.parse(stored) : null
  },

  saveSettings(settings) {
    localStorage.setItem(WEBDAV_SETTINGS_KEY, JSON.stringify(settings))
  },

  clearSettings() {
    localStorage.removeItem(WEBDAV_SETTINGS_KEY)
  },

  isConfigured() {
    const settings = this.getSettings()
    return !!(settings && settings.url && settings.username && settings.password)
  },

  async testConnection(settings) {
    try {
      const { url, headers } = buildSyncFileUrl(settings)
      const parentUrl = url.substring(0, url.lastIndexOf('/') + 1)
      const response = await fetch(parentUrl, {
        method: 'PROPFIND',
        headers: { ...headers, 'Depth': '0' }
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
  },

  async download(settings) {
    const { url, headers } = buildSyncFileUrl(settings)

    try {
      const response = await fetch(url, { method: 'GET', headers })
      if (response.ok) {
        const data = JSON.parse(await response.text())
        console.log('[WebDAV] Successfully downloaded data from server')
        return { data }
      }
      if (!response.ok && response.status !== 404) {
        throw new Error(`Download failed: ${response.status} ${response.statusText}`)
      }
    } catch (error) {
      if (!error.message?.includes('404')) {
        console.error('Error downloading from WebDAV:', error)
        throw error
      }
    }

    // Fallback to legacy filename
    const legacy = buildSyncFileUrl(settings, LEGACY_SYNC_FILENAME)
    try {
      const response = await fetch(legacy.url, { method: 'GET', headers: legacy.headers })
      if (response.ok) {
        const data = JSON.parse(await response.text())
        console.log('[WebDAV] Downloaded data from legacy filename (bible-memory-data.json)')
        return { data }
      }
      if (response.status === 404) {
        console.log('[WebDAV] No data file found on server, will upload local data')
        return { data: null }
      }
      throw new Error(`Download failed: ${response.status} ${response.statusText}`)
    } catch (error) {
      if (error.message?.includes('404')) return { data: null }
      console.error('Error downloading from WebDAV:', error)
      throw error
    }
  },

  async upload(settings, verses, collections, remoteData) {
    const { url, headers } = buildSyncFileUrl(settings)

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

    const content = JSON.stringify(data)
    console.log(`[WebDAV] Uploading ${data.verses.length} verses and ${data.collections.length} collections`)

    const response = await fetch(url, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: content
    })

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status} ${response.statusText}`)
    }

    console.log('[WebDAV] Successfully uploaded data')
  }
}
