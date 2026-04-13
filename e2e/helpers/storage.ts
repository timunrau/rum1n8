/**
 * localStorage utilities for E2E test isolation.
 * Clears and seeds rum1n8 app data before/after tests.
 */

import type { Page } from '@playwright/test'

const STORAGE_KEYS = [
  'rum1n8-ui-state',
  'rum1n8-verses',
  'rum1n8-collections',
  'rum1n8-webdav-settings',
  'rum1n8-gdrive-settings',
  'rum1n8-sync-provider',
  'rum1n8-sync-state',
  'rum1n8-deleted-verses',
  'rum1n8-deleted-collections',
  'rum1n8-last-backup',
  'rum1n8-app-settings',
]

export async function clearAppStorage(page: Page) {
  await page.evaluate((keys: string[]) => {
    keys.forEach((key) => localStorage.removeItem(key))
  }, STORAGE_KEYS)
}

export async function seedVerses(page: Page, verses: unknown[]) {
  await page.evaluate(
    (data: string) => {
      localStorage.setItem('rum1n8-verses', data)
    },
    JSON.stringify(verses)
  )
}

export async function seedCollections(page: Page, collections: unknown[]) {
  await page.evaluate(
    (data: string) => {
      localStorage.setItem('rum1n8-collections', data)
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
      localStorage.setItem('rum1n8-verses', versesData)
      localStorage.setItem('rum1n8-collections', collectionsData)
    },
    {
      versesData: JSON.stringify(verses),
      collectionsData: JSON.stringify(collections),
    }
  )
}

export async function seedAppSettings(
  page: Page,
  settings: Record<string, unknown>,
  appSettingsLastModified = new Date().toISOString()
) {
  await page.evaluate(
    ({ appSettings, modifiedAt }: { appSettings: Record<string, unknown>; modifiedAt: string }) => {
      localStorage.setItem('rum1n8-app-settings', JSON.stringify({
        appSettings,
        appSettingsLastModified: modifiedAt,
      }))
    },
    {
      appSettings: settings,
      modifiedAt: appSettingsLastModified,
    }
  )
}

export async function getStoredVerses(page: Page): Promise<unknown[]> {
  return page.evaluate(() => {
    const raw = localStorage.getItem('rum1n8-verses')
    return raw ? JSON.parse(raw) : []
  })
}

/** WebDAV settings shape expected by the app */
export interface WebDAVSettings {
  url: string
  username: string
  password: string
  folder?: string
  useProxy?: boolean
  proxyUrl?: string
}

export async function seedWebDAVSettings(page: Page, settings: WebDAVSettings) {
  await page.evaluate((data: string) => {
    localStorage.setItem('rum1n8-webdav-settings', data)
  }, JSON.stringify(settings))
}
