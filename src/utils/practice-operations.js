// Record errors before segment completion can save a grade.
export function completePracticeUnit(word, { incorrect = false } = {}, operations) {
  if (!word || word.revealed) return
  if (incorrect) operations.recordMistake(word)
  word.revealed = true
  word.visible = true
  word.typedLettersIndex = word.requiredLetters?.length || 1
  word.incorrect = word.incorrect || incorrect
  operations.advance(word.index)
  operations.completed(word)
  operations.scroll()
}
