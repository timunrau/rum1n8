# PWA Polish

## Title
Upgrade the installable web app experience so it feels intentional, safe, and quiet on mobile while staying within a pure PWA scope.

## Summary
- Improve the manifest and install UX using the app as it exists now.
- Make install prompts actionable instead of always-visible.
- Encourage iOS users to install before they create local data, then avoid pressuring them once they already have verses saved in Safari.
- Add offline-aware behavior for sync and verse import.
- Keep the work limited to the web app. Do not add Android wrapper, native app, or Play Store release work here.

## Current State
- The app now lives at `/app/`, with marketing and about pages split out at `/` and `/about/`.
- `vite.config.js` already configures `vite-plugin-pwa` with:
  - `id: "/"`
  - `start_url: "/app/"`
  - `scope: "/"`
  - `display: "standalone"`
  - white launch colors
  - app icons
  - portrait screenshots from `public/marketing/`
- The manifest still needs final install polish such as categories, display overrides, and app shortcuts.
- `src/composables/usePWAInstall.js` currently captures `beforeinstallprompt`, shows a basic iOS install modal, and clears the deferred prompt on `appinstalled`.
- The PWA install composable does not yet expose install availability, native prompt outcome, browser-specific iOS guidance, or snooze state.
- `src/App.vue` currently shows a header `Install app` button whenever the app is not installed and the user is on the top-level collections screen, even if install prompting is not actually available.
- The hamburger menu does not currently include an install action.
- The first-run empty-library hero exists in `src/App.vue` and is backed by the local UI-state helper in `src/ui-state.js`.
- Backup and sync flows already exist:
  - Backup & Restore modal exports/imports verses, collections, and settings.
  - Sync settings support WebDAV and Google Drive.
  - A sync nudge already appears after usage milestones when sync is not configured and no backup timestamp exists.
- User data is local-first and stored in browser storage. On iOS, a Home Screen web app can behave like a separate installed context from Safari, so a user who installs after creating verses in Safari may open the installed app and see an empty local library. Treat this as a UX risk without making the app sound fragile.
- Network-dependent actions such as sync and verse import do not currently have a clear proactive offline-aware UX.

## UX Direction
- Do not use pop-up reminders for install.
- Remove the persistent header `Install app` button.
- Keep install as an optional convenience, not a blocker.
- Make the hamburger menu the stable home for user-initiated install whenever install is actionable and the app is not already installed.
- Use primary install reminders sparingly:
  - before an iOS user has created verses
  - for non-iOS users when the browser has a deferred install prompt
  - for iOS users with existing verses only when sync is configured or the latest local data has a current backup
- For iOS users with existing unsynced and unbacked-up verses, do not show a primary install banner. If they choose `Install app` from the hamburger menu, use a calm backup-first sheet.

## Implementation Changes
- Extend the existing local UI-state record in `src/ui-state.js` with:
  - `installPromptDismissedUntil: null`
  - `installFirstPromptDismissedUntil: null`
- Add helpers for install reminder state:
  - a 14-day snooze for dismissed primary install reminders
  - clearing install snoozes when `appinstalled` fires
  - a computed `hasCurrentBackup` that treats backup as current only when `lastBackupTimestamp` is newer than the latest local verse or collection `lastModified` value
- Improve manifest configuration in `vite.config.js`:
  - keep the current app path: `start_url: "/app/"`
  - keep `scope: "/"`
  - keep `short_name: "rum1n8"`
  - keep the current descriptive full name unless there is a product copy reason to change it
  - add categories: `education`, `lifestyle`, `productivity`
  - add `display_override: ["standalone", "minimal-ui", "browser"]`
  - keep the existing portrait screenshots in `public/marketing/`
  - add shortcuts that deep-link into existing query-param navigation:
    - `/app/?view=collections`
    - `/app/?view=review-list`
    - `/app/?view=stats`
- Align launch colors with the real shell:
  - keep white as the manifest `background_color`
  - keep the runtime dark-mode `theme-color` update for active browsing
- Replace the current header install button with intentional install surfaces:
  - remove `install-app-header`
  - add a hamburger menu row labeled `Install app` whenever install is actionable and the app is not installed
  - keep the hamburger install row available even when a primary install reminder is snoozed
  - only show install UI when one of these is true:
    - the browser has a deferred install prompt
    - the device is iOS and not already installed
  - do not show install UI when there is no viable install path
- For an empty iOS library, encourage install first inside the first-run flow:
  - keep the wording calm and short
  - show `Install app` and `Continue in browser`
  - `Install app` opens the iOS install guidance
  - `Continue in browser` snoozes the install-first prompt and continues directly into adding the first verse
  - do not show data-loss, migration, or backup language here because there is no local verse data yet
- For non-iOS users with an established library:
  - show a slim dismissible install banner on the top-level collections view when a deferred install prompt is available and the banner is not snoozed
  - include `Install app` and `Not now`
  - `Not now` sets `installPromptDismissedUntil` to now plus 14 days
  - if the native browser install prompt returns a dismissed outcome after the user taps `Install app`, treat it the same as `Not now`
- For iOS users with existing verses:
  - if sync is configured or `hasCurrentBackup` is true, allow a normal install entry point
  - if sync is not configured and the latest local data is not backed up, do not show a primary install banner
  - when the user opens `Install app` from the hamburger menu, show a calm sheet before the iOS install instructions:
    - title: `Install rum1n8`
    - body: `To make sure your verses are available after installing, save a backup first or turn on sync.`
    - actions: `Download backup`, `Set up sync`, `Continue`
  - after `Download backup` completes, change the primary action to `Continue to install steps`
  - `Continue` and `Continue to install steps` open the iOS install guidance
  - avoid wording that says verses will be lost
- Improve iOS install guidance:
  - if the user is in Safari on iOS, keep the add-to-home-screen steps
  - if the user is on iOS but not Safari, first explain that installation works best from Safari and that they can open the site there before adding it to the Home Screen
  - closing the iOS guidance after opening it from a primary reminder should snooze that primary reminder for 14 days
- Improve `usePWAInstall`:
  - expose whether install is currently actionable
  - expose iOS Safari vs iOS non-Safari detection
  - make `triggerInstall` return a clear result such as `accepted`, `dismissed`, `ios-guidance`, or `unavailable`
  - clear the deferred prompt after it is used
  - clear install snooze state on `appinstalled`
- Add online/offline awareness:
  - track `navigator.onLine` reactively
  - keep local browsing, manual verse entry, practice, and review available offline
  - disable or short-circuit network-dependent actions while offline:
    - verse text import
    - manual sync
    - automatic sync on startup
  - show clear helper text when those actions are unavailable offline
  - avoid noisy startup sync errors when the user opens the app offline just to review saved verses
- Keep the existing service-worker and offline caching approach unless a concrete problem appears during implementation.
- Explicitly out of scope:
  - native iOS app work
  - Bubblewrap
  - Trusted Web Activity packaging
  - Play Store release assets or submission flow

## Acceptance Checks
- The app still launches from `/app/`, and the PWA manifest does not point install users at the marketing home page.
- The installed app name remains compact on device, while the full manifest name clearly describes the product.
- The manifest contains categories, display overrides, screenshots, and shortcuts that point to the existing `/app/?view=...` routes.
- Install UI only appears when installation is genuinely actionable.
- The top app bar no longer has a persistent `Install app` button.
- The hamburger menu includes `Install app` whenever install is actionable and the app is not installed.
- Snoozing a primary install reminder hides only the primary reminder for 14 days; the hamburger menu install action remains available.
- Empty-library iOS users get a simple install-first option with `Install app` and `Continue in browser`, with no scary backup or data-loss wording.
- iOS users who already have local-only verses are not shown a primary install banner unless sync is configured or their latest local data has a current backup.
- The iOS hamburger install flow for local-only data calmly offers backup, sync, or continue before showing install steps.
- On iOS Safari, install guidance shows add-to-home-screen steps; on iOS non-Safari, guidance tells the user to use Safari if install is not available from their current browser.
- Choosing `Not now`, closing primary iOS guidance, or canceling the native browser install prompt snoozes the primary reminder for 14 days.
- Actual installation clears install snooze state.
- With the browser offline, existing verses remain usable while sync and verse import clearly indicate they are unavailable.
- Starting the app offline does not produce a noisy sync failure for a user who is just trying to review saved verses.

## Deferred Tests
- Do not add or update tests for this plan until the install and offline behavior are confirmed good.
- After approval, add Playwright coverage for:
  - install surface visibility rules
  - install snooze persistence
  - iOS empty-library install-first flow
  - iOS local-only backup-first flow
  - offline disabled state for import and sync
  - manifest or built-output assertions for shortcuts, categories, display overrides, and screenshots if practical

## Assumptions
- The existing marketing screenshots in `public/marketing/` are the screenshots to use in the manifest.
- A first-rate PWA is the goal here, but native app and app-store packaging work are intentionally deferred.
- This plan should stay standalone and should not depend on any other plan file.
