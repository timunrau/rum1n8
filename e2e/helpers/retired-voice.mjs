// Tiny real Cache Storage fixtures shared by browser and production-upgrade
// checks. No recognizer mocks or large model downloads are needed.
export const retiredVoiceCaches = [
  'ruminate-voice-model-sherpa-en-v1.13.7',
  'ruminate-voice-model-older',
  'ruminate-voice-model-partial',
]
export const retainedCaches = [
  'rum1n8-bible-manifest-v1',
  'rum1n8-bible-text-v0-upgrade-sentinel',
  'upgrade-unrelated-cache',
]
export const settingsTimestamp = '2026-06-20T12:00:00.000Z'

export async function seedRetiredVoiceData(page) {
  await page.evaluate(async ({ retired, retained, timestamp }) => {
    for (const name of [...retired, ...retained]) {
      const cache = await caches.open(name)
      // The empty cache models an interrupted download before its first file.
      if (name !== 'ruminate-voice-model-partial') {
        await cache.put('/upgrade-sentinel', new Response(`keep:${name}`))
      }
    }
    localStorage.setItem('rum1n8-app-settings', JSON.stringify({
      appSettings: {
        voicePracticeEnabled: true,
        requireReferenceTyping: false,
        showMasterPlaceholderLines: false,
        analyticsOptOut: true,
        defaultBibleVersion: '',
        futureSetting: 'keep',
      },
      appSettingsLastModified: timestamp,
    }))
  }, { retired: retiredVoiceCaches, retained: retainedCaches, timestamp: settingsTimestamp })
}

export async function verifyRetiredVoiceCleanup(page) {
  await page.waitForFunction(async () => (
    (await caches.keys()).every(name => !name.startsWith('ruminate-voice-model-'))
  ))
  const result = await page.evaluate(async names => {
    const present = await caches.keys()
    const retained = []
    for (const name of names) {
      if (!present.includes(name)) throw new Error(`Unrelated cache was deleted: ${name}`)
      const response = await (await caches.open(name)).match('/upgrade-sentinel')
      if (await response?.text() !== `keep:${name}`) throw new Error(`Unrelated cache changed: ${name}`)
      retained.push(name)
    }
    return { retained, settings: JSON.parse(localStorage.getItem('rum1n8-app-settings')) }
  }, retainedCaches)
  const { appSettings, appSettingsLastModified } = result.settings
  if (Object.hasOwn(appSettings, 'voicePracticeEnabled')) throw new Error('Retired voice setting survived')
  if (appSettingsLastModified !== settingsTimestamp || appSettings.futureSetting !== 'keep'
    || appSettings.analyticsOptOut !== true || appSettings.showMasterPlaceholderLines !== false) {
    throw new Error('Unrelated settings or their timestamp changed during cleanup')
  }
  return result
}
