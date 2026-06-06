import { describe, expect, it } from 'vitest'
import { countVersesInReference } from './verse-count.js'

describe('countVersesInReference', () => {
  it('counts same-chapter and cross-chapter ranges', () => {
    expect(countVersesInReference('Psalm 1:1-3')).toBe(3)
    expect(countVersesInReference('John 3:36-4:2')).toBe(3)
  })
})
