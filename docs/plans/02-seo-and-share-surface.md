# 02 SEO and Share Surface

## Title
Add search and link-sharing metadata for the existing app-first root without introducing a separate marketing site.

## Summary
- Keep the app at `/`.
- Add modern share and search metadata so the root page previews well in links and is understandable to search engines.
- Generate crawl assets in a way that works for the official hosted deployment while avoiding incorrect canonical URLs in self-hosted copies.

## Current State
- `index.html` currently has a basic title, theme color, and one meta description.
- There are no Open Graph tags, Twitter tags, canonical tags, JSON-LD blocks, `robots.txt`, or `sitemap.xml`.
- `vite.config.js` already owns manifest configuration, so it is the most natural build-time place to own site metadata too.
- `public/` currently contains icons and static HTML pages, but no social preview image or app screenshots.

## Implementation Changes
- Keep SEO metadata generation in the existing Vite build pipeline instead of adding a router or a second site.
- Add a single build-time site metadata source in `vite.config.js` that defines:
  - product name
  - descriptor
  - default description
  - social preview image path
  - screenshot paths
  - optional `VITE_SITE_URL`
- Inject the following into `index.html` during the Vite build:
  - updated `<title>`
  - updated meta description
  - Open Graph tags: `og:title`, `og:description`, `og:type`, `og:image`
  - Twitter tags: `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`
  - a small `<noscript>` product description inside the body
  - one JSON-LD `SoftwareApplication` block
- Only include absolute-URL fields when `VITE_SITE_URL` is configured:
  - canonical link
  - `og:url`
  - JSON-LD `url`
  - JSON-LD `image`
- Generate crawl assets at build time:
  - always emit `robots.txt`
  - emit `sitemap.xml` only when `VITE_SITE_URL` is configured
  - include a `Sitemap:` line in `robots.txt` only when `VITE_SITE_URL` is configured
- Asset requirements for this plan:
  - one social preview PNG at `1200x630`
  - three portrait app screenshots at a consistent phone aspect ratio, ideally `1080x1920` or equivalent
  - screenshot set should cover: empty library, practice screen, and review list
  - screenshots should have placeholder content based on Joshua 1:8. There should maybe be some other verses as well. Psalm 119:11, John 3:16.
  - screenshots should be based on a mobile view, not desktop view.
- Name the new marketing assets predictably so later plans can reuse them:
  - `public/marketing/og-card.png`
  - `public/marketing/screenshot-empty.png`
  - `public/marketing/screenshot-practice.png`
  - `public/marketing/screenshot-review.png`
- Keep the root document indexable. Do not add `noindex`.
- Do not create a second entrypoint or move the app to `/app`.

## Acceptance Checks
- View source on the built root page shows the full title, description, Open Graph tags, Twitter tags, and JSON-LD.
- When `VITE_SITE_URL` is unset, the build does not emit broken canonical URLs or a broken sitemap.
- When `VITE_SITE_URL` is set, the build emits a correct canonical tag, `og:url`, and `sitemap.xml`.
- A pasted link to the deployed root page renders a real social preview image instead of a generic favicon preview.
- The screenshots produced here are good enough to reuse in the PWA manifest work from `04-pwa-polish.md`.

## Deferred Tests
- Do not add or update tests for this plan until the metadata output and assets are approved.
- After approval, add a Playwright or static-build assertion that checks the built HTML head for the expected title and share tags.
- If a build helper is introduced for sitemap generation, add a small unit-style check around its output after the behavior is finalized.

## Assumptions
- The app remains a client-rendered Vue app at `/`; this plan only improves discovery and unfurling.
- `VITE_SITE_URL` is intended for the official deployment or any self-hosted deployment that wants correct canonical URLs.
- If a deployment omits `VITE_SITE_URL`, it should still get valid generic metadata without absolute URLs.

