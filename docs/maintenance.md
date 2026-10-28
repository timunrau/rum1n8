# Maintenance policy

Keep rum1n8 stable, supported, and recoverable through small regular changes. Routine compatible updates are worthwhile without an observed app bug. Avoid both version chasing and indefinite deferrals that turn into emergency migrations.

This is the authoritative policy. [AGENTS.md](../AGENTS.md) summarizes it, [developer.md](developer.md#maintenance) lists commands, and [maintenance-status.md](maintenance-status.md) holds current decisions and deadlines. Dates use America/Winnipeg; day intervals are calendar days unless explicitly called business days.

## Ownership and cadence

The repository maintainer owns maintenance and approves exceptions. An agent doing maintenance must update the register, surface overdue work, and complete authorized fixes; it cannot approve its own risk acceptance. These are work deadlines, not configured reminders or scheduled agent runs.

| Activity | Deadline | Required outcome |
| --- | --- | --- |
| Routine maintenance | By the seventh day of each month | Review updates, audits, alerts, open PRs, support dates, and all due/overdue register entries; validate changes and record decisions |
| Full support review | During the January, April, July, and October monthly pass | Refresh the complete inventory, check upstream support/migration sources, and schedule upcoming migrations |
| Security response | On discovery, independent of bot schedule | Classify exposure, remediate or mitigate, and record evidence and deadlines |
| Post-release verification | After every maintenance release | Check CI, published artifacts, deployment health, and the affected user flows |

If a pass is missed, perform it before the next routine feature release. A missed date remains overdue; do not silently move it to the next month. Security remediation must not wait for a missed pass to be completed.

## Inventory and evidence

Maintain an inventory covering direct production dependencies, development/build/release tools, Node, all Docker base images, GitHub Actions, and Android tooling/dependencies (Bubblewrap, JDK, Gradle, Android Gradle Plugin, SDK/target API, and browser/TWA compatibility).

For each component or coherent toolchain group, record the installed version/line, proposed target, upstream support/release source, known support deadline, owner, next review, and migration target. Use official schedules, release notes, migration guides, and advisories. Mark unknown support dates as unknown; an audit without findings does not prove upstream support. Resolve unknown support status at the next quarterly review, or record a time-limited exception.

Check the compatibility chain, including peer dependencies, Node/JDK requirements, CI runner requirements, browser requirements, and transitive lockfile changes. Check release integrity/provenance and unexpected maintainer, registry, or install-script changes before accepting a dependency update.

## Upgrade decisions and deadlines

Support and security requirements override the normal waiting periods. Use stable supported releases; prereleases and experimental versions are excluded from routine maintenance. Prefer a compatible patch or minor when it resolves the requirement.

| Category | Assessment deadline | Default adoption target |
| --- | --- | --- |
| Compatible patches/minors | Next monthly pass, subject to bot cooldowns | Same pass after review and validation; record any blocker |
| Node LTS successor | Within 90 days of its actual LTS entry | Within 180 days of LTS entry, and at least 180 days before the current line's end of support, whichever is earlier |
| Core tooling major: Vite, Vitest, Playwright, Vue build plugins, semantic-release and its plugins | Within 90 days of stable release | Within 180 days of stable release, or earlier if current support/compatibility requires it |
| Application-library major, including Vue and Chart.js | Next quarterly review | Set a dated migration target or supported-line retention decision; reassess at least every 90 days |
| Other platform/toolchain major: Docker bases, Actions, Android/JDK/Gradle | Next quarterly review, or within 30 days of announcement of a support/compatibility deadline, whichever is earlier | Migrate at least 90 days before the earliest applicable support, CI compatibility, or distribution deadline; follow Node's larger buffer for Node images |

For core tooling, 180 days is the default migration target even if the old major still works. Remaining on it beyond that date requires an approved, expiring exception. For application libraries, staying on an actively maintained major is acceptable with evidence and a dated review; do not force a major simply because it exists. A newer release alone is not evidence that an older one is unsupported.

When upstream provides no support schedule, review security backports, maintainer statements, and release activity. Uncertainty requires investigation and a dated decision, not an invented end-of-life date. If a newly discovered deadline is already inside the buffer, treat migration as overdue and set an immediate plan.

Node migrations must update local development requirements, CI, every Node Docker image, and documentation together. Other toolchain migrations must cover their coupled components. Keep one migration or coherent compatibility group per change; avoid combining unrelated majors, feature work, or blanket lockfile refreshes. Recheck the latest stable patch within the selected line when implementing a previously planned migration.

## Security response

At each monthly pass, verify repository vulnerability alerts/security-update status and run root, production-only, and Android npm audits. Review Docker/OS, Actions, and Android/JDK advisories as well; npm audit does not cover them. Do not disable alerts or security updates to reduce version-update noise. If alerts are unavailable or disabled, record the coverage gap and owner; manual checks remain required.

Record first discovery, advisory identifiers, affected versions/paths, severity, exposure, remediation, and due dates. Include build, CI, and release credentials in the exposure assessment; development-only does not mean harmless. Track advisories, not just propagated package counts. Compare before/after findings and preserve unresolved items.

| Finding | Triage from discovery | Remediation or effective mitigation from discovery |
| --- | --- | --- |
| Known exploitation affecting our use, or exposed critical | Same day | Within 72 hours; restrict/disable the affected surface immediately if necessary |
| Other critical / high | Within 1 / 3 business days respectively | Within 7 / 14 days respectively if applicable |
| Moderate | Within 30 days | Within 60 days if applicable |
| Low | Within 30 days | Within 90 days if applicable |

Triage must determine whether the affected functionality is reachable and under what conditions. Until assessed, severity sets priority; do not assume a finding is inapplicable. Keep the original discovery date when an advisory is rediscovered or dependencies are regrouped. Existing untriaged findings need a triage date immediately; missing historical dates do not reset their urgency.

An inapplicable finding needs documented evidence and reassessment when usage or the advisory changes, and at least quarterly. When no fix exists, apply a mitigation and track the upstream fix; the deadline does not vanish. A temporary mitigation needs a follow-up fix date. Any accepted residual risk or missed remediation deadline needs explicit maintainer approval and an expiry no more than 30 days away.

Prefer compatible fixes, targeted parent-dependency upgrades, or removal/replacement of an affected component. A necessary major security upgrade bypasses routine cooldowns. Avoid `npm audit fix --force`, blanket overrides, and broad refreshes. A necessary override requires compatibility evidence, an upstream tracking link, removal criteria, and an expiry.

## Dependabot and PR handling

Keep monthly version checks at 09:00 America/Winnipeg, separate production/development npm groups, small PR limits, and existing cooldowns. Exclude routine major-version proposals; manual support review covers the gap this creates. Security updates are independent of routine version-update cadence and cooldown decisions.

For each PR, inspect the actual diff, release/migration notes, transitive changes, advisory impact, and checks against the intended merge base. Merge eligible batches after validation. Split a mixed or oversized batch when review or failures cannot be isolated confidently. Do not create new branches/PRs for routine local work unless requested; retain the repository's main-based workflow.

Before closing or deferring a major PR, update the register with its disposition, evidence, next action, and review/adoption dates. Closing is queue cleanup, not completion of the upgrade assessment. Repeated proposals should prompt a configuration check rather than repeated ad hoc ignore commands. Never suppress security findings through routine major-version ignore rules.

## Validation and release gates

Use a clean dependency install from the reviewed lockfile and record the tested commit/base. When the base or dependencies change, rerun the checks affected by that change. Do not add feature-behavior tests without the confirmation required by AGENTS.md.

| Change | Required validation before merge/push |
| --- | --- |
| Any executable dependency or code change | `npm ci`, unit tests, browser suite, production app/site build and web/TWA metadata checks; review audit delta |
| Vite, Vue, PWA/service-worker/cache dependencies, Node, or Docker changes affecting the web app | Above, plus `test:pwa-upgrade` against the documented supported upgrade scenarios |
| Docker/runtime/proxy change | Build each affected image; smoke-test health, app/marketing routing, and relevant sync behavior |
| Android wrapper/toolchain change | Wrapper install/validation, web/TWA metadata checks, Android build and lint; device/emulator launch verification for runtime/launch changes |
| CI/release workflow change | Validate syntax and exercise the affected workflow; verify permissions and required checks remain enforced |
| Documentation-only policy change | Inspect diff, links, date calculations, and consistency; no application tests required unless committing/pushing under AGENTS.md |

Run browser checks with the sandbox permissions required by AGENTS.md. Ensure test servers belong to the reviewed checkout; use isolated ports when existing servers could be reused. Provide the production URL environment for builds. Regenerate marketing assets when required by the repository workflow.

A missing tool, stopped Docker daemon, or unavailable service makes a required check blocked, never passed. Run unaffected checks, record what is missing, and either restore the prerequisite or obtain an explicit maintainer exception before merging/pushing. Existing green CI can satisfy a check only when it exercises the reviewed change and required scenario. Never disable a gate to get a merge through.

After release, verify semantic-release/version artifacts and the deployment, then smoke-test the changed surface. For browser/runtime/build migrations, include offline reload/update and data preservation. Keep the previous working immutable image/commit reference for rollback. If a regression affects data, launch, or core sync, stop further rollout and restore the previous working deployment where safe; retain backups and verify format compatibility before rolling back migrations. Record recovery and follow-up work.

## Decisions, exceptions, and completion

Each pending upgrade, finding, or deferral in the register must have:

- Component, current version/line, target, and linked PR/advisory/support evidence.
- Decision and concrete reason: adopt, investigate, retain supported line, mitigate, or defer for a named blocker.
- Named owner (the repository maintainer by default), next action, next review date, and adoption/remediation deadline.
- For an exception: explicit maintainer approval, residual risk, expiry, and unblock criteria. Agents must mark unapproved exceptions as pending approval.
- For completed work: tested commit, validation results/limitations, release/deployment evidence, and rollback reference where applicable.

Ordinary upgrade deferrals may last at most 90 days; security/validation exceptions at most 30 days. Neither automatically extends upstream support or distribution deadlines. Exceptions approaching those boundaries must explicitly address replacement, removal, or isolation rather than simply waiting. Renewals require fresh evidence and maintainer approval before expiry. A second consecutive deferral must include a concrete migration/replacement plan and committed target date.

Check deadlines at the start of every maintenance pass and before a release that touches the component. Overdue entries block routine changes to that component until addressed or explicitly excepted; emergency fixes may proceed. Never mark a migration complete merely because its PR was closed, tests passed, or a release was queued. Track implementation, release, and post-release verification separately.
