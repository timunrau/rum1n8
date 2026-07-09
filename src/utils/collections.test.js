import { describe, expect, it } from 'vitest'
import {
  canAssignCollectionParent,
  canCreateChildCollection,
  canDeleteCollection,
  getChildCollections,
  getCollectionAncestors,
  getCollectionDueCount,
  getCollectionPath,
  getCollectionVerses,
  getDescendantCollections,
  getRootCollections,
  getSiblingNameConflict,
  hasChildCollections,
  normalizeCollections,
  normalizeVerseCollectionIds,
  repairCollections,
} from './collections.js'

const now = '2026-05-22T12:00:00.000Z'

function collection(id, parentId = null, overrides = {}) {
  return {
    id,
    name: id,
    description: '',
    createdAt: now,
    lastModified: now,
    ...(parentId !== undefined ? { parentId } : {}),
    ...overrides,
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
  it('preserves arbitrary depth while repairing missing, self, and cyclic parents', () => {
    const { collections: normalized, repairs } = repairCollections([
      collection('old-root', undefined),
      collection('parent'),
      collection('child', 'parent'),
      collection('grandchild', 'child'),
      collection('orphan', 'missing'),
      collection('self', 'self'),
      collection('cycle-a', 'cycle-b', { lastModified: '2026-05-20T00:00:00.000Z' }),
      collection('cycle-b', 'cycle-a', { lastModified: '2026-05-21T00:00:00.000Z' }),
    ])

    expect(normalized.find(c => c.id === 'old-root').parentId).toBeNull()
    expect(normalized.find(c => c.id === 'child').parentId).toBe('parent')
    expect(normalized.find(c => c.id === 'grandchild').parentId).toBe('child')
    expect(normalized.find(c => c.id === 'orphan').parentId).toBeNull()
    expect(normalized.find(c => c.id === 'self').parentId).toBeNull()
    expect(normalized.find(c => c.id === 'cycle-a').parentId).toBeNull()
    expect(normalized.find(c => c.id === 'cycle-b').parentId).toBe('cycle-a')
    expect(repairs.map(repair => repair.type)).toEqual(
      expect.arrayContaining(['invalid-parent', 'cycle'])
    )
  })

  it('navigates arbitrary-depth ancestors, descendants, children, and paths', () => {
    const collections = [
      collection('parent'),
      collection('child', 'parent'),
      collection('grandchild', 'child'),
      collection('sibling', 'parent'),
      collection('root'),
    ]

    expect(getRootCollections(collections).map(c => c.id)).toEqual(['parent', 'root'])
    expect(getChildCollections(collections, 'parent').map(c => c.id)).toEqual(['child', 'sibling'])
    expect(getCollectionAncestors(collections, 'grandchild').map(c => c.id)).toEqual(['parent', 'child'])
    expect(getDescendantCollections(collections, 'parent').map(c => c.id)).toEqual(['child', 'sibling', 'grandchild'])
    expect(getCollectionPath(collections, 'grandchild')).toBe('parent / child / grandchild')
    expect(canCreateChildCollection(collections, 'grandchild')).toBe(true)
  })

  it('keeps visible verses direct-only while aggregate metrics include all descendants and dedupe', () => {
    const collections = [
      collection('parent'),
      collection('child', 'parent'),
      collection('grandchild', 'child'),
    ]
    const verses = [
      verse('direct', ['parent'], true),
      verse('child-only', ['child'], true),
      verse('grandchild-only', ['grandchild'], true),
      verse('both-descendants', ['child', 'grandchild'], true),
      verse('other', ['other'], true),
    ]

    expect(getCollectionVerses(verses, collections, 'parent', { includeChildren: false }).map(v => v.id))
      .toEqual(['direct'])
    expect(getCollectionVerses(verses, collections, 'parent', { includeChildren: true }).map(v => v.id))
      .toEqual(['direct', 'child-only', 'grandchild-only', 'both-descendants'])
    expect(getCollectionDueCount(verses, collections, 'parent', v => v.due)).toBe(4)
  })

  it('moves complete subtrees while preventing cycles and parent deletion', () => {
    const collections = [
      collection('parent'),
      collection('child', 'parent'),
      collection('grandchild', 'child'),
      collection('other-root'),
    ]

    expect(hasChildCollections(collections, 'parent')).toBe(true)
    expect(canDeleteCollection(collections, 'parent')).toBe(false)
    expect(canDeleteCollection(collections, 'grandchild')).toBe(true)
    expect(canAssignCollectionParent(collections, 'parent', 'other-root')).toBe(true)
    expect(canAssignCollectionParent(collections, 'parent', 'child')).toBe(false)
    expect(canAssignCollectionParent(collections, 'parent', 'grandchild')).toBe(false)
    expect(canAssignCollectionParent(collections, 'child', null)).toBe(true)
    expect(canAssignCollectionParent(collections, 'child', 'child')).toBe(false)
  })

  it('enforces case-insensitive unique sibling names and repairs incoming duplicates', () => {
    const collections = [
      collection('work', null, { name: 'Work' }),
      collection('humility', 'work', { name: 'Humility', createdAt: '2026-01-01T00:00:00.000Z' }),
      collection('personal', null, { name: 'Personal' }),
      collection('personal-humility', 'personal', { name: 'humility' }),
    ]

    expect(getSiblingNameConflict(collections, { name: ' humility ', parentId: 'work' })?.id)
      .toBe('humility')
    expect(getSiblingNameConflict(collections, { name: 'Humility', parentId: 'personal' })?.id)
      .toBe('personal-humility')
    expect(getSiblingNameConflict(collections, {
      name: 'HUMILITY',
      parentId: 'work',
      excludeId: 'humility',
    })).toBeNull()

    const repaired = normalizeCollections([
      ...collections,
      collection('duplicate', 'work', {
        name: 'HUMILITY',
        createdAt: '2026-02-01T00:00:00.000Z',
      }),
    ])
    expect(repaired.find(c => c.id === 'humility').name).toBe('Humility')
    expect(repaired.find(c => c.id === 'duplicate').name).toBe('HUMILITY (2)')
  })

  it('keeps the most specific verse membership in each branch', () => {
    const collections = [
      collection('work'),
      collection('values', 'work'),
      collection('humility', 'values'),
      collection('personal'),
    ]

    expect(normalizeVerseCollectionIds(collections, [
      'work',
      'values',
      'humility',
      'personal',
      'unknown',
      'personal',
    ])).toEqual(['humility', 'personal', 'unknown'])
  })
})
