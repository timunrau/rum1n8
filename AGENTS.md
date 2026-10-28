# rum1n8 – Codex Notes

## Maintenance Philosophy

- Follow [docs/maintenance.md](docs/maintenance.md), the authoritative maintenance policy. Keep decisions, owners, evidence, and due dates in [docs/maintenance-status.md](docs/maintenance-status.md).
- Complete monthly maintenance by the seventh calendar day; review the full support inventory quarterly in January, April, July, and October. Security triage runs independently of this cadence.
- Accept stable, compatible patch/minor updates in manageable batches after release-note, transitive-dependency, and validation review. An observed app bug is not required. Avoid prerelease, experimental, or unsupported versions.
- Assess a new Node LTS within 90 days of LTS entry and target migration within 180 days; leave the current line at least 180 days before its end of support. Coordinate development, CI, and all Docker images.
- Assess stable core-tooling majors within 90 days of release and target adoption within 180 days. Review application-library majors quarterly. Support/security deadlines take precedence; do not upgrade blindly to meet a date.
- Every deferral needs a concrete blocker, owner, next action, and expiry. Agents may record recommendations but cannot approve risk exceptions. Expired exceptions require an explicit maintainer decision.
- Keep Dependabot low-noise: monthly version-update batches, separate production and development dependencies, and no routine major-version PRs. Closing a major PR must leave a dated decision in the maintenance register. Do not disable security maintenance.
- Required validation must pass before merge/push. Report unavailable checks as blocked; follow the policy's exception process rather than treating them as passes.

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
- In Codex's sandbox, always run `npm run test:e2e` with escalated permissions from the outset. The sandboxed run cannot launch Chrome reliably (`SIGABRT`/`EPERM`) and only wastes a full test attempt; escalation also permits Playwright's Vite server to open its local listening port.

## Marketing Screenshots

- Run `node scripts/generate-marketing-assets.mjs` only before committing, or when regenerated screenshots are needed to inspect a user-interface change. Include all regenerated screenshots from `public/marketing/` with the change.

## Android Release Signing

- The upload keystore path and alias are configured in `android-twa/twa-manifest.json`; the keystore itself remains outside the repository.
- On the maintainer's Mac, locate the project-specific signing entries by inspecting macOS Keychain generic-password item metadata. Retrieve the secrets directly into the Bubblewrap release-build environment without printing them, writing them to a file, or asking the user to paste them into chat.

## Git Workflow

- Do not create branches or pull requests for routine work in this repository unless the user explicitly requests one.
- Work directly on `main`. Before editing files, switch to `main` and run `git pull --ff-only`.
- When the user asks Codex to commit or push, commit directly to `main` and push to `origin/main`.

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
