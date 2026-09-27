const small = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split(' ')
const tens = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 }
const contractions = { "don't": 'do not', "doesn't": 'does not', "didn't": 'did not', "can't": 'can not', cannot: 'can not', "won't": 'will not', "isn't": 'is not', "aren't": 'are not', "wasn't": 'was not', "weren't": 'were not', "I'm": 'i am', "i'm": 'i am', "you're": 'you are', "we're": 'we are', "they're": 'they are', "I've": 'i have', "i've": 'i have', "you've": 'you have', "we've": 'we have', "they've": 'they have', "I'll": 'i will', "i'll": 'i will', "you'll": 'you will', "we'll": 'we will', "they'll": 'they will', "let's": 'let us' }
// Deliberately explicit: never fuzzy spelling or semantic similarity.
const homophones = { too: '2', to: '2', two: '2', for: '4', four: '4', won: '1', one: '1', their: 'there', "they're": 'there', hear: 'here', son: 'sun', our: 'hour', your: 'yore', peace: 'piece', whole: 'hole', knew: 'new', no: 'know', right: 'write', reign: 'rain' }
export function rawTokens(text = '') {
  return text.toLowerCase().replace(/[’‘]/g, "'").replace(/[-‐‑‒–—]/g, ' ').replace(/[^a-z0-9'\s]/g, ' ').split(/\s+/).filter(Boolean)
}
export function numberAt(tokens, index) {
  const token = tokens[index]
  if (/^\d+$/.test(token || '')) return { value: String(Number(token)), length: 1 }
  let value = small.indexOf(token), length = 1
  if (value < 0) value = tens[token] ?? -1
  if (value < 0) return null
  if (tokens[index + 1] === 'hundred' && value > 0 && value < 10) {
    value *= 100
    length++
    if (tokens[index + length] === 'and') length++
    const rest = numberAt(tokens, index + length)
    if (rest && Number(rest.value) < 100) { value += Number(rest.value); length += rest.length }
  } else if (value >= 20 && small.indexOf(tokens[index + 1]) > 0 && small.indexOf(tokens[index + 1]) < 10) {
    value += small.indexOf(tokens[index + 1]); length++
  }
  return { value: String(value), length }
}
export function speechTokensWithOffsets(text = '') {
  const entries = [...text.toLowerCase().replace(/[’‘]/g, "'").matchAll(/[a-z0-9']+/g)].map(match => ({ text: match[0], end: match.index + match[0].length }))
  const expanded = entries.flatMap(entry => (contractions[entry.text] || entry.text).split(' ').map(token => ({ text: token, end: entry.end })))
  const words = expanded.map(entry => entry.text)
  const tokens = [], ends = []
  for (let i = 0; i < words.length;) {
    const number = numberAt(words, i)
    if (number) { tokens.push(number.value); ends.push(expanded[i + number.length - 1].end); i += number.length }
    else { tokens.push(homophones[words[i]] || words[i].replace(/'/g, '')); ends.push(expanded[i].end); i++ }
  }
  return { tokens, ends }
}
export function normalizeSpeech(text = '') { return speechTokensWithOffsets(text).tokens }
