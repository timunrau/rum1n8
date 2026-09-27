// Input-independent completion. Record errors before segment completion can save a grade.
export function completePracticeUnit(word, { incorrect = false, source = 'keyboard' } = {}, operations) {
  if (!word || word.revealed) return
  if (incorrect) operations.recordMistake(word, source)
  word.revealed = true
  word.visible = true
  word.typedLettersIndex = word.requiredLetters?.length || 1
  word.incorrect = word.incorrect || incorrect
  if (incorrect && word.isReferenceUnit) {
    word.incorrectLetterIndices = Array.from({ length: word.requiredLetters.length }, (_, index) => index)
  }
  operations.advance(word.index)
  operations.completed(word)
  operations.scroll()
}

export function canSavePracticeAttempt(attempt) {
  return !attempt.discarded && (!attempt.hasVoice || attempt.confirmed)
}
