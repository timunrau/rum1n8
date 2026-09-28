// Expand verse content into words, splitting dash-joined phrases into separate entries.
// "God—created" stays visually tight, while "God — created" keeps the authored spacing.
export function getVerseWords(content = '') {
  const result = []

  for (const segment of content.split(/(\s*[-\u2010-\u2015]\s*)/g)) {
    if (!segment) continue

    if (/^\s*[-\u2010-\u2015]\s*$/.test(segment)) {
      if (result.length > 0) {
        result[result.length - 1].separatorAfter += segment
      }
      continue
    }

    const tokens = segment.split(/\s+/).filter(w => w.trim().length > 0)
    for (const token of tokens) {
      result.push({ text: token, separatorAfter: '' })
    }
  }

  return result
}
