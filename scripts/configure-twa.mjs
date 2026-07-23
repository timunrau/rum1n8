import { readdir, readFile, writeFile } from 'node:fs/promises'
import { basename, extname, join, resolve } from 'node:path'

const APP_LINK_PATH = '/app/'
const GENERATED_TEXT_EXTENSIONS = new Set(['.bat', '.gradle', '.java', '.properties', '.xml'])
const GENERATED_TEXT_NAMES = new Set(['gradlew'])
const SKIPPED_DIRECTORIES = new Set(['.gradle', 'build', 'node_modules'])
const androidProjectPath = resolve('android-twa')
const manifestPath = resolve('android-twa/app/src/main/AndroidManifest.xml')
const source = await readFile(manifestPath, 'utf8')
const filters = source.match(/<intent-filter android:autoVerify="true">[\s\S]*?<\/intent-filter>/g) || []
let configured = source
const changes = []

if (filters.length !== 1) {
  throw new Error(`Expected one auto-verified App Link filter in ${manifestPath}; found ${filters.length}.`)
}

const filter = filters[0]
if (!filter.includes('android:scheme="https"') || !filter.includes('android:host="@string/hostName"')) {
  throw new Error('The generated App Link filter no longer has the expected HTTPS host declaration.')
}

const existingPath = filter.match(/android:pathPrefix="([^"]+)"/)
if (existingPath && existingPath[1] !== APP_LINK_PATH) {
  throw new Error(`Refusing to replace unexpected App Link scope ${existingPath[1]}.`)
}

if (!existingPath) {
  const scopedFilter = filter.replace(
    'android:host="@string/hostName"',
    `android:host="@string/hostName"\n                    android:pathPrefix="${APP_LINK_PATH}"`,
  )

  if (scopedFilter === filter) {
    throw new Error('Could not add the /app/ path scope to the generated App Link filter.')
  }

  configured = configured.replace(filter, scopedFilter)
  changes.push(`scoped the Android App Link filter to ${APP_LINK_PATH}`)
}

const withoutLegacyPackage = configured.replace(/(<manifest\b[^>]*?)\s+package="[^"]+"/, '$1')
if (withoutLegacyPackage !== configured) {
  configured = withoutLegacyPackage
  changes.push('removed the obsolete manifest package attribute')
}

if (configured !== source) {
  await writeFile(manifestPath, configured)
}

async function findGeneratedTextFiles(directory) {
  const files = []
  const entries = await readdir(directory, { withFileTypes: true })

  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRECTORIES.has(entry.name)) files.push(...await findGeneratedTextFiles(path))
      continue
    }

    if (GENERATED_TEXT_EXTENSIONS.has(extname(entry.name)) || GENERATED_TEXT_NAMES.has(basename(entry.name))) {
      files.push(path)
    }
  }

  return files
}

let normalizedFiles = 0
for (const path of await findGeneratedTextFiles(androidProjectPath)) {
  const text = await readFile(path, 'utf8')
  const normalized = text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n*$/, '\n')

  if (normalized !== text) {
    await writeFile(path, normalized)
    normalizedFiles += 1
  }
}

if (normalizedFiles > 0) changes.push(`normalized ${normalizedFiles} generated text files`)

if (changes.length === 0) {
  console.log('Generated Android project is already configured')
} else {
  console.log(`Configured generated Android project: ${changes.join('; ')}`)
}
