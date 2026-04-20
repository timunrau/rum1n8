# 05 Privacy Analytics and Hosting

## Title
Add optional self-hosted privacy-friendly analytics in a way that fits the current Docker deployment model and preserves the app's privacy-first default.

## Summary
- Make analytics optional and self-hosted.
- Add a toggle in the settings modal to opt out of analytics. If they opt out, don't track them.
- Use Umami as the default tool.
- Keep the base app deployment unchanged when analytics is not configured.

## Current State
- `docker-compose.yml` defines a lean base stack with the app, the WebDAV proxy, and Watchtower.
- `docs/hosting.md` documents only the current base deployment path.
- `public/privacy.html` currently states that rum1n8 does not use analytics, tracking, advertising, or telemetry.
- The app has no analytics loader, no event helper, and no environment-gated tracking behavior.

## Implementation Changes
- Use self-hosted Umami as the default analytics choice for this phase.
- Keep analytics out of the base app stack:
  - leave `docker-compose.yml` focused on the app and proxy
  - add an optional overlay file named `docker-compose.analytics.yml`
  - define two additional services in the overlay:
    - `umami`
    - `umami-db` using PostgreSQL
  - run analytics with a layered compose command rather than making it a default dependency
- Load analytics only when both build env vars are present:
  - `VITE_UMAMI_SCRIPT_URL`
  - `VITE_UMAMI_WEBSITE_ID`
- Add a small analytics helper module that:
  - injects the Umami script only when both env vars are present
  - exposes a simple `trackEvent(name)` function
  - becomes a no-op when analytics is disabled
- Initialize analytics once in the app bootstrap rather than scattering script injection logic across components.
- Keep the event list intentionally small:
  - pageviews via Umami's default behavior
  - `onboarding_add_verse_clicked`
  - `install_prompt_clicked`
  - `onboarding_dismissed`
  - `verse_added`
- Fire custom events only on successful or explicit user actions:
  - `verse_added` after the verse is actually saved
  - install event on install CTA click, not on every install-surface render
- Update hosting docs to explain the optional overlay deployment:
  - required Umami/Postgres environment variables
  - sample layered compose command
  - reverse-proxy expectations for the Umami host
  - how the app env vars should point at the deployed Umami script
- Keep privacy-policy behavior truthful:
  - when analytics env vars are not set, preserve the current no-analytics stance
  - when analytics env vars are set, update the privacy page wording at build time to disclose privacy-friendly self-hosted analytics
  - use the same build-time env gating that controls script injection so the policy matches the actual deployment
- Do not require analytics for any app feature.

## Acceptance Checks
- A default build without Umami env vars contains no analytics script and no analytics runtime errors.
- A build with both Umami env vars injects the script and leaves the app otherwise unchanged.
- The compose overlay can be brought up alongside the base stack without changing the base app services.
- The app emits only the agreed minimal event set.
- The privacy page accurately reflects whether analytics is enabled for that build.
- A self-hosted deployment can skip analytics entirely without breaking the documented base deployment path.

## Deferred Tests
- Do not add or update tests for this plan until the integration behavior is confirmed good.
- After approval, add a small test around analytics env gating and a lightweight assertion that the script is absent when disabled.
- If the analytics helper is introduced as a pure module, add a unit test that verifies `trackEvent` becomes a no-op when config is missing.

## Assumptions
- Optional analytics is important for measuring adoption, but privacy remains a product differentiator.
- Umami is preferred because it is simple, self-hostable, and fits Docker-based deployment.
- This plan is intentionally optional and should not be a prerequisite for the product-clarity, SEO, onboarding, or PWA work.
