/**
 * localStorage utilities for E2E test isolation.
 * Clears and seeds bible-memory app data before/after tests.
 */

import type { Page } from '@playwright/test'

const STORAGE_KEYS = [
  'bible-memory-verses',
  'bible-memory-collections',
  'bible-memory-webdav-settings',
  'bible-memory-sync-state',
  'bible-memory-deleted-verses',
  'bible-memory-deleted-collections',
  'bible-memory-last-backup',
]

export async function clearBibleMemoryStorage(page: Page) {
  await page.evaluate((keys: string[]) => {
    keys.forEach((key) => localStorage.removeItem(key))
  }, STORAGE_KEYS)
}

export async function seedVerses(page: Page, verses: unknown[]) {
  await page.evaluate(
    (data: string) => {
      localStorage.setItem('bible-memory-verses', data)
    },
    JSON.stringify(verses)
  )
}

export async function seedCollections(page: Page, collections: unknown[]) {
  await page.evaluate(
    (data: string) => {
      localStorage.setItem('bible-memory-collections', data)
    },
    JSON.stringify(collections)
  )
}

export async function seedStorage(
  page: Page,
  verses: unknown[],
  collections: unknown[]
) {
  await page.evaluate(
    ({ versesData, collectionsData }: { versesData: string; collectionsData: string }) => {
      localStorage.setItem('bible-memory-verses', versesData)
      localStorage.setItem('bible-memory-collections', collectionsData)
    },
    {
      versesData: JSON.stringify(verses),
      collectionsData: JSON.stringify(collections),
    }
  )
}

export async function getStoredVerses(page: Page): Promise<unknown[]> {
  return page.evaluate(() => {
    const raw = localStorage.getItem('bible-memory-verses')
    return raw ? JSON.parse(raw) : []
  })
}
