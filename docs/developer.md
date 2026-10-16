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

Keep the app stable and reasonably current through regular, manageable updates. Avoid both unnecessary version chasing and letting dependencies drift until a large, risky catch-up upgrade is required.

- Accept stable, compatible patch/minor updates in manageable batches after reviewing release notes, transitive changes, and CI. Routine maintenance does not need to fix an observed app bug to be worthwhile.
- Avoid prerelease, experimental, or unsupported versions. Review major migrations separately for compatibility, support, and maintenance benefits; do not upgrade just because a newer major exists.
- Keep Node on a supported LTS line. Coordinate development, CI, and all Docker images when a major migration is needed.
- Dependabot checks npm, GitHub Actions, Docker, and Android dependencies monthly at 09:00 America/Winnipeg. Production and development npm updates are grouped separately. Routine major-version PRs are disabled; plan those migrations explicitly.
- Keep security triage separate from routine version-update cadence. Review critical/high findings promptly against actual usage and exposure; moderate/low findings can normally wait for the monthly pass.
- Avoid `npm audit fix --force` and unreviewed blanket refreshes. Prefer compatible fixes and document remaining findings instead of claiming a clean audit.

The [October 16, 2026 review](maintenance-2026-10-16.md) records the PR decisions and remaining audit findings.

At each monthly pass, also review runtime and toolchain support timelines and plan upcoming major migrations early enough to avoid an end-of-support scramble.

Monthly maintenance pass:

```bash
git pull --ff-only
npm outdated
npm audit
npm test
npm run build
npm run test:e2e
npm run test:pwa-upgrade
```

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
