import { getCollectionById, getDescendantCollections } from './collections.js'

function escapeCSVField(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`
}

function buildExportFilename(collectionName) {
  const slug = String(collectionName || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return `${slug || 'collection'}-verses.csv`
}

function getRelativeCollectionPath(collectionById, collectionId, rootCollectionId) {
  const segments = []
  const seen = new Set()
  let current = collectionById.get(String(collectionId))

  while (current && !seen.has(String(current.id))) {
    const currentId = String(current.id)
    seen.add(currentId)
    segments.unshift(String(current.name || '').trim() || 'Untitled Collection')

    if (currentId === rootCollectionId) {
      return segments.join('/')
    }

    current = current.parentId
      ? collectionById.get(String(current.parentId))
      : null
  }

  return ''
}

export function buildCollectionCSV(collections = [], verses = [], collectionId) {
  const rootCollection = getCollectionById(collections, collectionId)
  if (!rootCollection) {
    throw new Error('Collection not found')
  }

  const rootCollectionId = String(rootCollection.id)
  const scopedCollections = [
    rootCollection,
    ...getDescendantCollections(collections, rootCollectionId),
  ]
  const collectionById = new Map(
    scopedCollections.map(collection => [String(collection.id), collection])
  )
  const scopedCollectionIds = new Set(collectionById.keys())
  const exportedCollectionIds = new Set()
  const exportedVerseIds = new Set()
  const rows = []

  const sortedVerses = [...(Array.isArray(verses) ? verses : [])].sort((a, b) => {
    const referenceComparison = String(a?.reference || '').localeCompare(
      String(b?.reference || ''),
      undefined,
      { numeric: true, sensitivity: 'base' }
    )
    if (referenceComparison !== 0) return referenceComparison

    const versionComparison = String(a?.bibleVersion || '').localeCompare(
      String(b?.bibleVersion || ''),
      undefined,
      { sensitivity: 'base' }
    )
    if (versionComparison !== 0) return versionComparison

    return String(a?.id || '').localeCompare(String(b?.id || ''))
  })

  for (const verse of sortedVerses) {
    const memberships = [...new Set(
      (Array.isArray(verse?.collectionIds) ? verse.collectionIds : [])
        .map(String)
        .filter(id => scopedCollectionIds.has(id))
    )]

    for (const membershipId of memberships) {
      const collectionPath = getRelativeCollectionPath(
        collectionById,
        membershipId,
        rootCollectionId
      )
      if (!collectionPath) continue

      rows.push([
        verse.reference,
        verse.content,
        verse.bibleVersion,
        collectionPath,
      ])
      exportedVerseIds.add(String(verse.id))

      let current = collectionById.get(membershipId)
      while (current) {
        const currentId = String(current.id)
        exportedCollectionIds.add(currentId)
        if (currentId === rootCollectionId) break
        current = current.parentId
          ? collectionById.get(String(current.parentId))
          : null
      }
    }
  }

  const csvRows = [
    ['Reference', 'Content', 'Version', 'CollectionPath'],
    ...rows,
  ]

  return {
    csv: csvRows.map(row => row.map(escapeCSVField).join(',')).join('\r\n'),
    filename: buildExportFilename(rootCollection.name),
    verseCount: exportedVerseIds.size,
    collectionCount: exportedCollectionIds.size,
    rowCount: rows.length,
  }
}
