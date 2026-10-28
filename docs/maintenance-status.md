# Maintenance register

Last updated: 2026-10-27 (America/Winnipeg). Owner for all entries below: repository maintainer. This is the live task list; historical reviews retain their original findings and decisions.

## Scheduled work

| Item | Current decision and evidence | Next action / review | Adoption target or deadline |
| --- | --- | --- | --- |
| First complete support inventory | Pending; the new policy covers more than the two closed major PRs | By 2026-11-07, inventory all categories in [the policy](maintenance.md#inventory-and-evidence), verify support sources, and assign dates | Monthly pass due 2026-11-07; next quarterly full refresh due 2027-01-07 |
| Node 24 → 26 | Retain Node 24 for now; [PR #173](https://github.com/timunrau/rum1n8/pull/173) closed because it changed Docker alone. [Official schedule](https://github.com/nodejs/Release/blob/main/schedule.json) lists Node 26 LTS entry as 2026-10-28 and Node 24 end of support as 2028-04-30 | Confirm actual LTS entry and ecosystem compatibility by 2026-11-07; finish assessment by 2027-01-26 if LTS enters as scheduled. Plan local, CI, and all Docker changes together | Default adoption 2027-04-26 (180 days after scheduled LTS entry); Node 24 support buffer ends 2027-11-02. Recalculate if actual upstream dates change |
| Vitest 4 → 5 | Plan a migration assessment; [PR #175](https://github.com/timunrau/rum1n8/pull/175) closed without adopting the major. [Vitest 5.0.0](https://github.com/vitest-dev/vitest/releases/tag/v5.0.0) published 2026-09-03; [migration guide](https://vitest.dev/guide/migration/) changes mock defaults and other behavior. Vitest 4 support deadline is unknown | Verify support/security backports and inspect our usage by 2026-11-07; finish major assessment by 2026-12-02 (90 days). Check compatible 4.x security fixes independently | Default major adoption by 2027-03-02 (180 days). Any applicable security/support requirement can bring this forward |
| Existing audit backlog | 2026-10-27 root lockfile audit: 23 affected packages, including 2 critical and 10 high; unchanged by [PR #177](https://github.com/timunrau/rum1n8/pull/177). Counts include propagation and do not establish exposure. Earlier findings appear in the [October 16 review](maintenance-2026-10-16.md#remaining-audit-findings) | Recover original discovery dates; triage remaining critical findings by 2026-10-28 and high findings by 2026-10-30. Record advisory-level exposure, fix/mitigation dates, and any existing overdue work; verify repository alert/security-update status | Unresolved, not accepted risk. Apply security deadlines using original discovery dates; prioritize overdue applicable findings immediately |

These are planned assessments and default targets, not approved exceptions. No maintainer risk exceptions are recorded. Node schedule dates and Vitest release dates were checked against the linked upstream sources on 2026-10-27; reconfirm them during implementation.

## Recent implementation awaiting release verification

- [PR #177](https://github.com/timunrau/rum1n8/pull/177): merged as `1798d55cec4e451e066ef48fec8aa4cc50b7649f`; stable fetch-client, Chart.js, Vue, Playwright, and Vite updates. Validation: 208 unit tests, production app/site build and web/TWA checks, green PR CI, and 230 browser tests across an isolated run and corrected URL-configuration rerun. The Docker PWA upgrade check was unavailable. This merge predates the new mandatory PWA gate; it does not establish a precedent for skipping that gate. Next action by 2026-11-07: run the PWA upgrade check and verify release/deployment health, offline behavior, and data preservation. Release/deployment and rollback artifact references remain to be recorded; do not describe the release as verified yet.

## Entry format

For each new item, record component/current version/target, evidence, decision/reason, owner, next action, next review, adoption/remediation deadline, and any blocker. For exceptions, add approval, residual risk, expiry, and unblock criteria. On completion, record the tested commit, checks, release/deployment verification, and rollback reference, then move the entry to a dated historical review. Preserve discovery dates and overdue history.
