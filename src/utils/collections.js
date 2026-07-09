export const VIRTUAL_COLLECTION_IDS = new Set(['master-list', 'no-collection', 'to-learn'])

export function isVirtualCollectionId(collectionId) {
  return VIRTUAL_COLLECTION_IDS.has(String(collectionId))
}

function normalizeParentId(parentId) {
  if (parentId === undefined || parentId === null || parentId === '') return null
  return String(parentId)
}

export function normalizeCollectionName(name) {
  return String(name || '').trim().normalize('NFKC').toLowerCase()
}

function normalizeCollectionRecord(collection) {
  return {
    ...collection,
    name: String(collection.name || '').trim() || 'Untitled Collection',
    parentId: normalizeParentId(collection.parentId),
  }
}

function collectionStableOrder(a, b) {
  const aTime = a.createdAt || a.lastModified || ''
  const bTime = b.createdAt || b.lastModified || ''
  if (aTime !== bTime) return aTime.localeCompare(bTime)
  return String(a.id).localeCompare(String(b.id))
}

function findCycle(records) {
  const byId = new Map(records.map(collection => [String(collection.id), collection]))

  for (const start of [...records].sort(collectionStableOrder)) {
    const path = []
    const positionById = new Map()
    let current = start

    while (current?.parentId && byId.has(current.parentId)) {
      const currentId = String(current.id)
      if (positionById.has(currentId)) {
        return path.slice(positionById.get(currentId))
      }
      positionById.set(currentId, path.length)
      path.push(current)
      current = byId.get(current.parentId)
    }
  }

  return []
}

function repairCollectionRecords(collections = []) {
  if (!Array.isArray(collections)) return { collections: [], repairs: [] }

  const repairs = []
  const records = collections
    .filter(collection => collection && typeof collection === 'object' && collection.id)
    .map(normalizeCollectionRecord)
  const byId = new Map(records.map(collection => [String(collection.id), collection]))

  let repaired = records.map(collection => {
    const parentId = normalizeParentId(collection.parentId)
    if (!parentId) return { ...collection, parentId: null }
    if (parentId === String(collection.id) || !byId.has(parentId)) {
      repairs.push({ type: 'invalid-parent', collectionId: String(collection.id) })
      return { ...collection, parentId: null }
    }
    return { ...collection, parentId }
  })

  let cycle = findCycle(repaired)
  while (cycle.length > 0) {
    const edgeToRemove = [...cycle].sort((a, b) => {
      const aTime = a.lastModified || a.createdAt || ''
      const bTime = b.lastModified || b.createdAt || ''
      if (aTime !== bTime) return aTime.localeCompare(bTime)
      return String(a.id).localeCompare(String(b.id))
    })[0]
    repaired = repaired.map(collection => (
      String(collection.id) === String(edgeToRemove.id)
        ? { ...collection, parentId: null }
        : collection
    ))
    repairs.push({ type: 'cycle', collectionId: String(edgeToRemove.id) })
    cycle = findCycle(repaired)
  }

  const siblingsByParent = new Map()
  for (const collection of repaired) {
    const parentKey = collection.parentId || '__root__'
    const siblings = siblingsByParent.get(parentKey) || []
    siblings.push(collection)
    siblingsByParent.set(parentKey, siblings)
  }

  const renamedById = new Map()
  for (const siblings of siblingsByParent.values()) {
    const reservedNames = new Set(siblings.map(collection => normalizeCollectionName(collection.name)))
    const usedNames = new Set()

    for (const collection of [...siblings].sort(collectionStableOrder)) {
      const originalName = String(collection.name || '').trim() || 'Untitled Collection'
      let nextName = originalName
      let normalizedName = normalizeCollectionName(nextName)
      if (usedNames.has(normalizedName)) {
        let suffix = 2
        do {
          nextName = `${originalName} (${suffix})`
          normalizedName = normalizeCollectionName(nextName)
          suffix++
        } while (usedNames.has(normalizedName) || reservedNames.has(normalizedName))
        repairs.push({
          type: 'duplicate-name',
          collectionId: String(collection.id),
          previousName: originalName,
          name: nextName,
        })
      }
      usedNames.add(normalizedName)
      renamedById.set(String(collection.id), nextName)
    }
  }

  repaired = repaired.map(collection => ({
    ...collection,
    name: renamedById.get(String(collection.id)) || collection.name,
  }))

  return { collections: repaired, repairs }
}

export function repairCollections(collections = []) {
  return repairCollectionRecords(collections)
}

export function normalizeCollections(collections = []) {
  return repairCollectionRecords(collections).collections
}

export function getCollectionById(collections, collectionId) {
  if (collectionId === undefined || collectionId === null) return null
  return normalizeCollections(collections)
    .find(collection => String(collection.id) === String(collectionId)) || null
}

export function getRootCollections(collections = []) {
  return normalizeCollections(collections).filter(collection => !collection.parentId)
}

export function getChildCollections(collections = [], parentId) {
  if (!parentId) return []
  return normalizeCollections(collections)
    .filter(collection => collection.parentId === String(parentId))
}

export function getCollectionAncestors(collections = [], collectionId) {
  const normalized = normalizeCollections(collections)
  const byId = new Map(normalized.map(collection => [String(collection.id), collection]))
  const ancestors = []
  const seen = new Set()
  let current = byId.get(String(collectionId))

  while (current?.parentId && !seen.has(current.parentId)) {
    seen.add(current.parentId)
    const parent = byId.get(current.parentId)
    if (!parent) break
    ancestors.unshift(parent)
    current = parent
  }

  return ancestors
}

export function getCollectionPath(collections = [], collectionId, separator = ' / ') {
  const collection = getCollectionById(collections, collectionId)
  if (!collection) return ''
  return [...getCollectionAncestors(collections, collectionId), collection]
    .map(item => item.name)
    .join(separator)
}

export function getDescendantCollections(collections = [], collectionId) {
  const normalized = normalizeCollections(collections)
  const childrenByParent = new Map()
  for (const collection of normalized) {
    if (!collection.parentId) continue
    const children = childrenByParent.get(collection.parentId) || []
    children.push(collection)
    childrenByParent.set(collection.parentId, children)
  }

  const descendants = []
  const queue = [...(childrenByParent.get(String(collectionId)) || [])]
  const seen = new Set()
  while (queue.length > 0) {
    const descendant = queue.shift()
    const id = String(descendant.id)
    if (seen.has(id)) continue
    seen.add(id)
    descendants.push(descendant)
    queue.push(...(childrenByParent.get(id) || []))
  }
  return descendants
}

export function hasChildCollections(collections = [], collectionId) {
  return getChildCollections(collections, collectionId).length > 0
}

export function isChildCollection(collections = [], collectionId) {
  return !!getCollectionById(collections, collectionId)?.parentId
}

export function canCreateChildCollection(collections = [], parentId) {
  if (!parentId || isVirtualCollectionId(parentId)) return false
  return !!getCollectionById(collections, parentId)
}

export function canAssignCollectionParent(collections = [], collectionId, parentId) {
  const normalizedParentId = normalizeParentId(parentId)
  if (!normalizedParentId) return true
  if (isVirtualCollectionId(normalizedParentId)) return false
  if (!getCollectionById(collections, normalizedParentId)) return false

  if (!collectionId) return true
  const normalizedCollectionId = String(collectionId)
  if (normalizedCollectionId === normalizedParentId) return false
  if (!getCollectionById(collections, normalizedCollectionId)) return false

  return !getDescendantCollections(collections, normalizedCollectionId)
    .some(collection => String(collection.id) === normalizedParentId)
}

export function getSiblingNameConflict(
  collections = [],
  { name, parentId = null, excludeId = null } = {}
) {
  const normalizedName = normalizeCollectionName(name)
  if (!normalizedName) return null
  const normalizedParentId = normalizeParentId(parentId)

  return normalizeCollections(collections).find(collection => (
    normalizeParentId(collection.parentId) === normalizedParentId &&
    String(collection.id) !== String(excludeId || '') &&
    normalizeCollectionName(collection.name) === normalizedName
  )) || null
}

export function canDeleteCollection(collections = [], collectionId) {
  return !hasChildCollections(collections, collectionId)
}

export function getCollectionParentId(collections = [], collectionId) {
  return getCollectionById(collections, collectionId)?.parentId || null
}

export function getCollectionScopeIds(collections = [], collectionId, { includeChildren = false } = {}) {
  if (!collectionId || isVirtualCollectionId(collectionId)) return []
  const collection = getCollectionById(collections, collectionId)
  if (!collection) return []

  const ids = [String(collection.id)]
  if (includeChildren) {
    ids.push(...getDescendantCollections(collections, collection.id)
      .map(descendant => String(descendant.id)))
  }
  return ids
}

export function normalizeVerseCollectionIds(collections = [], collectionIds = []) {
  const normalizedIds = [...new Set((collectionIds || []).filter(Boolean).map(String))]
  const selectedIds = new Set(normalizedIds)
  const redundantAncestorIds = new Set()

  for (const id of normalizedIds) {
    for (const ancestor of getCollectionAncestors(collections, id)) {
      const ancestorId = String(ancestor.id)
      if (selectedIds.has(ancestorId)) redundantAncestorIds.add(ancestorId)
    }
  }

  return normalizedIds.filter(id => !redundantAncestorIds.has(id))
}

export function getCollectionVerses(verses = [], collections = [], collectionId, { includeChildren = false } = {}) {
  const scopeIds = new Set(getCollectionScopeIds(collections, collectionId, { includeChildren }))
  if (scopeIds.size === 0 || !Array.isArray(verses)) return []

  const seenVerseIds = new Set()
  return verses.filter(verse => {
    if (!verse || seenVerseIds.has(verse.id)) return false
    const collectionIds = Array.isArray(verse.collectionIds) ? verse.collectionIds.map(String) : []
    if (!collectionIds.some(id => scopeIds.has(id))) return false
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
