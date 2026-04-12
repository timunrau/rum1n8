# 03 First-Run and Empty State

## Title
Introduce a lightweight first-run experience that explains the app, the memorization flow, and the next action without becoming a blocking tutorial.

## Summary
- Add local-only onboarding state for first-run messaging.
- Replace the current generic empty-library experience with a more explanatory checklist card.
- Add a once-only practice helper that explains `Learn`, `Memorize`, and `Master`.

## Current State
- `src/App.vue` currently shows a simple empty-library card with `No verses yet` and `Tap + to add your first verse`.
- There is no dedicated onboarding helper, first-run state, or way to reopen a getting-started explanation later.
- `src/components/VersePracticeView.vue` exposes the `Learn`, `Memorize`, and `Master` modes, but nothing in the practice UI explains those labels the first time a user sees them.
- `src/app-settings.js` is synced through backup and remote sync, so it is not the right place for device-local onboarding state.

## Implementation Changes
- Introduce a new local-only helper module for UI state, separate from synced app settings:
  - storage key: `rum1n8-ui-state`
  - state shape owned by this plan:
    - `onboardingDismissed: false`
    - `practiceModesHintSeen: false`
  - preserve compatibility with future fields added by later plans, especially install-prompt snoozing from `04-pwa-polish.md`
- Show a dismissible onboarding card on the top-level collections view only when all of the following are true:
  - no verses exist
  - no user collections exist
  - `onboardingDismissed` is false
- Use the onboarding card instead of the current generic empty-state card while it is visible.
- Card content should stay lightweight and action-oriented:
  - one sentence that says rum1n8 is a Bible memory app
  - three checklist items:
    - add a verse
    - move through `Learn`, `Memorize`, and `Master`
    - install, back up, or sync once the user starts building a library
  - primary CTA: `Add Your First Verse`
  - secondary action: `Dismiss`
- When the user dismisses the onboarding card, keep a smaller fallback empty-state card with clearer copy than today:
  - keep the add-first-verse CTA
  - include one short clarifying sentence about Bible verse memory
- Add a once-only practice helper inside the practice flow:
  - show it the first time a user enters memorization or review while `practiceModesHintSeen` is false
  - place it near the mode buttons, not in a full-screen modal
  - helper copy should explain:
    - `Learn` shows the words
    - `Memorize` hides more help
    - `Master` prepares the verse for spaced review
  - mark `practiceModesHintSeen` true when the user dismisses the helper, switches modes, or completes a practice session
- Add a reusable `Getting Started` entry inside the existing non-practice settings/about surface:
  - open the same onboarding content in a `ModalSheet`
  - make it accessible even after the user already has verses
- Keep onboarding state local-only:
  - do not sync it
  - do not store it in `appSettings`
  - do not include it in backup/export files

## Acceptance Checks
- On a fresh browser with empty storage, the first visible collections view shows the onboarding card instead of the current generic empty-state card.
- Tapping `Add Your First Verse` opens the existing add-verse flow.
- Dismissing onboarding hides it on reload for that device only.
- Importing a backup or syncing existing data does not restore or override onboarding dismissal state.
- The first practice session shows the mode helper once, then stops appearing after dismissal or first meaningful interaction.
- The user can reopen the getting-started content later from the existing settings/about surface.

## Deferred Tests
- Do not add or update tests for this plan until the onboarding copy and interaction model are confirmed good.
- After approval, add Playwright coverage for:
  - fresh-storage onboarding visibility
  - onboarding dismissal persistence
  - add-first-verse CTA opening the verse form
  - practice helper showing once
- If a dedicated UI-state helper module is added, add a small normalization test after the behavior is locked.

## Assumptions
- The onboarding experience should not be a blocking wizard.
- Sample content is out of scope for this plan; users should start with their own verses.
- The local UI-state helper introduced here will be extended by `04-pwa-polish.md` rather than replaced.
