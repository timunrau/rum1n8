export const VIRTUAL_COLLECTION_IDS = new Set(['master-list', 'no-collection', 'to-learn'])

export function isVirtualCollectionId(collectionId) {
  return VIRTUAL_COLLECTION_IDS.has(collectionId)
}

function normalizeParentId(parentId) {
  if (parentId === undefined || parentId === null || parentId === '') return null
  return String(parentId)
}

function normalizeCollectionRecord(collection) {
  return {
    ...collection,
    parentId: normalizeParentId(collection.parentId),
  }
}

export function normalizeCollections(collections = []) {
  if (!Array.isArray(collections)) return []

  const records = collections
    .filter(collection => collection && typeof collection === 'object' && collection.id)
    .map(normalizeCollectionRecord)

  const byId = new Map(records.map(collection => [String(collection.id), collection]))

  const firstPass = records.map(collection => {
    const parentId = normalizeParentId(collection.parentId)
    if (!parentId || parentId === String(collection.id) || !byId.has(parentId)) {
      return { ...collection, parentId: null }
    }
    return { ...collection, parentId }
  })

  const firstPassById = new Map(firstPass.map(collection => [String(collection.id), collection]))

  return firstPass.map(collection => {
    if (!collection.parentId) return collection

    const parent = firstPassById.get(collection.parentId)
    if (!parent || parent.parentId) {
      return { ...collection, parentId: null }
    }

    return collection
  })
}

function getCollectionById(collections, collectionId) {
  return normalizeCollections(collections).find(collection => String(collection.id) === String(collectionId)) || null
}

export function getRootCollections(collections = []) {
  return normalizeCollections(collections).filter(collection => !collection.parentId)
}

export function getChildCollections(collections = [], parentId) {
  if (!parentId) return []
  return normalizeCollections(collections).filter(collection => collection.parentId === String(parentId))
}

export function hasChildCollections(collections = [], collectionId) {
  return getChildCollections(collections, collectionId).length > 0
}

export function isChildCollection(collections = [], collectionId) {
  const collection = getCollectionById(collections, collectionId)
  return !!collection?.parentId
}

export function canCreateChildCollection(collections = [], parentId) {
  if (!parentId || isVirtualCollectionId(parentId)) return false
  const parent = getCollectionById(collections, parentId)
  return !!parent && !parent.parentId
}

export function canAssignCollectionParent(collections = [], collectionId, parentId) {
  const normalizedParentId = normalizeParentId(parentId)
  if (!normalizedParentId) return true
  if (isVirtualCollectionId(normalizedParentId)) return false

  const parent = getCollectionById(collections, normalizedParentId)
  if (!parent || parent.parentId) return false

  if (!collectionId) return true
  if (String(collectionId) === normalizedParentId) return false

  const collection = getCollectionById(collections, collectionId)
  if (!collection) return false

  return !hasChildCollections(collections, collectionId)
}

export function canDeleteCollection(collections = [], collectionId) {
  return !hasChildCollections(collections, collectionId)
}

export function getCollectionParentId(collections = [], collectionId) {
  const collection = getCollectionById(collections, collectionId)
  return collection?.parentId || null
}

export function getCollectionScopeIds(collections = [], collectionId, { includeChildren = false } = {}) {
  if (!collectionId || isVirtualCollectionId(collectionId)) return []

  const collection = getCollectionById(collections, collectionId)
  if (!collection) return []

  const ids = [String(collection.id)]
  if (includeChildren && !collection.parentId) {
    ids.push(...getChildCollections(collections, collection.id).map(child => String(child.id)))
  }
  return ids
}

export function getCollectionVerses(verses = [], collections = [], collectionId, { includeChildren = false } = {}) {
  const scopeIds = new Set(getCollectionScopeIds(collections, collectionId, { includeChildren }))
  if (scopeIds.size === 0 || !Array.isArray(verses)) return []

  const seenVerseIds = new Set()
  return verses.filter(verse => {
    if (!verse || seenVerseIds.has(verse.id)) return false
    const collectionIds = Array.isArray(verse.collectionIds) ? verse.collectionIds.map(String) : []
    const inScope = collectionIds.some(id => scopeIds.has(id))
    if (!inScope) return false

    seenVerseIds.add(verse.id)
    return true
  })
}

export function getCollectionDueCount(verses = [], collections = [], collectionId, isDueForReview) {
  if (typeof isDueForReview !== 'function') return 0
  return getCollectionVerses(verses, collections, collectionId, { includeChildren: true })
    .filter(verse => isDueForReview(verse))
    .length
}
