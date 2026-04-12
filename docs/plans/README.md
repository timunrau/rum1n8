# Implementation Plans

## Overview
This folder breaks the marketing, SEO, onboarding, PWA, and analytics work into small standalone plans that can be executed in separate AI chats. Each plan is self-contained and should be readable without having the other plan files open, but they are written to work best in the recommended order below.

## Recommended Order
1. [01-brand-and-positioning.md](01-brand-and-positioning.md)
2. [02-seo-and-share-surface.md](02-seo-and-share-surface.md)
3. [03-first-run-and-empty-state.md](03-first-run-and-empty-state.md)
4. [04-pwa-polish.md](04-pwa-polish.md)
5. [05-privacy-analytics-and-hosting.md](05-privacy-analytics-and-hosting.md)

## Shared Constraints
- Keep the app at `/`. Do not split marketing and app routing in this phase.
- Keep README changes minimal. Only clarify the product category instead of rewriting the document.
- Do not rename the repo or replace the `rum1n8` brand in this phase.
- Do not include Bubblewrap, Trusted Web Activity packaging, or Play Store release work in this phase.
- Keep analytics optional, self-hosted, and absent by default.
- Keep the current synced settings model intact unless a later plan explicitly changes it.

## Shared Defaults
- Product descriptor to standardize on: `Bible verse memory app`
- Local-only UI state storage key: `rum1n8-ui-state`
- Optional build env vars:
  - `VITE_SITE_URL`
  - `VITE_UMAMI_SCRIPT_URL`
  - `VITE_UMAMI_WEBSITE_ID`

## Dependencies Between Plans
- `01` establishes the exact naming and descriptor strings that later plans reuse.
- `02` should produce the social preview image and app screenshots that `04` references in the web manifest.
- `03` should introduce the local UI-state helper that `04` extends for install snoozing.
- `05` is optional and should not block the first four plans.

## How To Use These In Separate AI Chats
- Start each chat with a single plan file instead of this whole folder.
- Treat the plan file as the source of truth for that implementation thread.
- If a plan references a shared default from this index, restate it in the chat so the thread is self-contained.

