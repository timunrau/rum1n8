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

## Review scheduling

Settings → Practice & review controls review order and the maximum interval (1–365 days, initially 90). New installs start in Rotation; existing libraries and older settings/backups retain Classic unless the user chooses otherwise. Both orders use the same SM-2-inspired scheduler.

- Classic sorts by next review date. Rotation puts due verses first, then sorts remaining verses by least recent practice. Collections keep their displayed order, and practice sessions capture their sequence so reviews cannot reorder the next verse.
- New and reset verses start with ease 1.5. The first counted review schedules one day; there is no early review ladder. Grades are 5 for perfect accuracy, 4.5 for 95–<100%, 4 for 90–<95%, 3 for 70–<90%, 2 for 50–<70%, 1 for 30–<50%, and 0 below 30%. Fuzzy typing and first-attempt grading remain authoritative.
- Apply the SM-2 ease formula with a 1.3 floor. Positive changes are multiplied by the elapsed fraction of the current applied whole-day interval, capped at one. Negative changes apply fully, with no additional percentage penalty. Calendar-day gaps and the denominator have a one-day minimum; missing or invalid history uses a one-day gap.
- Successful intervals grow by ease, limited by the actual elapsed gap, and never lose already-earned spacing. Once the whole-day earned gap is met, retain fractional progress so rounding cannot stall growth. Weak reviews use the current applied interval: grade 3 halves it, grade 2 uses one-third, grade 1 one-sixth, and grade 0 one day, with a one-day minimum. All counted reviews schedule from today.
- Each mastered verse keeps `reviewSchedule` metadata alongside `interval` and `nextReviewDate`. Maximum changes reproject from the anchor and earned interval, remaining reversible until a review or manual override changes the baseline. Earned spacing cannot exceed 365 days.
- `srsVersion: 2` records the transition on the next counted review, not on load or same-day practice. Unversioned verses with review count 0–4, earned interval 0–4, and no custom schedule have ease lowered to at most 1.5 once. Established and custom schedules retain their ease. New and reset verses are already versioned. Preserve the marker with the winning review record through sync, full backups, restore, and undo; older clients retain their previous scheduling behavior until updated.
- Same-day repeats do not change ease, spacing, daily review count, or transition status. History and last-practiced tracking still update. Review now only makes a verse due; a same-day completion clears that request and schedules the existing interval from today without grading again. Positive manual overrides replace the interval and earned baseline without resetting ease or history. Reset progress clears progress and uses ease 1.5.
- Manual scheduling, reset, and scheduling undo record `reviewScheduleModifiedAt`. Sync compares these actions with real review dates; unrelated edits cannot make old progress win. Preserve schedule metadata and the version marker in all completion, import, sync, reset, and undo paths.

## Verse statistics

Settings → Stats for nerds enables read-only verse statistics, defaults off, and syncs with the other app preferences. Tap and hold a Review-list verse (or use its context menu) to open stats; the practice header info button opens the same sheet in Learn, Memorize, and Master. Combined-passage sessions omit the button. Stats also appear below the verse edit fields.

The accuracy chart starts at the mastery date when available and uses recorded review accuracy only. Times reviewed counts saved history entries, including same-day practice; it is distinct from the scheduler's once-per-day review count. Ease, earned spacing, and scheduled intervals show the current saved state. Opening or dismissing the sheet must preserve practice progress and never record a review.

## Sync validation

Sync remains download → merge → upload, with one queued follow-up when saves occur during an active sync. Before applying a successful response, merge it against the current library and settings so changes made during the upload survive. Use the same conflict rules for this merge and cross-device merges; do not add a separate rule that restores only the currently open verse.

The sync unit tests cover both conflict directions, review/schedule/reset/undo precedence, clock skew, legacy records, collection repair, deletions, settings and maximum projection, repeated convergence, provider selection, token refresh, transport payloads, failures, and retry. The browser sync tests gate downloads and uploads to exercise real saves during those requests, and verify local storage and subsequent server payloads. They also cover a new account, offline review/reconnect, manual retry, and reset undo after sync. Network services and credentials are synthetic; these tests do not exercise Google's live sign-in popup or a real WebDAV account.

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
