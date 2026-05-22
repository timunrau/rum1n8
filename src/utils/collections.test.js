import { describe, expect, it } from 'vitest'
import {
  canAssignCollectionParent,
  canCreateChildCollection,
  canDeleteCollection,
  getChildCollections,
  getCollectionDueCount,
  getCollectionVerses,
  getRootCollections,
  hasChildCollections,
  normalizeCollections,
} from './collections.js'

const now = '2026-05-22T12:00:00.000Z'

function collection(id, parentId = null) {
  return {
    id,
    name: id,
    description: '',
    createdAt: now,
    lastModified: now,
    ...(parentId !== undefined ? { parentId } : {}),
  }
}

function verse(id, collectionIds, due = false) {
  return {
    id,
    reference: `Psalm ${id}:1`,
    content: id,
    memorizationStatus: 'mastered',
    collectionIds,
    due,
  }
}

describe('collection hierarchy helpers', () => {
  it('normalizes old and invalid hierarchy records to one nesting level', () => {
    const normalized = normalizeCollections([
      collection('old-root', undefined),
      collection('parent'),
      collection('child', 'parent'),
      collection('grandchild', 'child'),
      collection('orphan', 'missing'),
      collection('self', 'self'),
    ])

    expect(normalized.find(c => c.id === 'old-root').parentId).toBeNull()
    expect(normalized.find(c => c.id === 'child').parentId).toBe('parent')
    expect(normalized.find(c => c.id === 'grandchild').parentId).toBeNull()
    expect(normalized.find(c => c.id === 'orphan').parentId).toBeNull()
    expect(normalized.find(c => c.id === 'self').parentId).toBeNull()
  })

  it('separates root collections from one-level children', () => {
    const collections = [
      collection('parent'),
      collection('child-a', 'parent'),
      collection('child-b', 'parent'),
      collection('root'),
    ]

    expect(getRootCollections(collections).map(c => c.id)).toEqual(['parent', 'root'])
    expect(getChildCollections(collections, 'parent').map(c => c.id)).toEqual(['child-a', 'child-b'])
    expect(canCreateChildCollection(collections, 'parent')).toBe(true)
    expect(canCreateChildCollection(collections, 'child-a')).toBe(false)
  })

  it('keeps visible verses direct-only while aggregate metrics include children and dedupe', () => {
    const collections = [
      collection('parent'),
      collection('child', 'parent'),
    ]
    const verses = [
      verse('direct', ['parent'], true),
      verse('child-only', ['child'], true),
      verse('both', ['parent', 'child'], true),
      verse('other', ['other'], true),
    ]
    const isDue = v => v.due

    expect(getCollectionVerses(verses, collections, 'parent', { includeChildren: false }).map(v => v.id))
      .toEqual(['direct', 'both'])
    expect(getCollectionVerses(verses, collections, 'parent', { includeChildren: true }).map(v => v.id))
      .toEqual(['direct', 'child-only', 'both'])
    expect(getCollectionDueCount(verses, collections, 'parent', isDue)).toBe(3)
  })

  it('enforces one-level reparenting and parent deletion rules', () => {
    const collections = [
      collection('parent'),
      collection('child', 'parent'),
      collection('other-root'),
    ]

    expect(hasChildCollections(collections, 'parent')).toBe(true)
    expect(canDeleteCollection(collections, 'parent')).toBe(false)
    expect(canDeleteCollection(collections, 'child')).toBe(true)

    expect(canAssignCollectionParent(collections, 'child', 'other-root')).toBe(true)
    expect(canAssignCollectionParent(collections, 'child', null)).toBe(true)
    expect(canAssignCollectionParent(collections, 'parent', 'other-root')).toBe(false)
    expect(canAssignCollectionParent(collections, 'other-root', 'child')).toBe(false)
    expect(canAssignCollectionParent(collections, 'child', 'child')).toBe(false)
  })
})
