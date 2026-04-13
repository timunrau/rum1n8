import type { Page } from '@playwright/test'

export const APP_ROOT_PATH = '/app/'

export function appPath(path = '') {
  if (!path) return APP_ROOT_PATH

  if (path.startsWith('?') || path.startsWith('#')) {
    return `${APP_ROOT_PATH}${path}`
  }

  if (path.startsWith('/')) {
    return `${APP_ROOT_PATH}${path.slice(1)}`
  }

  return `${APP_ROOT_PATH}${path}`
}

export async function gotoApp(page: Page, path = '') {
  await page.goto(appPath(path))
}
