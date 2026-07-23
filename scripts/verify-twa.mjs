import { access, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const APP_PATH = '/app/'
const failures = []

function check(condition, message) {
  if (!condition) failures.push(message)
}

async function readText(path, label, { optional = false } = {}) {
  try {
    return await readFile(resolve(path), 'utf8')
  } catch (error) {
    if (!optional) failures.push(`${label} is missing or unreadable at ${path}: ${error.message}`)
    return ''
  }
}

async function readJson(path, label, options) {
  const text = await readText(path, label, options)
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch (error) {
    failures.push(`${label} is not valid JSON: ${error.message}`)
    return null
  }
}

function isAppUrl(value, origin) {
  try {
    const url = new URL(value, origin)
    return url.origin === origin && url.pathname.startsWith(APP_PATH)
  } catch {
    return false
  }
}

const twa = await readJson('android-twa/twa-manifest.json', 'Bubblewrap manifest')
const web = await readJson('dist/manifest.webmanifest', 'built web manifest')
const embeddedWeb = await readJson(
  'android-twa/app/src/main/res/raw/web_app_manifest.json',
  'embedded web manifest',
)
const gradle = await readText('android-twa/app/build.gradle', 'generated Android build metadata')
const androidManifest = await readText(
  'android-twa/app/src/main/AndroidManifest.xml',
  'generated Android manifest',
)
const launcherActivity = await readText(
  'android-twa/app/src/main/java/xyz/unrau/rum1n8/LauncherActivity.java',
  'generated launcher activity',
)
const nginx = await readText('nginx.conf', 'Nginx configuration')

if (twa) {
  const origin = `https://${twa.host}`
  check(twa.packageId === 'xyz.unrau.rum1n8', 'Bubblewrap packageId must be xyz.unrau.rum1n8.')
  check(twa.host === 'rum1n8.unrau.xyz', 'Bubblewrap host must be rum1n8.unrau.xyz.')
  check(twa.startUrl === APP_PATH, `Bubblewrap startUrl must be exactly ${APP_PATH}.`)
  check(twa.display === 'standalone', 'Bubblewrap display mode must remain standalone.')
  check(twa.fallbackType === 'customtabs', 'Bubblewrap fallback must remain Custom Tabs.')
  check(twa.enableNotifications === false, 'Notification delegation must remain disabled.')
  check(Number.isSafeInteger(twa.appVersionCode) && twa.appVersionCode > 0, 'Android versionCode must be a positive integer.')
  check(twa.appVersion === twa.appVersionName, 'Bubblewrap appVersion and appVersionName must match.')
  check(Object.keys(twa.features || {}).length === 0, 'Unexpected native TWA feature delegation is enabled.')
  check((twa.additionalTrustedOrigins || []).length === 0, 'Additional trusted origins are not approved.')
  check((twa.fileHandlers || []).length === 0, 'Native file handlers are not approved.')
  check((twa.protocolHandlers || []).length === 0, 'Protocol handlers are not approved.')

  for (const shortcut of twa.shortcuts || []) {
    check(isAppUrl(shortcut.url, origin), `Shortcut URL must stay under ${origin}${APP_PATH}: ${shortcut.url}`)
  }

  for (const fingerprint of twa.fingerprints || []) {
    check(
      /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(fingerprint.value || ''),
      `Invalid SHA-256 signing fingerprint: ${fingerprint.value || '<empty>'}`,
    )
  }
}

for (const [label, manifest] of [
  ['built web manifest', web],
  ['embedded web manifest', embeddedWeb],
]) {
  if (!manifest) continue
  check(manifest.start_url === APP_PATH, `${label} start_url must be exactly ${APP_PATH}.`)
  check(manifest.display === 'standalone', `${label} display must remain standalone.`)
  check(manifest.icons?.some((icon) => icon.sizes === '192x192'), `${label} needs a 192 px icon.`)
  check(manifest.icons?.some((icon) => icon.sizes === '512x512'), `${label} needs a 512 px icon.`)
}

if (twa) {
  const escapedPackage = twa.packageId.replaceAll('.', '\\.')
  const compileSdk = Number(gradle.match(/compileSdkVersion (\d+)/)?.[1])
  const targetSdk = Number(gradle.match(/targetSdkVersion (\d+)/)?.[1])
  check(new RegExp(`applicationId: '${escapedPackage}'`).test(gradle), 'Generated Gradle package ID differs from twa-manifest.json.')
  check(new RegExp(`applicationId "${escapedPackage}"`).test(gradle), 'Gradle defaultConfig package ID differs from twa-manifest.json.')
  check(/launchUrl: '\/app\/'/.test(gradle), 'Generated Gradle launchUrl must be exactly /app/.')
  check(compileSdk >= targetSdk, 'Android compile SDK must not be lower than its target SDK.')
  check(targetSdk >= 35, 'Android target SDK is below the current Play requirement.')
  check(gradle.includes(`versionCode ${twa.appVersionCode}`), 'Generated Android versionCode differs from twa-manifest.json.')
  check(gradle.includes(`versionName "${twa.appVersionName}"`), 'Generated Android versionName differs from twa-manifest.json.')
  check(new RegExp(`package ${escapedPackage};`).test(launcherActivity), 'LauncherActivity package differs from twa-manifest.json.')
}

check(!/<manifest\b[^>]*?\s+package="/.test(androidManifest), 'Android manifest must not use the obsolete package attribute.')

const autoVerifyFilters = androidManifest.match(/<intent-filter android:autoVerify="true">[\s\S]*?<\/intent-filter>/g) || []
check(autoVerifyFilters.length === 1, 'Android must have exactly one auto-verified App Link filter.')
if (autoVerifyFilters[0]) {
  check(autoVerifyFilters[0].includes('android:scheme="https"'), 'App Link filter must use HTTPS.')
  check(autoVerifyFilters[0].includes('android:host="@string/hostName"'), 'App Link filter must use the configured host.')
  check(autoVerifyFilters[0].includes(`android:pathPrefix="${APP_PATH}"`), `App Link filter must be scoped to ${APP_PATH}.`)
}
check(
  /android\.support\.customtabs\.trusted\.DEFAULT_URL"\s+android:value="@string\/launchUrl"/.test(androidManifest),
  'Android launcher DEFAULT_URL must resolve through the verified launchUrl resource.',
)
check(!androidManifest.includes('android.permission.POST_NOTIFICATIONS'), 'The generated app must not request notification permission.')

check(
  /location = \/manifest\.webmanifest \{[\s\S]*?default_type application\/manifest\+json;[\s\S]*?try_files \$uri =404;[\s\S]*?\}/.test(nginx),
  'Nginx must serve the exact manifest path as application/manifest+json without fallback.',
)
check(
  /location = \/\.well-known\/assetlinks\.json \{[\s\S]*?default_type application\/json;[\s\S]*?try_files \$uri =404;[\s\S]*?\}/.test(nginx),
  'Nginx must serve the exact assetlinks path as application/json without fallback.',
)

try {
  await access(resolve('dist/app/index.html'))
  await access(resolve('dist/sw.js'))
} catch (error) {
  failures.push(`The production build must contain /app/index.html and /sw.js: ${error.message}`)
}

const assetLinks = await readJson(
  'public/.well-known/assetlinks.json',
  'Digital Asset Links file',
  { optional: true },
)

if (assetLinks) {
  check(Array.isArray(assetLinks) && assetLinks.length > 0, 'assetlinks.json must contain at least one statement.')
  const approvedFingerprints = new Set((twa?.fingerprints || []).map(({ value }) => value))
  const publishedFingerprints = new Set()
  for (const statement of Array.isArray(assetLinks) ? assetLinks : []) {
    check(statement.relation?.includes('delegate_permission/common.handle_all_urls'), 'assetlinks.json has an unexpected relation.')
    check(statement.target?.namespace === 'android_app', 'assetlinks.json target namespace must be android_app.')
    check(statement.target?.package_name === twa?.packageId, 'assetlinks.json package name must match twa-manifest.json.')
    for (const fingerprint of statement.target?.sha256_cert_fingerprints || []) publishedFingerprints.add(fingerprint)
  }
  check(publishedFingerprints.size > 0, 'assetlinks.json must publish at least one signing fingerprint.')
  check(
    [...publishedFingerprints].every((fingerprint) => approvedFingerprints.has(fingerprint)),
    'assetlinks.json contains a fingerprint not recorded in twa-manifest.json.',
  )
} else if ((twa?.fingerprints || []).length > 0) {
  failures.push('Signing fingerprints exist, but public/.well-known/assetlinks.json is missing.')
}

if (failures.length > 0) {
  console.error('TWA verification failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

const signingState = (twa?.fingerprints || []).length > 0 ? 'signed association configured' : 'unsigned prototype'
console.log(`TWA metadata verified (${signingState}; launcher ${APP_PATH}; package ${twa?.packageId}).`)
