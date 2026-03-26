/**
 * Count the number of individual verses in a reference string.
 * Handles ranges like "Psalm 1:1-3" (= 3 verses) and comma-separated
 * parts like "Hebrews 5:11-12, 6:1-2" (= 4 verses).
 */
export function countVersesInReference(reference) {
  if (!reference) return 0

  let totalCount = 0

  // Split by commas to handle multiple parts (e.g., "Hebrews 5:11-12, 6:1-2")
  const parts = reference.split(',').map(part => part.trim())

  for (const part of parts) {
    // Match patterns like "Chapter:Verse" or "Chapter:StartVerse-EndVerse"
    const match = part.match(/(\d+):(\d+)(?:-(\d+))?/i)

    if (match) {
      const startVerse = parseInt(match[2], 10)
      const endVerse = match[3] ? parseInt(match[3], 10) : startVerse
      totalCount += Math.max(1, endVerse - startVerse + 1)
    } else {
      totalCount += 1
    }
  }

  return totalCount > 0 ? totalCount : 1
}
