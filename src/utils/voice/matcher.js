import { normalizeSpeech, speechTokensWithOffsets } from './normalization.js'

const fillers = new Set(['uh', 'um', 'erm', 'hmm'])

// Return decisions in display-unit coordinates; multi-token contractions stay one unit.
export function matchSpeech(units, startIndex, transcript) {
  const { tokens, ends } = speechTokensWithOffsets(transcript)
  const decisions = []
  const remainders = [transcript]
  const suffix = count => {
    if (!count) return transcript.trim()
    const end = ends[count - 1]
    // A contraction can cover multiple display units. Retain its unconsumed
    // expansion when consensus ends inside it ("I'll" -> "I" + "will").
    let next = count
    while (next < tokens.length && ends[next] === end) next++
    return [...tokens.slice(count, next), transcript.slice(end).trim()].filter(Boolean).join(' ')
  }
  let cursor = startIndex, spoken = 0, consumed = 0, ambiguous = false
  const matches = (index, at) => {
    const expected = units[index] && !units[index].isReferenceUnit ? normalizeSpeech(units[index].text) : []
    return expected.length && expected.every((token, offset) => token === tokens[at + offset]) ? expected.length : 0
  }
  while (cursor >= 0 && cursor < units.length && spoken < tokens.length && !units[cursor].isReferenceUnit) {
    const direct = matches(cursor, spoken)
    if (direct) {
      decisions.push({ index: cursor++, incorrect: false })
      spoken += direct
      consumed = spoken
      remainders.push(suffix(consumed))
      continue
    }
    const anchors = []
    for (let skip = 1; skip <= 8 && cursor + skip < units.length; skip++) {
      const length = matches(cursor + skip, spoken)
      if (!length) continue
      const next = units[cursor + skip + 1]
      // A two-unit anchor is required whenever another content unit is available.
      if (next && !next.isReferenceUnit && !matches(cursor + skip + 1, spoken + length)) continue
      anchors.push(skip)
    }
    // An inserted or repeated phrase can itself look like a later anchor.
    // Prefer a nearby direct match to inventing omissions in that situation.
    let directAhead = 0
    for (let look = spoken + 1; look < Math.min(tokens.length, spoken + 9); look++) {
      const length = matches(cursor, look)
      const next = units[cursor + 1]
      if (length && (!next || next.isReferenceUnit || matches(cursor + 1, look + length))) { directAhead = look; break }
    }
    if (directAhead) { spoken = directAhead; continue }
    if (anchors.length === 1) {
      const anchorIndex = cursor + anchors[0]
      const anchorEndIndex = units[anchorIndex + 1] && !units[anchorIndex + 1].isReferenceUnit ? anchorIndex + 1 : anchorIndex
      for (let i = 0; i < anchors[0]; i++) {
        decisions.push({ index: cursor++, incorrect: true, anchorEndIndex })
        remainders.push(suffix(spoken))
      }
      continue
    }
    if (anchors.length > 1) { ambiguous = true; break }
    // At the very end there is no later word to anchor a substitution. A
    // distinct spoken word can still count as a miss; silence, fillers, and a
    // repeated previous word cannot.
    if (cursor === units.length - 1 && spoken === tokens.length - 1 &&
        !fillers.has(tokens[spoken]) &&
        !normalizeSpeech(units[cursor - 1]?.text).includes(tokens[spoken])) {
      decisions.push({ index: cursor++, incorrect: true })
      consumed = ++spoken
      remainders.push(suffix(consumed))
      continue
    }
    // Ignore fillers and repeats. Unmatched suffix stays buffered for a later anchor.
    spoken++
  }
  return { decisions, consumed, tokens, ambiguous, nextIndex: cursor, waiting: spoken > consumed, remainder: suffix(consumed), remainders }
}

// Prefer an explicitly matching alternative over competing recognition guesses.
// Mistakes require a clear anchor, or an actual different word at the end.
export function resolveSpeechAlternatives(results) {
  if (!results.length) return { decisions: [], remainders: [''], ambiguous: false }
  let first = results[0]
  let count = 0
  while (count < first.decisions.length && results.every(result => {
    const decision = result.decisions[count]
    return decision?.index === first.decisions[count].index && decision.incorrect === first.decisions[count].incorrect
  })) count++
  for (let index = 0; index < count; index++) {
    if (results.some(result => result.decisions[index].anchorEndIndex > first.decisions[count - 1].index)) {
      count = index
      break
    }
  }
  // Be generous about correct recitation: a clean match in any alternative is
  // evidence for acceptance. A worse alternative must not veto those words.
  let acceptedResults = results
  let best = first, cleanCount = 0
  for (const result of results) {
    const firstMistake = result.decisions.findIndex(decision => decision.incorrect)
    const length = firstMistake < 0 ? result.decisions.length : firstMistake
    if (length > cleanCount) { best = result; cleanCount = length }
  }
  if (cleanCount > count) {
    first = best
    count = cleanCount
    acceptedResults = results.filter(result => first.decisions.slice(0, count).every((decision, index) =>
      result.decisions[index]?.index === decision.index && !result.decisions[index].incorrect
    ))
  } else {
    // A shorter, unanchored alternative must not stall a longer alternative
    // that has already located a wrong word from the words after it.
    const anchored = results.filter(result => result.decisions.length > count &&
      result.decisions.slice(count).some(decision => decision.incorrect) &&
      result.decisions.every(decision => !decision.incorrect || decision.anchorEndIndex === undefined ||
        result.decisions.some(anchor => anchor.index >= decision.anchorEndIndex && !anchor.incorrect)))
    anchored.sort((left, right) => right.decisions.length - left.decisions.length ||
      left.decisions.filter(decision => decision.incorrect).length - right.decisions.filter(decision => decision.incorrect).length)
    if (anchored.length) {
      first = anchored[0]
      count = first.decisions.length
      acceptedResults = anchored.filter(result => result.decisions.length === count &&
        result.decisions.every((decision, index) => decision.index === first.decisions[index].index &&
          decision.incorrect === first.decisions[index].incorrect))
    }
  }
  const disagreement = acceptedResults.some(result => result.decisions.length !== count)
  return {
    decisions: first.decisions.slice(0, count),
    remainders: [...new Set(acceptedResults.map(result => result.remainders?.[count] ?? result.remainder ?? ''))],
    ambiguous: disagreement || acceptedResults.some(result => result.ambiguous),
    waiting: acceptedResults.some(result => result.waiting),
    unsupported: results.every(result => result.unsupported),
  }
}

export function matchAlternatives(units, startIndex, alternatives) {
  return resolveSpeechAlternatives(alternatives.map(text => matchSpeech(units, startIndex, text)))
}
