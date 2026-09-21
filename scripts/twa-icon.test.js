import { readFileSync } from 'node:fs'
import { PNG } from 'pngjs'
import { describe, expect, it } from 'vitest'

const TWA_ICONS = [
  ['regular mdpi', 'public/icons/icon-512x512.png', 'android-twa/app/src/main/res/mipmap-mdpi/ic_launcher.png'],
  ['regular hdpi', 'public/icons/icon-512x512.png', 'android-twa/app/src/main/res/mipmap-hdpi/ic_launcher.png'],
  ['regular xhdpi', 'public/icons/icon-512x512.png', 'android-twa/app/src/main/res/mipmap-xhdpi/ic_launcher.png'],
  ['regular xxhdpi', 'public/icons/icon-512x512.png', 'android-twa/app/src/main/res/mipmap-xxhdpi/ic_launcher.png'],
  ['regular xxxhdpi', 'public/icons/icon-512x512.png', 'android-twa/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png'],
  ['maskable mdpi', 'public/icons/icon-maskable-512x512.png', 'android-twa/app/src/main/res/mipmap-mdpi/ic_maskable.png'],
  ['maskable hdpi', 'public/icons/icon-maskable-512x512.png', 'android-twa/app/src/main/res/mipmap-hdpi/ic_maskable.png'],
  ['maskable xhdpi', 'public/icons/icon-maskable-512x512.png', 'android-twa/app/src/main/res/mipmap-xhdpi/ic_maskable.png'],
  ['maskable xxhdpi', 'public/icons/icon-maskable-512x512.png', 'android-twa/app/src/main/res/mipmap-xxhdpi/ic_maskable.png'],
  ['maskable xxxhdpi', 'public/icons/icon-maskable-512x512.png', 'android-twa/app/src/main/res/mipmap-xxxhdpi/ic_maskable.png'],
]
const SAMPLE_SIZE = 32

function readPng(path) {
  return PNG.sync.read(readFileSync(path))
}

function sampleGrid(image) {
  const samples = []

  for (let gridY = 0; gridY < SAMPLE_SIZE; gridY += 1) {
    const startY = Math.floor(gridY * image.height / SAMPLE_SIZE)
    const endY = Math.max(startY + 1, Math.floor((gridY + 1) * image.height / SAMPLE_SIZE))

    for (let gridX = 0; gridX < SAMPLE_SIZE; gridX += 1) {
      const startX = Math.floor(gridX * image.width / SAMPLE_SIZE)
      const endX = Math.max(startX + 1, Math.floor((gridX + 1) * image.width / SAMPLE_SIZE))
      const channels = [0, 0, 0, 0]
      let pixels = 0

      for (let y = startY; y < endY; y += 1) {
        for (let x = startX; x < endX; x += 1) {
          const offset = (y * image.width + x) * 4
          for (let channel = 0; channel < 4; channel += 1) {
            channels[channel] += image.data[offset + channel]
          }
          pixels += 1
        }
      }

      samples.push(channels.map(value => value / pixels))
    }
  }

  return samples
}

function meanAbsoluteChannelDifference(left, right) {
  let total = 0
  let channels = 0

  for (let index = 0; index < left.length; index += 1) {
    for (let channel = 0; channel < 4; channel += 1) {
      total += Math.abs(left[index][channel] - right[index][channel])
      channels += 1
    }
  }

  return total / channels
}

describe('generated TWA launcher icons', () => {
  const pwaSamples = new Map()

  it.each(TWA_ICONS)('%s matches its PWA source icon', (_label, pwaPath, twaPath) => {
    if (!pwaSamples.has(pwaPath)) pwaSamples.set(pwaPath, sampleGrid(readPng(pwaPath)))
    const difference = meanAbsoluteChannelDifference(
      pwaSamples.get(pwaPath),
      sampleGrid(readPng(twaPath)),
    )

    expect(difference).toBeLessThan(6)
  })
})
