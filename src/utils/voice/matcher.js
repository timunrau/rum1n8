import { normalizeSpeech, speechTokensWithOffsets } from './normalization.js'

// Keep the reason for each decision so a clear replacement can be graded
// differently from speech the recognizer merely omitted.
export const VOICE_HEARD = 'heard'
export const VOICE_BRIDGED = 'bridged'
export const VOICE_REPLACED = 'replaced'

// Bound how far a single anchor may skip. Generous, but not unbounded: a verse
// must not be marked complete because one late phrase matched.
export const VOICE_MAX_BRIDGE = 8

// ASR can omit or mishear a word. Only a distinct, explicit replacement with
// matching context on both sides is a voice mistake. Gaps and close-sounding
// guesses continue to receive the benefit of the doubt.

function credits(accepted) {
  return { incorrect: false, accepted }
}

function spellingDistance(a, b) {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    previous.splice(0, previous.length, ...current)
  }
  return previous[b.length]
}

const fillerWords = new Set(['uh', 'um', 'ah', 'er', 'hmm'])

export function clearVoiceReplacement(expected, spoken, previous = '', next = '') {
  if (!expected || !spoken || fillerWords.has(spoken) || spoken === previous || spoken === next) return false
  const length = Math.max(expected.length, spoken.length)
  return spellingDistance(expected, spoken) >= Math.max(2, Math.ceil(length / 2))
}

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
      decisions.push({ index: cursor++, ...credits(VOICE_HEARD) })
      spoken += direct
      consumed = spoken
      remainders.push(suffix(consumed))
      continue
    }
    const anchors = []
    for (let skip = 1; skip <= VOICE_MAX_BRIDGE && cursor + skip < units.length; skip++) {
      const length = matches(cursor + skip, spoken)
      if (!length) continue
      const next = units[cursor + skip + 1]
      // A two-unit anchor is required whenever another content unit is available,
      // so a repeated "and" or a single trailing word cannot jump the passage.
      if (next && !next.isReferenceUnit && !matches(cursor + skip + 1, spoken + length)) continue
      anchors.push(skip)
    }
    // An inserted or repeated phrase can itself look like a later anchor.
    // Prefer a nearby direct match to inventing a gap in that situation.
    // The follow-on word cannot be confirmed once the tokens run out, so
    // allow the direct hit to stand on its own at the end of the utterance.
    let directAhead = 0
    for (let look = spoken + 1; look < Math.min(tokens.length, spoken + 9); look++) {
      const length = matches(cursor, look)
      if (!length) continue
      const next = units[cursor + 1]
      const atEnd = spoken + length >= tokens.length
      if (length && (!next || next.isReferenceUnit || atEnd || matches(cursor + 1, look + length))) { directAhead = look; break }
    }
    if (directAhead) { spoken = directAhead; continue }
    const expected = normalizeSpeech(units[cursor].text)
    const previous = decisions.at(-1)
    const previousWord = normalizeSpeech(units[cursor - 1]?.text)[0]
    const nextWord = normalizeSpeech(units[cursor + 1]?.text)[0]
    // The spoken token takes the place of exactly one expected word. Require
    // a heard word before it and a direct match after it, so a new segment,
    // insertion, or unlocated phrase cannot create a false mistake.
    if (expected.length === 1 && previous?.index === cursor - 1 && previous.accepted === VOICE_HEARD &&
        spoken + 1 < tokens.length && matches(cursor + 1, spoken + 1) &&
        clearVoiceReplacement(expected[0], tokens[spoken], previousWord, nextWord)) {
      decisions.push({ index: cursor++, incorrect: true, accepted: VOICE_REPLACED })
      spoken++
      consumed = spoken
      remainders.push(suffix(consumed))
      continue
    }
    if (anchors.length === 1) {
      // One clear later phrase locates the speaker past these words. Advance
      // across the gap as bridged progress rather than stopping or penalising.
      for (let i = 0; i < anchors[0]; i++) {
        decisions.push({ index: cursor++, ...credits(VOICE_BRIDGED) })
        remainders.push(suffix(spoken))
      }
      continue
    }
    // Two or more positions fit: the evidence is not specific enough to move.
    if (anchors.length > 1) { ambiguous = true; break }
    // Nothing anchors this speech. Unmatched text stays buffered so a later
    // phrase can still locate it, and silence or a filler advances nothing.
    spoken++
  }
  return { decisions, consumed, tokens, ambiguous, nextIndex: cursor, waiting: spoken > consumed, remainder: suffix(consumed), remainders }
}

// Prefer clean heard words over uncertain bridges or replacements. A clean
// alternative should not be vetoed by another hypothesis guessing a mistake.
function score(result) {
  const decisions = result.decisions || []
  const wrong = decisions.filter(decision => decision.incorrect).length
  const bridged = decisions.filter(decision => !decision.incorrect && decision.accepted === VOICE_BRIDGED).length
  const heard = decisions.length - bridged - wrong
  return heard * 1000 - bridged * 100 - wrong * 1000 + decisions.length
}

// Prefer whichever hypothesis advances furthest with the fewest bridges. A worse
// alternative must never veto words a better one already located.
export function resolveSpeechAlternatives(results) {
  if (!results.length) {
    return { decisions: [], remainders: [''], ambiguous: false, waiting: false, bridged: false, unsupported: false }
  }
  let best = results[0]
  let bestScore = score(best)
  for (const result of results.slice(1)) {
    const candidate = score(result)
    if (candidate > bestScore) { best = result; bestScore = candidate }
  }

  const agreements = results.filter(result => result.decisions.length >= best.decisions.length
    && best.decisions.every((decision, index) => result.decisions[index]?.index === decision.index))

  return {
    decisions: best.decisions,
    remainders: [...new Set(agreements.map(result => result.remainders?.[best.decisions.length] ?? result.remainder ?? ''))],
    ambiguous: agreements.some(result => result.ambiguous),
    waiting: agreements.some(result => result.waiting),
    bridged: best.decisions.some(decision => decision.accepted === VOICE_BRIDGED),
    unsupported: results.every(result => result.unsupported),
  }
}

export function matchAlternatives(units, startIndex, alternatives) {
  return resolveSpeechAlternatives(alternatives.map(text => matchSpeech(units, startIndex, text)))
}
