# Developer Notes

Minimal repo-working notes for agents and contributors.

## Core commands

```bash
npm install
npm run dev
```

The launcher starts the app, marketing site, and WebDAV proxy:

```text
App:       http://127.0.0.1:5173/app/
Marketing: http://127.0.0.1:5174/
WebDAV:    http://127.0.0.1:3001/health
```

The individual processes remain available as `npm run dev:app`, `npm run dev:site`, and `npm run dev:proxy`. To expose the frontend servers on your LAN:

```bash
HOST=0.0.0.0 npm run dev
```

The marketing site's HTML, JavaScript, and CSS live in `site/`. Vite keeps the public routes at `/`, `/privacy/`, and the other page paths when it builds `dist-site/`. Shared screenshots remain in `public/marketing/` because the app also uses some of them. Regenerate them with `node scripts/generate-marketing-assets.mjs` when the app UI changes.

## Tests

- Run both test suites after code changes: `npm test` and `npm run test:e2e`
- Playwright starts the app server from `playwright.config.ts`; do not manually start another dev server unless you are intentionally reusing one
- If Chromium is missing, run `npx playwright install chromium`
- In sandboxed environments, e2e may need permission to open a local listening port
- To exercise already-running production containers, set `PLAYWRIGHT_SKIP_WEBSERVER=1`, `PLAYWRIGHT_BASE_URL`, `PLAYWRIGHT_APP_URL`, and `PLAYWRIGHT_MARKETING_URL`; for a local self-signed TLS proxy, also set `PLAYWRIGHT_IGNORE_HTTPS_ERRORS=1`

## Maintenance

Follow the [maintenance policy](maintenance.md) for cadence, support deadlines, security response, upgrade decisions, validation, and exceptions. Update the [maintenance register](maintenance-status.md) during each pass; its dates make deferred work actionable. The [October 16, 2026 review](maintenance-2026-10-16.md) is historical evidence, not the current task list.

Run dependency checks for both the root package and Android wrapper. Review the findings before changing versions; nonzero `outdated` or audit results need interpretation, not a forced upgrade.

```bash
git pull --ff-only
npm outdated
npm outdated --prefix android-twa
npm audit
npm audit --omit=dev
npm audit --prefix android-twa
npm test
npm run build
npm run test:e2e
npm run test:pwa-upgrade
```

Production builds need the documented public URL environment from [hosting.md](hosting.md). The PWA upgrade check requires Docker. Apply the policy's validation matrix to decide which additional Docker or Android checks are required; an unavailable required check remains blocked.

## Retired voice input

Built-in voice input has been removed; Read Aloud still uses browser speech synthesis. Keep the small voice-model cleanup in `src/migrate-storage.js` permanently so dormant installs can skip releases and still remove their downloads. It silently deletes only `ruminate-voice-model-*` caches on startup and foreground, retries failures later, and preserves Bible caches and app data. Settings normalization also ignores the retired `voicePracticeEnabled` key from older clients and backups without changing settings timestamps. Cleanup begins once the updated app runs; offline installs still running an older release keep their download until they update.

`npm run test:pwa-upgrade` seeds small legacy model caches and checks their removal, unrelated cache/settings preservation, and offline reload. Its default old image also exercises the earlier marketing-cache migration. To test a pre-removal image that already has separate app/site builds, set `OLD_APP_IMAGE` to its immutable image SHA, `OLD_APP_PLATFORM` to its platform, and `EXPECT_OLD_MARKETING_CACHE=0`; retain the default scenario as a separate check.

## WebDAV development

Use the local proxy when working on WebDAV sync:

```bash
NEXTCLOUD_URL=https://your-nextcloud.com/remote.php/webdav npm run dev:proxy
```

Or run the app and proxy together:

```bash
NEXTCLOUD_URL=https://your-nextcloud.com/remote.php/webdav npm run dev:all
```

The app development server forwards `/api/webdav` to the local proxy automatically.

## Android Trusted Web Activity

The hosted Android wrapper lives in `android-twa/`. See [Android TWA development](android-twa.md) for setup, regeneration, signing, and device-test commands. `npm run build` verifies that the web manifest and generated Android launch metadata still point directly to `/app/`.

## Releases

- The About modal version comes from `package.json`
- Do not manually bump `package.json` for normal work
- semantic-release handles releases from commits on `main`
- Use Conventional Commits: `feat:` for minor; `fix:`, `perf:`, `refactor:`, `build:`, or `chore(deps):` for patch; and `!` or `BREAKING CHANGE:` for major
- Documentation, tests, CI-only changes, and chores outside the `deps` scope do not publish a release

## Related docs

- [User overview](../README.md)
- [Hosting notes](hosting.md)
- [Android TWA development](android-twa.md)
- [Android TWA implementation plan](android-twa-plan.md)
- [Standalone Android implementation plan](android-standalone-plan.md)
