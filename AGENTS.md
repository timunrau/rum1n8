# rum1n8 – Codex Notes

## Environment Setup

- Install dependencies with `npm install`.
- Local development runs with `npm run dev`.
- The Vite dev server binds to `127.0.0.1:5173` by default.
- To expose the dev server on the LAN, use `HOST=0.0.0.0 npm run dev`.

## Testing

- Always run both test suites after making code changes.
- Do not add or update tests for new features until the user explicitly confirms the feature behavior is good.
- Unit tests: `npm test`
- End-to-end tests: `npm run test:e2e`
- Playwright starts the app server automatically from `playwright.config.ts`; do not manually start a separate dev server unless intentionally reusing one.
- If Playwright reports that Chromium is missing, run `npx playwright install chromium`.
- In sandboxed environments, e2e may need permission to open a local listening port because Playwright launches the Vite server.

## Versioning

- The About modal version comes from `package.json` and is released automatically by semantic-release in CI.
- Do not manually increment `package.json` for normal work; version bumps are determined from Conventional Commits.
- Use Conventional Commit titles/messages for release-impacting changes: `feat:` for minor, `fix:`/`perf:` for patch, and `!` or `BREAKING CHANGE:` for major.
- When Codex creates commits for this repo, always use Conventional Commit messages so semantic-release can determine the next version from commits on `main`.
