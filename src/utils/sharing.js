export async function copyTextToClipboard(text) {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  if (typeof document === 'undefined') {
    throw new Error('Clipboard is not available.')
  }

  const textArea = document.createElement('textarea')
  textArea.value = text
  textArea.setAttribute('readonly', '')
  textArea.style.position = 'fixed'
  textArea.style.top = '-9999px'
  textArea.style.opacity = '0'
  document.body.appendChild(textArea)
  textArea.select()

  try {
    if (!document.execCommand('copy')) {
      throw new Error('Copy command was not accepted.')
    }
  } finally {
    document.body.removeChild(textArea)
  }
}

// Every verse-sharing surface uses this payload and delivery path.
export async function shareVerse(verse, marketingUrl) {
  const version = typeof verse.bibleVersion === 'string' ? verse.bibleVersion.trim().toUpperCase() : ''
  const reference = [verse.reference.trim(), version].filter(Boolean).join(' ')
  const text = [
    `${verse.content.trimEnd()} ${reference}`,
    '',
    'Shared from Ruminate',
    marketingUrl
  ].join('\n')

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      // Some share targets prepend the title, so keep the reference only in the text.
      await navigator.share({ text })
      return 'shared'
    } catch (error) {
      if (error?.name === 'AbortError') return 'cancelled'
      console.error('Failed to share verse:', error)
    }
  }

  await copyTextToClipboard(text)
  return 'copied'
}
