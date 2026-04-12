# Developer Notes

Minimal repo-working notes for agents and contributors.

## Core commands

```bash
npm install
npm run dev
```

The Vite dev server binds to `127.0.0.1:5173` by default. To expose it on your LAN:

```bash
HOST=0.0.0.0 npm run dev
```

## Tests

- Run both test suites after code changes: `npm test` and `npm run test:e2e`
- Playwright starts the app server from `playwright.config.ts`; do not manually start another dev server unless you are intentionally reusing one
- If Chromium is missing, run `npx playwright install chromium`
- In sandboxed environments, e2e may need permission to open a local listening port

## WebDAV development

Use the local proxy when working on WebDAV sync:

```bash
NEXTCLOUD_URL=https://your-nextcloud.com/remote.php/webdav npm run dev:proxy
```

Or run the app and proxy together:

```bash
NEXTCLOUD_URL=https://your-nextcloud.com/remote.php/webdav npm run dev:all
```

When using the dev proxy, set the proxy URL in the app to `http://localhost:3001`.

## Releases

- The About modal version comes from `package.json`
- Do not manually bump `package.json` for normal work
- semantic-release handles releases from commits on `main`
- Use Conventional Commits: `feat:` for minor, `fix:` or `perf:` for patch, and `!` or `BREAKING CHANGE:` for major

## Related docs

- [User overview](../README.md)
- [Hosting notes](hosting.md)
