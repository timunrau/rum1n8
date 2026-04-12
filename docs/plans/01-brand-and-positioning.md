# 01 Brand and Positioning

## Title
Small product-clarity pass that makes it obvious rum1n8 is a Bible memory app without rewriting the README or changing the app architecture.

## Summary
- Standardize one descriptor everywhere: `Bible memory app`.
- Make the category explicit in the smallest possible set of user-facing places: README intro, browser title, meta description, manifest name/description, and one visible app-shell label.
- Keep the `rum1n8` brand, the app at `/`, and the current README structure.

## Current State
- `README.md` leads with `# rum1n8` and the pronunciation note, but the app category appears later in the document.
- `index.html` uses the title `rum1n8`, the Apple web app title `rum1n8`, and a generic description string.
- `vite.config.js` defines the PWA manifest name and short name as `rum1n8`, with a short description that does not fully carry the brand plus category together.
- `src/App.vue` shows generic empty-state copy such as `No verses yet`, but the app shell itself does not state what category of product this is.

## Implementation Changes
- Use `Bible memory app` as the canonical descriptor string across copy and metadata.
- Use `rum1n8 - Bible Memory App` as the primary metadata title string.
- Keep the README `# rum1n8` heading unchanged, but add one short clarifying sentence immediately under the title area:
  - Example target wording: `rum1n8 is a simple Bible memory app that gives you control of your data.`
- Update browser and install-facing metadata so the brand and category appear together:
  - `index.html` `<title>`
  - `index.html` meta description
  - `index.html` Apple web app title
  - `vite.config.js` manifest `name`
  - `vite.config.js` manifest `description`
- Keep manifest `short_name` as `rum1n8`.
- Add one visible app label inside the product shell that clarifies category without adding a landing page:
  - Use the top-level empty-library view as the location.
  - Add one short line that says this is a Bible memory app before the add-first-verse CTA.
- Do not change the repo name, app domain, or navigation model.
- Do not add any new screens in this plan.

## Acceptance Checks
- The README still reads like the current document, but a first-time reader can tell what the product is within the first few lines.
- Browser tab text clearly reads as a Bible memory app instead of only the brand name.
- Install surfaces on mobile still use `rum1n8` as the compact label, but the full manifest name clearly communicates the category.
- On a fresh library, the first visible empty-state copy explicitly says the app is for Bible verse memory.

## Deferred Tests
- Do not add or update tests for this plan until the copy and metadata changes are confirmed good.
- After approval, add a small Playwright assertion for the updated document title and any empty-state text that becomes user-critical.

## Assumptions
- Minimal README churn is a hard constraint, so this plan intentionally avoids heading rewrites and long copy edits.
- This plan is a clarity pass, not a marketing-site plan.
- More comprehensive empty-state and onboarding work belongs to `03-first-run-and-empty-state.md`.
