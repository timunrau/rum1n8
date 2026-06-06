import { describe, expect, it } from 'vitest'
import {
  buildPassageReviewVerse,
  calculatePassageSegmentAccuracy,
  getPassageReviewSequence
} from './passage-review.js'

const mastered = (id, reference, overrides = {}) => ({
  id,
  reference,
  content: `Content for ${reference}`,
  bibleVersion: 'BSB',
  memorizationStatus: 'mastered',
  ...overrides
})

describe('getPassageReviewSequence', () => {
  it('returns mastered same-version records that immediately follow the anchor', () => {
    const verses = [
      mastered('a', 'John 3:36'),
      mastered('b', 'John 4:1'),
      mastered('c', 'John 4:2-3')
    ]

    expect(getPassageReviewSequence(verses[0], verses).map((verse) => verse.id)).toEqual(['a', 'b', 'c'])
  })

  it('stops at gaps, different versions, and unmastered records', () => {
    const gap = [mastered('a', 'John 3:16'), mastered('b', 'John 3:18')]
    expect(getPassageReviewSequence(gap[0], gap)).toEqual([])

    const differentVersion = [
      mastered('a', 'John 3:16'),
      mastered('b', 'John 3:17', { bibleVersion: 'ESV' })
    ]
    expect(getPassageReviewSequence(differentVersion[0], differentVersion)).toEqual([])

    const unmastered = [
      mastered('a', 'John 3:16'),
      mastered('b', 'John 3:17', { memorizationStatus: 'memorized' })
    ]
    expect(getPassageReviewSequence(unmastered[0], unmastered)).toEqual([])
  })
})

describe('buildPassageReviewVerse', () => {
  it('builds one temporary passage item from records', () => {
    expect(buildPassageReviewVerse([
      mastered('a', 'John 3:36', { content: 'Whoever believes.' }),
      mastered('b', 'John 4:1-2', { content: 'Jesus knew.' })
    ])).toMatchObject({
      id: 'passage-review-a-b',
      reference: 'John 3:36-4:2',
      content: 'Whoever believes.\n\nJesus knew.',
      bibleVersion: 'BSB',
      memorizationStatus: 'mastered',
      passageRecordIds: ['a', 'b']
    })
  })
})

describe('calculatePassageSegmentAccuracy', () => {
  it('calculates per-record accuracy from content unit mistakes', () => {
    expect(calculatePassageSegmentAccuracy(10, 1)).toBe(90)
    expect(calculatePassageSegmentAccuracy(0, 1)).toBe(0)
  })
})
