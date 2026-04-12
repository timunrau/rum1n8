# 04 PWA Polish

## Title
Upgrade the installable web app experience so it feels intentional and reliable on mobile while staying within a pure PWA scope.

## Summary
- Improve manifest quality, install UX, and offline behavior.
- Reuse the screenshots produced by the SEO plan.
- Keep the work limited to the web app. Do not add Android wrapper or Play Store release work here.

## Current State
- `vite.config.js` already configures `vite-plugin-pwa`, but the manifest is minimal and does not include screenshots, shortcuts, categories, or install-oriented polish.
- `src/composables/usePWAInstall.js` handles `beforeinstallprompt` and a basic iOS modal, but it does not model install availability, snoozing, or browser-specific iOS guidance.
- `src/App.vue` currently shows a header `Install app` button whenever the app is not installed, even if install prompting is not actually available.
- Network-dependent actions such as sync and verse import do not currently have a clear offline-aware UX.

## Implementation Changes
- Extend the local UI-state record from `03-first-run-and-empty-state.md` with:
  - `installPromptDismissedUntil: null`
- Improve manifest configuration in `vite.config.js`:
  - keep `short_name: "rum1n8"`
  - change full `name` to `rum1n8 Bible Memory`
  - keep `start_url: "/"` and `scope: "/"`
  - add `id: "/"`
  - add categories: `education`, `lifestyle`, `productivity`
  - add `display_override: ["standalone", "minimal-ui", "browser"]`
  - add the portrait screenshots generated in `02-seo-and-share-surface.md`
  - add shortcuts that deep-link into existing query-param navigation:
    - `/?view=collections`
    - `/?view=review-list`
    - `/?view=stats`
- Align launch colors with the real shell:
  - use white as the manifest `background_color` to match the default light launch shell
  - keep the runtime dark-mode `theme-color` update for active browsing
- Replace the current unconditional header install button with more intentional install surfaces:
  - on an empty library, surface install through the onboarding card from plan `03`
  - on an established library, show a slim dismissible install banner on the top-level collections view
  - only show install UI when one of these is true:
    - the browser has a deferred install prompt
    - the device is iOS and not already installed
  - do not show install UI when there is no viable install path
- Add a 14-day snooze:
  - when the user chooses `Not now`, set `installPromptDismissedUntil` to now plus 14 days
  - clear the snooze when `appinstalled` fires
- Improve iOS install guidance:
  - if the user is in Safari on iOS, keep the add-to-home-screen steps
  - if the user is on iOS but not Safari, first explain that installation must be completed in Safari
- Add online/offline awareness:
  - track `navigator.onLine` reactively
  - keep local browsing, practice, and review available offline
  - disable or short-circuit network-dependent actions while offline:
    - verse text import
    - manual sync
    - automatic sync on startup
  - show clear helper text when those actions are unavailable offline
  - do not block manual verse entry while offline
- Keep the existing service-worker and offline caching approach unless a concrete problem appears during implementation.
- Explicitly out of scope:
  - Bubblewrap
  - Trusted Web Activity packaging
  - Play Store release assets or submission flow

## Acceptance Checks
- The installed app name remains compact on device, but the full manifest name clearly describes the product.
- The manifest contains screenshots and shortcuts that point to the existing query-param views.
- Install UI only appears when installation is genuinely actionable.
- Dismissing the install prompt/banner hides it for 14 days, and actual installation clears the snooze.
- On iOS Safari, install guidance shows add-to-home-screen steps; on iOS non-Safari, the guidance tells the user to open the site in Safari first.
- With the browser offline, existing verses remain usable while sync and verse import clearly indicate they are unavailable.
- Starting the app offline does not produce a noisy sync failure for a user who is just trying to review saved verses.

## Deferred Tests
- Do not add or update tests for this plan until the install and offline behavior are confirmed good.
- After approval, add Playwright coverage for:
  - install surface visibility rules
  - install snooze persistence
  - offline disabled state for import and sync
  - manifest or built-output assertions for shortcuts and screenshots if practical

## Assumptions
- The screenshots produced in `02-seo-and-share-surface.md` are available before this plan is implemented.
- A first-rate PWA is the goal here, but Android wrapper work is intentionally deferred.
- This plan can extend the existing composable and UI-state helper instead of replacing the current PWA approach wholesale.

