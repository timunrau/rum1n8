import webdavProvider from './webdav-provider.js'
import gdriveProvider from './gdrive-provider.js'

const providers = {
  webdav: webdavProvider,
  gdrive: gdriveProvider
}

export function getProvider(id) {
  return providers[id] || null
}

export function getAllProviders() {
  return Object.values(providers)
}
