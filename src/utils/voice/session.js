import { matchSpeech, resolveSpeechAlternatives } from './matcher.js'
import { speechTokensWithOffsets } from './normalization.js'
import { matchSpokenReference } from './spoken-reference.js'

// Unmatched speech stays buffered so a later anchor can still locate it. These
// bounds keep a long unrecognizable passage from growing the buffer without end.
export const VOICE_MAX_BUFFERS = 9
export const VOICE_MAX_BUFFER_LENGTH = 1500

const firstAnchorUnits = 2

// Match one utterance against the display units from the current cursor onward.
// Handles the content run, the trailing content word before a spoken reference,
// and the reference units themselves.
export function matchVoiceUtterance({ units, startIndex, reference = '' }, text) {
  const start = startIndex
  if (start < 0) return { decisions: [], remainder: '' }
  let content = units[start].isReferenceUnit
    ? { decisions: [], nextIndex: start, remainder: text, remainders: [text] }
    : matchSpeech(units, start, text)
  if (content.ambiguous) return content
  // A completed spoken reference also locates the end of the verse. If
  // the last content word was different or omitted, count just that unit
  // as missed and continue into the reference.
  const lastContent = units[content.nextIndex]
  if (lastContent && !lastContent.isReferenceUnit && units[content.nextIndex + 1]?.isReferenceUnit) {
    const { ends } = speechTokensWithOffsets(content.remainder)
    for (const skip of [0, 1]) {
      if (skip && !ends.length) break
      const remainder = skip ? content.remainder.slice(ends[0]).trim() : content.remainder
      const located = matchSpokenReference(units, content.nextIndex + 1, reference, remainder)
      if (!located.decisions?.length || located.pending || located.ambiguous) continue
      content = {
        ...content,
        decisions: [...content.decisions, { index: lastContent.index, incorrect: true }],
        nextIndex: content.nextIndex + 1,
        remainder,
        remainders: [...content.remainders, remainder],
      }
      break
    }
  }
  if (units[content.nextIndex]?.isReferenceUnit) {
    const result = matchSpokenReference(units, content.nextIndex, reference, content.remainder)
    const remainder = result.decisions.length ? '' : content.remainder
    return {
      ...result,
      decisions: [...content.decisions, ...result.decisions],
      remainder,
      // A partial reference still needs its book and structure to be parsed.
      remainders: [
        ...content.remainders,
        ...result.decisions.map((_, index) => (index === result.decisions.length - 1 ? '' : content.remainder)),
      ],
    }
  }
  return content
}

// Turn one recognition result into the decisions to apply and the buffers to
// keep. Pure: the caller applies the decisions and reports the new buffers.
export function resolveVoiceAlternatives(
  { units, startIndex, reference = '', buffers = [''], repeatPending = false },
  alternatives,
) {
  const context = { units, startIndex, reference }
  let prefixes = buffers
  if (repeatPending) {
    const restart = resolveSpeechAlternatives(alternatives.map(text => matchVoiceUtterance(context, text)))
    // A clear repetition from the cursor replaces the disputed suffix. Do
    // not let an old recognition hypothesis veto the user's correction.
    const anchorLength = Math.min(firstAnchorUnits, units.length - startIndex)
    if (restart.decisions.length >= anchorLength &&
        restart.decisions.slice(0, firstAnchorUnits).every(decision => !decision.incorrect)) {
      prefixes = ['']
    }
  }
  const candidates = prefixes.flatMap(prefix => alternatives.map(text => `${prefix} ${text}`.trim()))
  const result = resolveSpeechAlternatives(candidates.map(text => matchVoiceUtterance(context, text)))
  const overflow = result.remainders.length > VOICE_MAX_BUFFERS ||
    result.remainders.some(text => text.length > VOICE_MAX_BUFFER_LENGTH)
  return {
    decisions: result.decisions,
    remainders: overflow ? [''] : result.remainders,
    ambiguous: result.ambiguous,
    waiting: result.waiting,
    unsupported: result.unsupported,
    overflow,
    repeatPending: result.ambiguous || overflow,
    // Only speak up when nothing was accepted and the position is still unclear.
    needsContinuationPrompt: !result.decisions.length && (result.ambiguous || result.waiting),
  }
}
