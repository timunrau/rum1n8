# Maintenance review — October 16, 2026

Apply the maintenance policy in [AGENTS.md](../AGENTS.md#maintenance-philosophy): stay stable and reasonably current through small regular updates, avoiding both version chasing and large catch-up migrations.

## PR decisions

- [PR #128](https://github.com/timunrau/rum1n8/pull/128): close the Node 24 to 26 Docker upgrade. Node 24 remains supported LTS; Node 26 is still Current as of this review. The PR also leaves CI on 24. Revisit a coordinated migration based on support and compatibility needs rather than the availability of a new major. See the [Node release schedule](https://nodejs.org/en/about/previous-releases).
- [PR #172](https://github.com/timunrau/rum1n8/pull/172): accept the stable patch/minor maintenance batch after review and validation. It updates Express, WebDAV, Playwright, the semantic-release GitHub/npm plugins, the Vue Vite plugin, concurrently, and Vite. It contains no direct prerelease or major upgrades, keeps existing major lines, and includes security and bug fixes. Regular compatible batches avoid a future large migration.

The npm batch also fixes vulnerable transitive versions: [proxy-addr](https://github.com/advisories/GHSA-jqcg-44mw-7w3h), [qs](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g), [shell-quote](https://github.com/advisories/GHSA-pqg4-j6r4-53mv), [source-map-js](https://github.com/advisories/GHSA-68fv-2mgg-jv7q), and body-parser. concurrently pins shell-quote exactly, so its patch update is needed for the shell-quote fix.

## Dependabot cadence

Check all configured ecosystems monthly at 09:00 America/Winnipeg. Keep production and development npm batches separate, and retain cooldowns. Exclude routine major-version proposals and review those migrations explicitly. Keep security triage separate from the monthly routine-update cadence, including any security fix requiring a major upgrade.

## Remaining audit findings

`npm audit --package-lock-only --json` reports 30 → 24 affected packages compared with the committed baseline (critical: 5 → 2; high: 20 → 19). Counts include dependency propagation and are not a count of distinct vulnerabilities. This maintenance batch does not produce a clean audit.

The production-only lockfile audit still reports brace-expansion, braces, micromatch, and http-proxy-middleware (four high findings). The proxy does not configure a glob path filter; the matching-library findings require further review if untrusted patterns are introduced. Presence in the dependency tree alone does not establish a remotely reachable exploit.

Remaining development/release findings include Handlebars and tar (critical), plus brace expansion, Browserslist, fast-uri, js-yaml, pacote, HTTP cache semantics, IP address parsing, and undici. Their dependency paths run through semantic-release or PWA build tooling. Address these in a focused security maintenance pass with exposure review and compatible fixes. Do not disable checks or use a forced blanket upgrade to hide the findings.

Dependabot alerts are currently disabled for the repository, so this review uses npm audit directly. Monthly version-update checks do not replace security triage.

## Validation

Validated the complete npm PR in a clean archive without the existing local application changes: `npm ci`, all 283 unit tests, all 253 browser tests, and the production build including web/TWA metadata checks pass. The updated Dependabot YAML parses successfully. Marketing assets are regenerated before the maintenance-policy commit, as required by the repository workflow.
