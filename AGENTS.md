# rum1n8 – Codex Notes

## Environment Setup

- Install dependencies with `npm install`.
- Local development runs with `npm run dev`.
- The Vite dev server binds to `127.0.0.1:5173` by default.
- To expose the dev server on the LAN, use `HOST=0.0.0.0 npm run dev`.

## Testing

- Run tests when necessary based on the risk and scope of the change. Before committing or pushing, run both test suites unless the user explicitly says not to.
- Do not add or update tests for new features until the user explicitly confirms the feature behavior is good.
- Unit tests: `npm test`
- End-to-end tests: `npm run test:e2e`
- Playwright starts the app server automatically from `playwright.config.ts`; do not manually start a separate dev server unless intentionally reusing one.
- If Playwright reports that Chromium is missing, run `npx playwright install chromium`.
- In sandboxed environments, e2e may need permission to open a local listening port because Playwright launches the Vite server.

## Versioning

- Before starting new work in this repo, run `git pull --ff-only` so local `main` includes any CI/semantic-release commits that landed after the last push.
- The About modal version comes from `package.json` and is released automatically by semantic-release in CI.
- Do not manually increment `package.json` for normal work; version bumps are determined from Conventional Commits.
- When Codex creates commits for this repo, including from the built-in commit/push UI, always use a valid Conventional Commit subject so semantic-release can determine the next version from commits on `main`.
- Use `fix:` for bug fixes, `perf:` for performance improvements, `feat:` for user-facing features, `docs:` for documentation-only changes, `test:` for test-only changes, `refactor:` for behavior-preserving code changes, `chore:` for tooling/maintenance, and `build:` or `ci:` for build or workflow changes.
- For release-impacting commits, use `feat:` for minor releases; `fix:`, `perf:`, `refactor:`, `build:`, or `chore(deps):` for patch releases; and `!` or a `BREAKING CHANGE:` footer for major releases. Documentation, tests, CI-only changes, and other chores do not release.
- Keep the subject concise and imperative, for example `fix: avoid duplicate startup sync`, `docs: record review freeze investigation`, or `test: cover failed review scheduling`.
- Do not use vague subjects such as `update files`, `misc changes`, `fix stuff`, or `codex changes`.
- After pushing a release-impacting commit, expect CI/semantic-release to add a new release commit on `main` shortly afterward. Before making another commit or push, pull/rebase onto the updated `origin/main` so your local branch includes the generated release commit.

## Further Docs

- [docs/developer.md](docs/developer.md) for the minimal repo workflow and command notes.
- [docs/hosting.md](docs/hosting.md) for the current Docker Compose deployment path.
