import webdavProvider from './webdav-provider.js'
import gdriveProvider from './gdrive-provider.js'

const providers = {
  gdrive: gdriveProvider,
  webdav: webdavProvider
}

export function getProvider(id) {
  return providers[id] || null
}

export function getAllProviders() {
  return Object.values(providers)
}
