import { getDeletedVerses, getDeletedCollections } from '../sync-manager.js'

const GDRIVE_SETTINGS_KEY = 'rum1n8-gdrive-settings'
const SYNC_FILENAME = 'rum1n8-data.json'
const FOLDER_NAME = 'rum1n8'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
const GOOGLE_CLIENT_SECRET = import.meta.env.VITE_GOOGLE_CLIENT_SECRET || ''

// --- Token management ---

function isTokenExpired(settings) {
  if (!settings?.tokenExpiry) return true
  return new Date(settings.tokenExpiry).getTime() < Date.now() + 60000 // 1 min buffer
}

async function refreshAccessToken(settings) {
  if (!settings?.refreshToken) {
    throw new Error('No refresh token available. Please sign in again.')
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: settings.refreshToken,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      grant_type: 'refresh_token'
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    if (error.error === 'invalid_grant') {
      throw new Error('Google sign-in expired. Please sign in again.')
    }
    throw new Error(`Token refresh failed: ${response.status}`)
  }

  const data = await response.json()
  const updated = {
    ...settings,
    accessToken: data.access_token,
    tokenExpiry: new Date(Date.now() + data.expires_in * 1000).toISOString()
  }
  localStorage.setItem(GDRIVE_SETTINGS_KEY, JSON.stringify(updated))
  return updated
}

async function getValidToken(settings) {
  if (isTokenExpired(settings)) {
    const refreshed = await refreshAccessToken(settings)
    return refreshed.accessToken
  }
  return settings.accessToken
}

// --- Drive API helpers ---

async function driveRequest(token, url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      ...options.headers
    }
  })

  if (response.status === 401) {
    throw new Error('Google sign-in expired. Please sign in again.')
  }

  return response
}

async function findFolder(token) {
  const query = `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  const response = await driveRequest(token,
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&spaces=drive`
  )

  if (!response.ok) {
    throw new Error(`Failed to search for folder: ${response.status}`)
  }

  const data = await response.json()
  return data.files?.[0]?.id || null
}

async function createFolder(token) {
  const response = await driveRequest(token, 'https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder'
    })
  })

  if (!response.ok) {
    throw new Error(`Failed to create folder: ${response.status}`)
  }

  const data = await response.json()
  return data.id
}

async function ensureFolder(token, settings) {
  // Use cached folderId if available
  if (settings.folderId) {
    // Verify it still exists
    const response = await driveRequest(token,
      `https://www.googleapis.com/drive/v3/files/${settings.folderId}?fields=id,trashed`
    )
    if (response.ok) {
      const data = await response.json()
      if (!data.trashed) return settings.folderId
    }
  }

  let folderId = await findFolder(token)
  if (!folderId) {
    folderId = await createFolder(token)
    console.log('[GDrive] Created rum1n8 folder:', folderId)
  }

  // Cache the folderId
  const current = JSON.parse(localStorage.getItem(GDRIVE_SETTINGS_KEY) || '{}')
  current.folderId = folderId
  localStorage.setItem(GDRIVE_SETTINGS_KEY, JSON.stringify(current))

  return folderId
}

async function findFile(token, folderId) {
  const query = `name='${SYNC_FILENAME}' and '${folderId}' in parents and trashed=false`
  const response = await driveRequest(token,
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&spaces=drive`
  )

  if (!response.ok) {
    throw new Error(`Failed to search for file: ${response.status}`)
  }

  const data = await response.json()
  return data.files?.[0]?.id || null
}

async function downloadFile(token, fileId) {
  const response = await driveRequest(token,
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`
  )

  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.status}`)
  }

  return response.json()
}

async function uploadFile(token, folderId, fileId, content) {
  const metadata = {
    name: SYNC_FILENAME,
    mimeType: 'application/json'
  }

  if (!fileId) {
    metadata.parents = [folderId]
  }

  const boundary = 'rum1n8_boundary_' + Date.now()
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify(metadata) + '\r\n' +
    `--${boundary}\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    content + '\r\n' +
    `--${boundary}--`

  const url = fileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`

  const response = await driveRequest(token, url, {
    method: fileId ? 'PATCH' : 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body
  })

  if (!response.ok) {
    throw new Error(`Failed to upload file: ${response.status}`)
  }

  return response.json()
}

// --- OAuth flow ---

function getRedirectUri() {
  return window.location.origin + '/gdrive-callback.html'
}

export function startOAuthFlow() {
  return new Promise((resolve, reject) => {
    if (!GOOGLE_CLIENT_ID) {
      reject(new Error('Google Client ID not configured. Set VITE_GOOGLE_CLIENT_ID in .env'))
      return
    }

    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: getRedirectUri(),
      scope: 'https://www.googleapis.com/auth/drive.file',
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent'
    })

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`
    const popup = window.open(authUrl, 'google-auth', 'width=500,height=700,left=100,top=100')

    if (!popup) {
      reject(new Error('Popup blocked. Please allow popups for this site.'))
      return
    }

    let receivedMessage = false

    const handleMessage = async (event) => {
      if (event.origin !== window.location.origin) return
      if (!event.data?.code && !event.data?.error) return

      receivedMessage = true
      window.removeEventListener('message', handleMessage)
      clearInterval(checkClosed)

      if (event.data.error) {
        reject(new Error(event.data.error))
        return
      }

      try {
        // Exchange code for tokens
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code: event.data.code,
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            redirect_uri: getRedirectUri(),
            grant_type: 'authorization_code'
          })
        })

        if (!tokenResponse.ok) {
          const err = await tokenResponse.json().catch(() => ({}))
          throw new Error(err.error_description || `Token exchange failed: ${tokenResponse.status}`)
        }

        const tokens = await tokenResponse.json()

        // Get user info
        const userResponse = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
          headers: { 'Authorization': `Bearer ${tokens.access_token}` }
        })

        let email = ''
        if (userResponse.ok) {
          const userData = await userResponse.json()
          email = userData.user?.emailAddress || ''
        }

        const settings = {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiry: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
          email,
          folderId: null
        }

        localStorage.setItem(GDRIVE_SETTINGS_KEY, JSON.stringify(settings))
        resolve(settings)
      } catch (error) {
        reject(error)
      }
    }

    window.addEventListener('message', handleMessage)

    // Detect popup closed without completing auth
    const checkClosed = setInterval(() => {
      if (popup.closed && !receivedMessage) {
        clearInterval(checkClosed)
        window.removeEventListener('message', handleMessage)
        reject(new Error('Sign-in window was closed'))
      }
    }, 500)
  })
}

// --- Provider interface ---

export default {
  id: 'gdrive',
  name: 'Google Drive',

  getSettingsFields() {
    return [
      {
        key: 'oauth',
        label: 'Google Account',
        type: 'oauth-button',
        hint: 'Sign in with your Google account to sync via Google Drive',
        required: true
      }
    ]
  },

  getSettings() {
    const stored = localStorage.getItem(GDRIVE_SETTINGS_KEY)
    return stored ? JSON.parse(stored) : null
  },

  saveSettings(settings) {
    localStorage.setItem(GDRIVE_SETTINGS_KEY, JSON.stringify(settings))
  },

  clearSettings() {
    localStorage.removeItem(GDRIVE_SETTINGS_KEY)
  },

  isConfigured() {
    const settings = this.getSettings()
    return !!(settings && settings.accessToken && settings.refreshToken)
  },

  async ensureReady(settings) {
    if (isTokenExpired(settings)) {
      await refreshAccessToken(settings)
    }
  },

  async testConnection(settings) {
    try {
      const token = await getValidToken(settings)
      const response = await driveRequest(token,
        'https://www.googleapis.com/drive/v3/about?fields=user'
      )

      if (!response.ok) {
        return { success: false, error: `Connection failed: ${response.status}` }
      }

      const data = await response.json()
      return { success: true, email: data.user?.emailAddress }
    } catch (error) {
      return { success: false, error: error.message || 'Connection failed' }
    }
  },

  async download(settings) {
    const token = await getValidToken(settings)
    const folderId = await ensureFolder(token, settings)
    const fileId = await findFile(token, folderId)

    if (!fileId) {
      console.log('[GDrive] No data file found, will upload local data')
      return { data: null }
    }

    const data = await downloadFile(token, fileId)
    console.log('[GDrive] Successfully downloaded data')
    return { data }
  },

  async upload(settings, verses, collections, remoteData) {
    const token = await getValidToken(settings)
    const folderId = await ensureFolder(token, settings)
    const fileId = await findFile(token, folderId)

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
    console.log(`[GDrive] Uploading ${data.verses.length} verses and ${data.collections.length} collections`)

    await uploadFile(token, folderId, fileId, content)
    console.log('[GDrive] Successfully uploaded data')
  }
}
