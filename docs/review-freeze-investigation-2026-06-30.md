# Review freeze investigation - 2026-06-30

## Report

One user reported that the app can freeze after reviewing a verse from the Review page. The visible symptoms were:

- The keyboard disappears.
- The three mode buttons at the bottom disappear.
- The practice view appears to go full screen.
- Back/navigation no longer works.
- The user has to force kill the app.

Additional details from the user:

- It appears to happen on the first verse they review.
- It can happen after force killing and restarting the app, so it is not only a long-running background state issue.
- When the freeze happens, the verse is marked correct/reviewed even when the attempt does not meet the accuracy threshold.
- Failed attempts should still be recorded because the first failed attempt affects review frequency. Subsequent retries are practice and should not overwrite the first-attempt SRS result.

## Backup Data

The affected user's backup file was inspected locally:

- File: `/Users/tu/Downloads/rum1n8-backup-2026-06-24.json`
- 254 verses
- 20 collections
- 65 due reviews
- 113 mastered verses

The backup did not show obvious malformed verse data:

- No duplicate verse IDs were found.
- No invalid review dates were found.
- No empty verse content was found.
- No dangling collection references were found.
- The backup did not appear to require verse migration under the current migration checks.

Important: the backup includes sync configuration/credentials and should be treated as sensitive.

## Reproduction Attempts

The due reviews from the backup were replayed in Playwright with a mobile viewport. All 65 due reviews completed without reproducing the frozen UI.

Sync failure scenarios were also exercised by mocking/failing the configured sync provider. Those produced expected console sync errors, but the review UI still remained navigable in the automated runs.

The issue was not reproduced directly during the investigation.

## Likely Cause Investigated

The strongest suspicious path was startup sync timing.

`loadVerses()` was calling `saveVerses()` after reading stored verses. `saveVerses()` writes localStorage and triggers sync. Separately, `onMounted()` also performs the app's initial startup sync with `await triggerSync()`.

That meant a fresh launch could trigger sync during local data loading, then trigger startup sync again after the app finished setup. For this user's already-migrated backup, the first `saveVerses()` call was unnecessary because there was no migration to persist.

This matched several reported symptoms:

- It happens on the first review after launch.
- It can happen on a fresh launch after force killing.
- The user's backup has active sync settings.
- The problematic path runs before the first manual review action.

## Fix Direction

Keep SRS behavior unchanged:

- A failed first attempt still updates the SRS schedule.
- A retry after the failed first attempt does not overwrite that SRS result.
- Existing review tests should continue to assert this behavior.

The focused startup fix is:

- Track whether `loadVerses()` actually migrated any verse data.
- Only persist localStorage from `loadVerses()` when a migration happened.
- Persist migrations directly with `localStorage.setItem(...)` instead of `saveVerses()`, so migration persistence does not trigger sync.
- Keep the existing `onMounted()` startup `await triggerSync()` so remote changes from another device are still pulled when the app opens.

This avoids the duplicate/premature startup sync without disabling normal app-open sync.

## Non-Fixes Rejected

During investigation, two speculative changes were considered and then rejected:

- Changing failed-review SRS behavior so failed attempts would not update the schedule. This was wrong because failed first attempts intentionally affect review frequency.
- Blocking swipe/Next after a failed review completion. This changed review navigation behavior beyond the startup-sync issue and was removed from the intended fix.

## Follow-Up Risk

The app still does not appear to block review interaction while the initial startup sync is running. If a user opens the app and immediately starts reviewing before startup sync completes, they may briefly act on local data before remote changes are merged.

If cross-device freshness needs to be stricter, consider gating the Review start action until initial sync completes or times out.

## Follow-Up Finding - 2026-07-01

A related review navigation bug was reproduced:

- Start a Review session.
- Switch the active review practice mode from Master to Learn or Memorize.
- Swipe to the next verse.
- The review session could advance the header/reference while the practice view state was inconsistent with the selected mode, leaving the user unable to continue typing reliably.

Root cause: sequential review navigation reused `startReview()` without passing the active practice mode. `startReview()` always reset `memorizationMode` to `master`, even when the user had intentionally switched the current review session to Learn or Memorize. That made swipe navigation internally inconsistent because adjacent swipe panels were built from the current practice mode, but the target review was rebuilt as Master.

Fix direction implemented: fresh review starts still default to Master, but `nextVerse()` and `previousVerse()` preserve the active review mode when navigating within the same review source list. Regression coverage now checks that after swiping from Learn and Memorize, the header, verse content, active mode chip, focused input, and completion flow all remain live and in sync.
