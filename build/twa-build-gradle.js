export const ANDROID_BROWSER_HELPER_VERSION = '2.7.3'
export const MIN_ANDROID_SDK = 23
export const TARGET_ANDROID_SDK = 36

const ANDROID_BROWSER_HELPER_PATTERN = /(['"])com\.google\.androidbrowserhelper:androidbrowserhelper:([^'"]+)\1/g

export function configureGeneratedTwaBuildGradle(source) {
  const compileSdkMatches = [...source.matchAll(/compileSdkVersion\s+(\d+)/g)]
  const minSdkMatches = [...source.matchAll(/minSdkVersion\s+(\d+)/g)]
  const targetSdkMatches = [...source.matchAll(/targetSdkVersion\s+(\d+)/g)]
  const browserHelperMatches = [...source.matchAll(ANDROID_BROWSER_HELPER_PATTERN)]

  if (compileSdkMatches.length !== 1 || minSdkMatches.length !== 1 || targetSdkMatches.length !== 1) {
    throw new Error(
      'Expected one compileSdkVersion, minSdkVersion, and targetSdkVersion; '
        + `found ${compileSdkMatches.length}, ${minSdkMatches.length}, and ${targetSdkMatches.length}.`,
    )
  }

  if (browserHelperMatches.length !== 1) {
    throw new Error(
      'Expected one Android Browser Helper dependency; '
        + `found ${browserHelperMatches.length}.`,
    )
  }

  const compileSdk = Number(compileSdkMatches[0][1])
  const minSdk = Number(minSdkMatches[0][1])
  const targetSdk = Number(targetSdkMatches[0][1])
  const browserHelperVersion = browserHelperMatches[0][2]

  if (compileSdk < TARGET_ANDROID_SDK) {
    throw new Error(
      `Android compile SDK ${compileSdk} is lower than required target SDK ${TARGET_ANDROID_SDK}.`,
    )
  }

  let configured = source
  const changes = []

  if (minSdk < MIN_ANDROID_SDK) {
    configured = configured.replace(
      minSdkMatches[0][0],
      `minSdkVersion ${MIN_ANDROID_SDK}`,
    )
    changes.push(`set the minimum Android SDK to ${MIN_ANDROID_SDK}`)
  }

  if (targetSdk !== TARGET_ANDROID_SDK) {
    configured = configured.replace(
      targetSdkMatches[0][0],
      `targetSdkVersion ${TARGET_ANDROID_SDK}`,
    )
    changes.push(`set the Android target SDK to ${TARGET_ANDROID_SDK}`)
  }

  if (browserHelperVersion !== ANDROID_BROWSER_HELPER_VERSION) {
    const quote = browserHelperMatches[0][1]
    configured = configured.replace(
      browserHelperMatches[0][0],
      `${quote}com.google.androidbrowserhelper:androidbrowserhelper:${ANDROID_BROWSER_HELPER_VERSION}${quote}`,
    )
    changes.push(`pinned Android Browser Helper to ${ANDROID_BROWSER_HELPER_VERSION}`)
  }

  return { configured, changes }
}
