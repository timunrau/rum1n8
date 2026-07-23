import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const nextCode = Number(process.argv[2])
if (!Number.isSafeInteger(nextCode) || nextCode < 1) {
  throw new Error('Usage: npm run twa:version -- <positive-version-code>')
}

const packageJson = JSON.parse(await readFile(resolve('package.json'), 'utf8'))
const manifestPath = resolve('android-twa/twa-manifest.json')
const twaManifest = JSON.parse(await readFile(manifestPath, 'utf8'))

if (nextCode <= twaManifest.appVersionCode) {
  throw new Error(
    `Android versionCode must increase beyond ${twaManifest.appVersionCode}; received ${nextCode}.`,
  )
}

twaManifest.appVersionCode = nextCode
twaManifest.appVersionName = packageJson.version
twaManifest.appVersion = packageJson.version

await writeFile(manifestPath, `${JSON.stringify(twaManifest, null, 2)}\n`)
console.log(`Set Android version ${packageJson.version} (${nextCode}). Run npm run twa:update next.`)
