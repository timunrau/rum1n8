import { describe, expect, test } from 'vitest'
import {
  ANDROID_BROWSER_HELPER_VERSION,
  configureGeneratedTwaBuildGradle,
} from './twa-build-gradle.js'

function generatedBuildGradle({
  compileSdk = 36,
  minSdk = 21,
  targetSdk = 35,
  browserHelperVersion = '2.6.2',
} = {}) {
  return `
android {
    compileSdkVersion ${compileSdk}
    defaultConfig {
        minSdkVersion ${minSdk}
        targetSdkVersion ${targetSdk}
    }
}

dependencies {
    implementation 'com.google.androidbrowserhelper:androidbrowserhelper:${browserHelperVersion}'
}
`
}

describe('generated TWA Gradle configuration', () => {
  test('upgrades the browser helper used for cold offline TWA launches', () => {
    const result = configureGeneratedTwaBuildGradle(generatedBuildGradle())

    expect(result.configured).toContain('targetSdkVersion 36')
    expect(result.configured).toContain('minSdkVersion 23')
    expect(result.configured).toContain(
      `com.google.androidbrowserhelper:androidbrowserhelper:${ANDROID_BROWSER_HELPER_VERSION}`,
    )
    expect(result.configured).not.toContain('androidbrowserhelper:2.6.2')
    expect(result.changes).toEqual([
      'set the minimum Android SDK to 23',
      'set the Android target SDK to 36',
      `pinned Android Browser Helper to ${ANDROID_BROWSER_HELPER_VERSION}`,
    ])
  })

  test('is idempotent after the generated project is configured', () => {
    const source = generatedBuildGradle({
      minSdk: 23,
      targetSdk: 36,
      browserHelperVersion: ANDROID_BROWSER_HELPER_VERSION,
    })

    expect(configureGeneratedTwaBuildGradle(source)).toEqual({
      configured: source,
      changes: [],
    })
  })

  test('fails if Bubblewrap removes the browser helper dependency', () => {
    const source = generatedBuildGradle().replace(
      /\s*implementation 'com\.google\.androidbrowserhelper:androidbrowserhelper:[^']+'\n/,
      '\n',
    )

    expect(() => configureGeneratedTwaBuildGradle(source)).toThrow(
      'Expected one Android Browser Helper dependency; found 0.',
    )
  })

  test('fails when the generated compile SDK cannot support the required target', () => {
    expect(() => configureGeneratedTwaBuildGradle(generatedBuildGradle({ compileSdk: 35 }))).toThrow(
      'Android compile SDK 35 is lower than required target SDK 36.',
    )
  })
})
