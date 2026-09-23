import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = resolve('public/icons/icon-maskable-512x512.png')
const resourceRoot = resolve('android-twa/app/src/main/res')
const sizes = { mdpi: 82, hdpi: 123, xhdpi: 164, xxhdpi: 246, xxxhdpi: 328 }

for (const [density, size] of Object.entries(sizes)) {
  const target = resolve(resourceRoot, `mipmap-${density}/ic_maskable.png`)
  execFileSync('magick', [source, '-resize', `${size}x${size}`, target])
}

// The maskable image is already full bleed. Bubblewrap's white backing and inset
// show as a pale rim around round launcher icons, so use the image as the background.
const adaptivePath = resolve(resourceRoot, 'mipmap-anydpi-v26/ic_launcher.xml')
const adaptiveXml = readFileSync(adaptivePath, 'utf8')
const bubblewrapBackground = /<background>\s*<layer-list>[\s\S]*?<\/layer-list>\s*<\/background>/
const localBackground = '<background android:drawable="@mipmap/ic_maskable" />'
if (!bubblewrapBackground.test(adaptiveXml) && !adaptiveXml.includes(localBackground)) {
  throw new Error('Unexpected Bubblewrap adaptive icon layout')
}
writeFileSync(adaptivePath, adaptiveXml.replace(bubblewrapBackground, localBackground))

console.log('Synced local maskable icon into the Android launcher resources')
