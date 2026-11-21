import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { load } from 'js-yaml'

const contentDirectory = fileURLToPath(new URL('./content/', import.meta.url))
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/
const reservedRoots = new Set(['about', 'app', 'assets', 'health', 'home', 'icons', 'marketing'])

export function readMarkdownPage(file) {
  const source = readFileSync(file, 'utf8').replace(/^\uFEFF/, '')
  const frontMatter = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(source)
  if (!frontMatter) throw new Error(`${file}: expected YAML front matter between --- lines.`)

  const attributes = load(frontMatter[1], { filename: file, maxAliases: 0 })
  if (!attributes || typeof attributes !== 'object' || Array.isArray(attributes)) {
    throw new Error(`${file}: front matter must contain a mapping.`)
  }
  for (const field of ['slug', 'title', 'description', 'seoTitle']) {
    const value = attributes[field]
    if (value === undefined && !['slug', 'title', 'description'].includes(field)) continue
    if (typeof value !== 'string' || !value.trim()) {
      throw new Error(`${file}: "${field}" must be a non-empty string.`)
    }
  }

  const { slug, structuredData } = attributes
  if (!slugPattern.test(slug) || reservedRoots.has(slug.split('/')[0])) {
    throw new Error(`${file}: invalid or reserved slug "${slug}". Use lowercase words, hyphens, and optional path segments.`)
  }
  if (structuredData !== undefined && structuredData !== 'article') {
    throw new Error(`${file}: "structuredData" must be "article" when specified.`)
  }

  return {
    ...attributes,
    path: `/${slug}/`,
    body: source.slice(frontMatter[0].length),
    file,
  }
}

export function readMarkdownPages(directory = contentDirectory) {
  const files = readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => join(entry.parentPath, entry.name))
    .sort()
  const pages = new Map()
  for (const file of files) {
    const page = readMarkdownPage(file)
    if (pages.has(page.path)) {
      throw new Error(`${file}: duplicate slug "${page.slug}" also used by ${pages.get(page.path).file}.`)
    }
    pages.set(page.path, page)
  }
  return pages
}
