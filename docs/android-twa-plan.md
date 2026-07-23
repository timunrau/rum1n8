# Android Trusted Web Activity Implementation Plan

Status: future work; no TWA Android implementation has been started.

This document is a handoff for an agent implementing a Trusted Web Activity (TWA) edition of rum1n8 in this repository. It is deliberately separate from `docs/android-standalone-plan.md`. The two plans describe alternative Android architectures and must remain independently reviewable. Do not edit, merge, or replace the standalone plan while following this one.

## Recommendation in one paragraph

A TWA is the fastest, smallest Android route for rum1n8 if the hosted PWA remains the product. It preserves the existing browser storage, service worker, WebDAV proxy, Google Drive web flow, and web deployment model. It does **not** produce a self-contained application: the first launch requires the production website, ongoing behaviour depends on that origin and a compatible browser, and there is no general native bridge. If those tradeoffs are acceptable, use Bubblewrap and make `https://rum1n8.unrau.xyz/app/` the explicit launcher URL. Do not launch `/` and depend on a redirect to hide the marketing page.

## Goal

Ship rum1n8 through Android and, later, Google Play as a small verified TWA wrapper around the existing hosted PWA.

The TWA should:

- launch directly into the app at `/app/`, never the marketing page;
- reuse the production Vue application without a second frontend or Android-only copy;
- run without browser chrome after Digital Asset Links verification succeeds;
- preserve the current PWA service worker and post-first-launch offline behaviour;
- continue using browser-owned origin storage and the existing backup/sync features;
- continue using the hosted `/api/webdav` proxy and hosted Google OAuth callback;
- receive ordinary application changes through the web deployment pipeline;
- be buildable as a locally installable APK and, later, a Play Store AAB;
- degrade safely to a Custom Tab when TWA verification or provider support fails.

The TWA is not intended to satisfy the standalone plan's stronger requirements. In particular, it will not bundle the Vue build in the APK/AAB, replace browser storage with app-private native storage, make WebDAV direct from Android, or remove the rum1n8 server dependency.

## What a TWA changes and what it does not

The Android package is a launcher and trust declaration. The selected browser renders the production website and owns its cookies, storage, permissions, cache, and service worker. Digital Asset Links prove that the Android package and website belong to the same publisher; when verification succeeds, the browser may show the site without its normal address bar. When verification fails, the same URL opens as a Custom Tab with browser UI.

This leads to several important consequences:

- A web deployment can change the application immediately without publishing a new AAB.
- An Android release is still needed for package metadata, Android SDK targets, icons, signing, dependency updates, and Play requirements.
- Existing browser data may be visible when the same origin is opened through the same browser profile, but the design must not assume data will transfer across different browser providers or Android profiles.
- Uninstalling the wrapper is not a reliable way to clear browser-owned site data.
- Clearing the browser's site data can remove local rum1n8 data unless the user has a backup or sync.
- A first-ever offline launch cannot load the PWA because its service worker and assets have not been installed yet.
- Native Capacitor plugins and arbitrary Android APIs are not available through a TWA. Web platform support or narrowly implemented TWA delegation is required.

## Current repository and deployment facts

These facts were checked when this plan was written on 2026-07-22. Recheck them before implementation.

- The production build is multi-page: `/` is the marketing page and `/app/` is the Vue application.
- The generated web manifest already uses:
  - `start_url: "/app/"`;
  - `scope: "/"`;
  - `display: "standalone"`;
  - `id: "/"`;
  - suitable 192 px and 512 px icons.
- The production origin linked from `README.md` is `https://rum1n8.unrau.xyz`; confirm that this is the permanent TWA origin before generating the Android project.
- `https://rum1n8.unrau.xyz/app/` currently responds successfully.
- The live `manifest.webmanifest` currently responds successfully but is served as `application/octet-stream`, not `application/manifest+json`.
- `https://rum1n8.unrau.xyz/.well-known/assetlinks.json` currently returns 404.
- VitePWA creates the service worker, precaches the application assets, and uses `/app/index.html` as its navigation fallback.
- `index.html` already redirects a standalone-display launch from `/` to the preferred app URL when there is no explicit `returnTo` target.
- Deliberate About navigation uses `/?returnTo=...`; that explicit target prevents the marketing bypass and lets a user visit the marketing/About page and return to the app.
- `usePWAInstall.js` treats `(display-mode: standalone)` as installed. Verify that the chosen TWA provider reports the expected display mode so the app does not offer to install itself inside the TWA.
- Application data and provider credentials are stored in browser `localStorage`.
- WebDAV relies on the hosted `/api/webdav` proxy.
- Google Drive uses the hosted `/gdrive-callback.html` popup flow and a build-time web OAuth configuration.
- JSON/CSV export uses browser downloads; import uses browser file selection; verse/app sharing uses the Web Share API when available.
- Analytics, when configured, is the same optional self-hosted Umami integration used by the website and is governed by the existing browser-stored opt-out.

Useful preflight checks:

```bash
curl -I https://rum1n8.unrau.xyz/app/
curl -I https://rum1n8.unrau.xyz/manifest.webmanifest
curl -I https://rum1n8.unrau.xyz/.well-known/assetlinks.json
curl https://rum1n8.unrau.xyz/manifest.webmanifest
```

Also inventory the behaviour likely to be sensitive inside a TWA:

```bash
rg -n "window\.open|link\.download|navigator\.share|navigator\.clipboard|speechSynthesis|vibrate" src
rg -n "localStorage|serviceWorker|display-mode|navigator\.standalone" src index.html
rg -n "api/webdav|gdrive-callback|VITE_GOOGLE_CLIENT" src docs vite.config.js
```

## Architecture decisions

### One repository and one hosted frontend

Keep the web application and TWA wrapper in this repository. Do not create another Vue entry, copy `App.vue`, or fork the sync and memorization logic.

Use a distinct `android-twa/` directory for the generated Android project. The standalone plan reserves `android/` for a possible Capacitor project; the distinct name keeps the alternatives understandable even before one is selected.

The target layout should resemble:

```text
rum1n8/
├── android-twa/                 # Committed Bubblewrap/Gradle project
│   ├── twa-manifest.json        # Authoritative TWA configuration
│   └── ...
├── app/                         # Existing web application HTML entry
├── public/
│   └── .well-known/
│       └── assetlinks.json      # Public package/signing association
├── src/                         # Existing shared web application
├── docs/
│   ├── android-standalone-plan.md
│   └── android-twa-plan.md
└── vite.config.js
```

Commit the generated Gradle project and `twa-manifest.json`. Ignore keystores, passwords, local SDK paths, APKs, AABs, and Gradle build outputs.

Bubblewrap can regenerate project files from `twa-manifest.json` and warns that manual edits may be overwritten. Prefer configuration in `twa-manifest.json`. If a necessary Android customization cannot be expressed there, document it and automate its reapplication or verification; do not rely on an undocumented hand edit.

### Bubblewrap, not Capacitor

Use the current stable `@bubblewrap/cli` and generated Android Browser Helper dependency versions that meet the current Play target SDK requirement. Pin the CLI version used by the repository or CI instead of relying forever on an unversioned global install. Recheck compatibility at implementation time.

Bubblewrap remains a community GoogleChromeLabs project rather than a formally supported Google product. That is acceptable for this option, but dependency maintenance is part of ongoing release work.

Primary references:

- <https://developer.chrome.com/docs/android/trusted-web-activity/quick-start>
- <https://github.com/GoogleChromeLabs/bubblewrap/tree/main/packages/cli>
- <https://developer.android.com/training/app-links/configure-assetlinks>

### Direct app launch; marketing bypass is only a fallback

Use all three layers below:

1. Keep the web manifest `start_url` exactly `/app/`.
2. Set the committed Bubblewrap `startUrl` exactly `/app/` so the Android launcher resolves to `https://rum1n8.unrau.xyz/app/`.
3. Retain the existing root-page standalone redirect as defence in depth for an accidental root launch or root App Link.

The first two layers are authoritative. Do not set the TWA launcher to `/` and rely on `matchMedia('(display-mode: standalone)')` to redirect. A failed or delayed redirect would flash the marketing page, and the display-mode signal is also shared with ordinary installed PWAs.

Preserve the existing intentional About flow: `/?returnTo=<app route>` may show the marketing page inside the trusted origin, then return the user to the app. "Skip marketing" means it is never the launcher screen; it does not require deleting the public site or making About unusable.

Add a build-time assertion that inspects the web manifest, `twa-manifest.json`, and generated Android launcher metadata and fails if any default launch URL is `/` or anything outside `/app/`.

### Keep the hosted PWA authoritative

Do not add a TWA-specific Vite output. The TWA loads the normal production deployment, so the existing `dist` build, service worker, storage, sync providers, and runtime hosting remain authoritative.

Web releases and wrapper releases have different responsibilities:

| Change | Web deployment | Android release |
| --- | --- | --- |
| Vue/UI/domain logic | required | normally not required |
| Service worker/cache changes | required | not required |
| WebDAV/Google web integration | required | not required unless wrapper metadata changes |
| Package ID, target SDK, icons, signing | not sufficient | required |
| Bubblewrap/Android Browser Helper update | not sufficient | required |
| Digital Asset Links fingerprints | hosted file update | may require corresponding signed package/Play setup |

Never deploy a web change that makes the currently published TWA unusable. Treat the production origin as part of the Android release surface.

### Digital Asset Links and signing are release-critical

Publish `/.well-known/assetlinks.json` from the exact HTTPS production origin. It must:

- be reachable without redirects;
- return `Content-Type: application/json`;
- contain the permanent Android package ID;
- contain the SHA-256 fingerprint of every legitimate installed signing certificate that must verify;
- include the Play App Signing certificate fingerprint for Play-installed builds;
- not include an everyday debug keystore fingerprint on the production origin.

The local upload/release certificate and Play App Signing certificate are commonly different. Retrieve the Play fingerprint from Play Console after enabling Play App Signing; do not assume the locally generated fingerprint is the production one.

Fingerprints and package IDs are public and may be committed. Keystores, passwords, and service-account credentials are secrets and must not be committed.

If more than one deployment origin is considered, choose exactly one permanent production origin for the Play app. Digital Asset Links are origin-specific; changing the hostname later is a migration, not a cosmetic edit.

### Browser-owned data and hosted integrations remain unchanged

Do not implement the standalone plan's platform adapters or native storage as part of this TWA option.

- Keep origin storage in the browser, with the same risks and backup guidance as the PWA.
- Keep WebDAV through the hosted proxy.
- Keep Google Drive on the web flow only if physical-device testing proves the popup/callback path works correctly in TWA and Custom Tab fallback modes.
- Keep file import/export on browser APIs only if physical-device testing proves the resulting Android picker/download UX is usable.
- Keep service-worker update controls because web releases remain the TWA update mechanism.

If a required flow cannot work reliably through the web platform or TWA delegation, stop and reassess the architecture. Do not quietly add a broad custom native bridge; at that point the standalone/Capacitor plan is likely the more coherent choice.

### Offline behaviour is service-worker offline, not packaged offline

After one successful online launch, the service worker should make core PWA flows available offline to the same extent as the hosted PWA. A fresh Play install opened offline has no cached application and cannot show the Vue app.

For the prototype, document that first launch requires internet. Before a public release, provide a small native first-run offline screen with Retry if Bubblewrap/Android Browser Helper does not already provide an acceptable current mechanism. Keep it limited to the never-successfully-launched case; once the PWA has launched, let the service worker handle offline navigation.

Do not claim that the TWA works without a rum1n8 server. Even after caching, uncached assets, app updates, automatic Bible text import, hosted WebDAV proxy sync, Google Drive, and opted-in analytics still need network services.

### Analytics stays web analytics

Use the existing Umami integration and opt-out. The TWA renders the same origin and does not justify a second native analytics SDK.

There is no reliable general-purpose JavaScript signal that uniquely distinguishes a TWA from an ordinary installed PWA; `display-mode: standalone` identifies both. Do not fork app behaviour or privacy logic based on that signal. If Android-store attribution becomes important, design an explicit, privacy-reviewed launch parameter or Bubblewrap first-run flag and normalize it centrally. Do not attach sensitive or user-authored data.

## Required preflight decisions

Resolve these before generating `android-twa/`:

1. **Permanent production origin:** confirm `https://rum1n8.unrau.xyz` and confirm operational control of its TLS, hosting, reverse proxy, and `/.well-known/` path.
2. **Application ID:** confirm the permanent reverse-domain package ID. `xyz.unrau.rum1n8` is plausible but must not be assumed.
3. **Display and launcher name:** confirm whether Android should show `rum1n8` exactly.
4. **Distribution:** choose a local APK prototype, Play internal/closed testing, or both.
5. **Signing:** decide who owns the upload key, where its recoverable backup lives, and whether Play App Signing will be used.
6. **App Link scope:** recommended: claim `/app/` links for the Android app while leaving ordinary marketing links at `/` in the browser. If Bubblewrap cannot preserve that generated intent-filter configuration safely, decide explicitly whether all origin links may open the TWA.
7. **First-launch offline UX:** accept a documented online-first prototype, then decide whether the public release requires a native offline/retry screen.
8. **Minimum browser support:** decide whether Custom Tab fallback is acceptable when no installed browser supports verified TWA mode. Do not use WebView fallback without a separate security and compatibility review.

## Working rules for every stage

1. Read `AGENTS.md` and run `git pull --ff-only` before new work.
2. Preserve unrelated user changes in a dirty worktree.
3. Keep the normal hosted web/PWA build working throughout.
4. Run risk-proportionate existing tests during development. Before committing or pushing, run both `npm test` and `npm run test:e2e` unless the user explicitly says not to.
5. Per repository policy, do not add or update tests for new feature behaviour until the user explicitly confirms that behaviour is good.
6. Do not manually increment `package.json`; semantic-release owns the web version.
7. Use Conventional Commit subjects for every commit.
8. Stop at each stage gate for a physical-device demonstration and user confirmation.
9. Do not commit `.env`, keystores, signing passwords, service-account JSON, APKs, AABs, Gradle caches, or local SDK paths.
10. Do not implement work from `docs/android-standalone-plan.md` unless the user explicitly chooses that option.

## Stage 0: Baseline, domain, and suitability check

### Work

- Confirm all preflight decisions.
- Record the current Node/npm versions and the selected stable Bubblewrap, JDK, Android SDK, Gradle, and Android Browser Helper requirements.
- Confirm Android Studio or Android command-line tools, `adb`, a current compatible browser, and at least one physical device are available.
- Run the existing baseline:

```bash
npm install
npm test
npm run build
npm run test:e2e
```

- Audit the built and deployed PWA with browser installability tools and Bubblewrap validation.
- Confirm the exact production manifest URL generated by VitePWA.
- Confirm the production reverse proxy can serve `/.well-known/assetlinks.json` directly without authentication, rewriting, or redirects.
- Make a current JSON backup before testing the TWA with real browser storage.
- Test the current PWA on the intended Android browser before adding the wrapper:
  - direct `/app/` load;
  - installation and standalone launch;
  - offline relaunch after one online launch;
  - backup and CSV download/import;
  - WebDAV sync;
  - Google Drive authorization and callback;
  - Web Share, clipboard, speech synthesis, and vibration.

### Gate

- Existing failures and browser limitations are recorded rather than blamed on the future TWA.
- The user accepts that the TWA is hosted/browser-owned and cannot meet the standalone plan's no-server requirement.
- The permanent domain and package ID are confirmed.

## Stage 1: Harden the hosted PWA for TWA launch

### Work

1. Keep `manifest.start_url` at `/app/`, `display` at `standalone`, and the required icons intact.
2. Add a production check that fails if the manifest start URL stops pointing at `/app/`.
3. Update Nginx so `manifest.webmanifest` is served as `application/manifest+json` with appropriate revalidation headers.
4. Prepare an exact `/.well-known/assetlinks.json` Nginx location that:
   - serves the file as `application/json`;
   - permits no redirect;
   - does not fall back to `index.html`;
   - uses a short cache or explicit revalidation while signing is being established.
5. Keep the root marketing bypass as a fallback. Do not change its explicit-`returnTo` exception, which preserves deliberate About navigation.
6. Verify the service worker precaches the app entry and core assets and that `/app/` navigations resolve to `/app/index.html` offline after an initial online load.
7. Verify the PWA install UI is suppressed in a normal installed standalone PWA. This is the closest web-only rehearsal for expected TWA display-mode behaviour.
8. Deploy these web fixes before generating the wrapper so Bubblewrap reads production-quality metadata.

### Manual checks

- A normal browser visit to `/` still shows the marketing page for a new user.
- Installing the PWA and launching it opens `/app/`, not `/`.
- Navigating from the app to About opens `/?returnTo=...` without immediately redirecting away, and Back to app restores the prior route.
- A successful online launch followed by airplane mode can reopen the core app.
- The deployed manifest has the correct content type and values.
- The well-known path is ready to serve JSON without redirect, even if the final signed statement is not published yet.

### Gate

The hosted PWA itself has direct-app launch and acceptable Android browser behaviour. Do not use the TWA shell to conceal a broken PWA baseline.

## Stage 2: Generate the Bubblewrap prototype

### Work

1. Pin or otherwise record the exact stable Bubblewrap CLI version used.
2. Initialize into `android-twa/` from the deployed production manifest, using the selected version's documented syntax, for example:

```bash
bubblewrap init \
  --manifest="https://rum1n8.unrau.xyz/manifest.webmanifest" \
  --directory="android-twa"
```

3. Review every generated value. In `android-twa/twa-manifest.json`, ensure at minimum:
   - the confirmed `packageId`;
   - the confirmed name and launcher name;
   - production `host` corresponding to `https://rum1n8.unrau.xyz`;
   - `startUrl: "/app/"`;
   - `display: "standalone"`;
   - current theme/background/navigation colours for light and dark modes;
   - portrait orientation only if the user wants the existing manifest restriction;
   - notifications, billing, location delegation, file handlers, protocol handlers, and other optional features disabled unless rum1n8 actually needs and tests them;
   - Custom Tabs as the fallback unless another fallback is explicitly reviewed.
4. Commit the generated project configuration, Gradle wrapper, resources, and launcher assets.
5. Extend `.gitignore` for TWA secrets and outputs without ignoring the generated source project.
6. Add scripts or documented commands for:
   - TWA environment diagnosis;
   - PWA validation;
   - project regeneration/update;
   - unsigned or debug build where supported;
   - signed release build through secret inputs;
   - local install.
7. Add a verification script that checks all launch declarations resolve to `/app/` and that the generated package ID matches `twa-manifest.json`.
8. Build and install a prototype APK. At this stage, a Custom Tab/address bar is expected until Digital Asset Links are valid for the APK's signing certificate.

### Manual checks

- Tapping the launcher goes directly to `/app/` with no marketing flash.
- Query strings and hashes used by the application survive the launch/navigation flow.
- Android Back moves through app history and exits at the root rather than trapping the user.
- The app remains usable when verification falls back to a Custom Tab.
- The selected browser provider is visible in `adb logcat` and is the browser being tested.
- The normal website and installed browser PWA still work.

### Gate

The installed prototype launches `/app/` reliably. The user approves the basic shell before trust/signing work continues.

## Stage 3: Signing and verified TWA mode

### Work

1. Create or select the upload/release keystore under user-controlled, recoverable ownership. Keep it outside the repository.
2. Record only its alias and SHA-256 certificate fingerprint in safe configuration/documentation.
3. Add the relevant non-debug fingerprint to `twa-manifest.json` with Bubblewrap's fingerprint command or the current documented equivalent.
4. Generate `assetlinks.json` and review it manually. It should grant `delegate_permission/common.handle_all_urls` only to the confirmed package ID and intended certificates.
5. Publish the statement at `public/.well-known/assetlinks.json` and deploy it to the production origin.
6. Verify over the public internet that the endpoint:
   - returns 200;
   - returns `application/json`;
   - does not redirect;
   - contains the expected package ID and fingerprint.
7. Build an APK signed by the associated certificate, install it, clear stale link-verification state as needed, and confirm the address bar disappears.
8. Inspect Android's App Link verification state and TWA provider logs. Do not accept "looks fullscreen" as proof by itself.
9. When Play App Signing is configured, add the Play app-signing fingerprint from Play Console. Keep the locally relevant release/upload fingerprint only if it is still needed for a legitimate distributed build.
10. Re-test with a Play-delivered internal-track build because Play signing differs from local installation.

### App Link scope

The recommended user experience is:

- launcher: always `/app/`;
- verified `/app/` links: may open the installed Android app;
- ordinary `https://rum1n8.unrau.xyz/` marketing links: remain website links in the browser;
- About navigation started inside the TWA: may remain within the verified origin and show the marketing page deliberately.

If the generated Android intent filter claims the entire host, evaluate whether a stable generated configuration can restrict it to `/app/` and related app deep links. Because Bubblewrap regeneration can overwrite Android files, add a deterministic post-generation patch plus a verification check if this restriction requires editing generated XML. Do not silently ship domain-wide link capture just because it is the generator default.

### Gate

A locally signed build and a Play-signed internal build both verify against the production origin and launch without browser chrome. Fingerprints and ownership are documented without exposing secrets.

## Stage 4: TWA compatibility pass for real application flows

### Work

Test every web capability on physical Android hardware in both verified TWA mode and Custom Tab fallback. Fix shared web code only where the change also makes sense for the hosted PWA.

1. **Storage and lifecycle**
   - Create and edit data, force-stop, reboot, and relaunch.
   - Confirm local data persists in the tested browser provider.
   - Confirm clearing browser site data has the expected destructive effect and the backup guidance is clear.
   - Do not promise cross-provider storage sharing.
2. **Install UI**
   - Confirm rum1n8 never offers a second PWA install prompt while running inside the TWA.
   - If `display-mode: standalone` is insufficient on a supported provider, add the smallest explicit launch marker supported by Bubblewrap rather than user-agent sniffing.
3. **About and public pages**
   - Open About, Privacy, Memorization Tips, and the BibleMemory import guide.
   - Verify the expected trusted/fullscreen versus browser-UI transitions for same-origin and external links.
   - Verify `returnTo` restores the correct app route.
4. **Back and task behaviour**
   - Exercise modals, views, public pages, external links, background/resume, recents, and repeated launcher taps.
   - Avoid duplicate task stacks and Back loops.
5. **Backup and files**
   - Export and restore JSON.
   - Import and export CSV.
   - Verify filenames, MIME types, cancellation, download visibility, and Android document-provider compatibility.
6. **Web Share and clipboard**
   - Share a verse and the public app URL.
   - Verify the app shares the marketing URL externally, not an Android-specific or app-deep-link URL.
7. **WebDAV**
   - Test the production proxy end to end. A TWA does not make direct WebDAV requests native and does not remove the proxy dependency.
8. **Google Drive**
   - Test sign-in popup/callback, cancellation, refresh, revoked consent, sign-out, and account switching.
   - Test from both verified TWA and fallback Custom Tab.
   - If `window.opener` or popup handling is unreliable, prefer a robust web redirect flow that returns to `/app/`; do not embed credentials in the wrapper or add a client secret to Android.
9. **Device web APIs**
   - Test clipboard, Web Share, speech synthesis, vibration, online/offline events, keyboard resizing, theme, orientation, and safe-area/system-bar appearance.
10. **Analytics and privacy**
    - Verify configured Umami events behave exactly like the PWA.
    - Opt out and confirm no further analytics requests occur.
    - Confirm external browser/TWA transitions do not reset the opt-out.

### Gate

All core rum1n8 flows are usable on a physical phone. Any unsupported flow is either fixed in shared web code, explicitly deferred with acceptable UI, or treated as a reason to choose the standalone architecture instead.

## Stage 5: Offline, updates, and failure behaviour

### Work

1. Test a fresh install opened online, then offline after the service worker has activated and cached the app.
2. Test a fresh install whose first launch is offline.
3. For public release, implement a minimal first-launch offline/retry Activity if the default browser error page remains the result. Follow the current Android Browser Helper guidance, not an old copied sample.
4. Ensure the offline screen never claims user data is missing and does not write application data; it only explains that first setup needs a connection and provides Retry/Exit.
5. Test a web deployment while the TWA is open:
   - service-worker update discovery;
   - the existing update UI;
   - safe reload;
   - no mixed old/new asset failure.
6. Test rollback/recovery from a broken web deployment. The hosting pipeline should retain a known-good image or another fast rollback path because a bad web release breaks the Android experience without an AAB change.
7. Test production-origin outage, TLS failure, DNS failure, WebDAV proxy outage, Google outage, and analytics outage. Core cached use should degrade honestly and optional failures must not block startup.
8. Verify Custom Tab fallback when Digital Asset Links is temporarily unavailable or mismatched.
9. Add monitoring for the production app entry, manifest, service worker, and asset-links endpoint. Do not make the app depend on analytics to detect availability.

### Gate

The TWA works offline after a successful initial load, presents a reasonable first-launch offline experience, updates safely from the web, and has an operational rollback path.

## Stage 6: Release engineering and Play distribution

### Versioning

- Continue treating `package.json` as the user-visible web version source.
- Map that version into Android `versionName` during an intentional wrapper release.
- Generate or document an always-increasing integer `versionCode`; never derive a scheme that can decrease or collide.
- Do not publish a new AAB for every web deployment. Publish when Android wrapper metadata, dependencies, SDK level, policy declarations, icons, or signing configuration change.
- Do not manually bump `package.json`; retain semantic-release and Conventional Commits.

### Android hardening

- Target the current Play-required Android API level at release time. Starting 2026-08-31, current Android guidance says new apps and updates must target Android 16/API 36 or higher; recheck immediately before submission.
- Review exported activities, intent filters, App Link scope, permissions, backup configuration, browser fallback, and task launch mode.
- Request no Android permissions that rum1n8 does not use.
- Keep notification, location, billing, and other delegations disabled unless their product behaviour is explicitly added and approved.
- Review generated dependencies with the Play SDK index and current Android Browser Helper releases.
- Confirm adaptive, round, and monochrome launcher assets and splash appearance in light/dark mode.

### Signing and CI

1. Store the upload keystore and passwords only in the approved local/CI secret store.
2. Add CI inputs such as Bubblewrap keystore/key password variables without printing them.
3. Build a signed AAB and optional APK reproducibly from the committed `twa-manifest.json` and generated project.
4. Add CI checks that:
   - run the web unit and end-to-end suites;
   - build the hosted PWA;
   - validate the deployed manifest and app URL;
   - assert `/app/` as every default launch URL;
   - validate `assetlinks.json` JSON, package ID, and required fingerprints;
   - verify the well-known endpoint's status, content type, and lack of redirects;
   - run applicable Gradle lint/build checks;
   - generate checksums for release artifacts;
   - never archive a keystore or secret-bearing configuration.
5. Treat `bubblewrap update` as a reviewed dependency/regeneration change. Because it can overwrite generated files, inspect the full diff and rerun all launch/link assertions.

### Play preparation

- Create the Play app with the permanent package ID and enable Play App Signing.
- Add the Play signing fingerprint to the deployed Digital Asset Links statement before testing the Play-installed bundle.
- Provide store listing copy and current phone screenshots taken from the actual TWA experience.
- Maintain a durable public privacy-policy URL.
- Complete Data Safety and content-rating declarations from actual hosted behaviour, including optional sync and analytics.
- Confirm the app offers meaningful interactive functionality and does not resemble a static site wrapper.
- Start with internal testing, then closed testing, then a staged production rollout.
- Verify developer-account/Android developer verification requirements current at release time.

### Gate

A Play-delivered internal or closed-test build opens the production `/app/` URL as a verified TWA, upgrades cleanly, passes the acceptance matrix, and has owned/recoverable signing and rollback processes.

## Stage 7: Regression coverage after behaviour approval

Only add or update tests after the user has approved the demonstrated behaviour, in accordance with `AGENTS.md`.

### Coverage candidates

- generated web manifest retains `/app/` as `start_url`;
- committed `twa-manifest.json` retains `/app/` as `startUrl`;
- generated Android launcher metadata resolves to `/app/`;
- root standalone launch redirects to `/app/` without a marketing flash;
- `returnTo` continues to allow deliberate About navigation;
- TWA/app-installed context suppresses the nested install UI;
- asset-links file has valid JSON, expected relation, package ID, and approved fingerprint set;
- Nginx serves manifest and asset-links files with correct content types and no redirect;
- optional post-generation Android patches are idempotent and verified;
- production smoke check covers `/app/`, manifest, service worker, and asset-links endpoints.

### Required runs before commit or push

Unless the user explicitly says otherwise:

```bash
npm test
npm run build
npm run test:e2e
```

Also run the selected Bubblewrap validation/build commands and applicable Gradle lint/build checks from `android-twa/`.

## Manual Android acceptance matrix

Run this on at least one physical phone and one emulator, with a TWA-capable current browser and at least one fallback scenario.

### Launch and trust

- fresh install and first online launch;
- launcher opens `/app/` without showing marketing;
- verified build has no address bar;
- deliberately broken verification falls back safely to a Custom Tab;
- browser provider is identified and expected;
- repeated launcher tap and recents do not create confusing task stacks;
- Android Back navigates and exits normally;
- `/app/?view=collections`, review, and stats deep links land correctly;
- external marketing link behaviour matches the chosen App Link scope.

### Hosted pages and external navigation

- About marketing page opens deliberately with `returnTo`;
- Memorization Tips, BibleMemory import guide, and Privacy open and return correctly;
- external links show an appropriate browser trust cue;
- no unowned external origin is added as an additional trusted origin.

### Storage and core app

- add, edit, delete, search, practice, review, and organize verses;
- force-stop, relaunch, reboot, and browser update;
- browser site-data clearing behaviour is documented and understood;
- JSON backup/restore and CSV import/export;
- WebDAV upload/download/merge through the hosted proxy;
- Google Drive sign-in/sync/sign-out if enabled;
- no claim of cross-browser-provider data sharing.

### Offline and web updates

- first launch online then offline relaunch;
- first-ever launch offline and Retry recovery;
- optional network operations explain offline state without damaging local data;
- service-worker update while the TWA is installed;
- deployment rollback from a deliberately bad staging release;
- origin, proxy, Google, and analytics outage behaviour.

### Device integration and presentation

- Web Share and clipboard;
- JSON/CSV download visibility and Android file picker;
- speech synthesis and vibration where supported;
- keyboard and text entry;
- light, dark, and system theme;
- portrait/rotation policy;
- status/navigation bars, gesture navigation, safe areas, splash, adaptive icon, and monochrome icon;
- TalkBack labels, focus order, text scaling, and touch targets.

### Play delivery

- internal-track install is verified with the Play signing certificate;
- upgrade preserves browser-owned origin data;
- store listing launches the intended package;
- current target SDK, Data Safety, privacy, and developer-verification requirements are satisfied.

## Ongoing operational checklist

A TWA turns web hosting into Android production infrastructure. After release:

- keep the exact production origin stable;
- keep HTTPS and certificate renewal healthy;
- monitor `/app/`, `manifest.webmanifest`, the service worker, and `/.well-known/assetlinks.json`;
- preserve the asset-links package ID and current signing fingerprints;
- test significant web releases on an installed Play build before broad deployment;
- retain fast container rollback;
- periodically update Bubblewrap/Android Browser Helper and the target SDK;
- publish a wrapper update when Play or Android requirements change;
- keep user-facing backup guidance prominent because local data is browser-owned;
- re-run Google Drive and download/import checks after major browser changes.

## Comparison with the standalone Android plan

| Concern | TWA plan | Standalone/Capacitor plan |
| --- | --- | --- |
| Android binary size and initial effort | smaller and faster | larger and substantially more work |
| App code | hosted production PWA | bundled Vue build |
| First launch offline | impossible without a native fallback screen; app itself still unavailable | intended to work fully offline |
| Ongoing server dependency | yes | no for core features |
| Local data | browser-owned origin storage | app-private native storage |
| WebDAV | hosted proxy | direct native transport |
| Google Drive | existing web flow if compatible | native authorization required |
| File APIs | browser download/picker | native file/share adapters |
| Application updates | mostly web deploys | Play/APK releases |
| Native APIs | limited web/TWA delegation | Capacitor/native plugins |
| Main risk | domain/browser/service-worker/signing coupling | storage migration and native integration complexity |

## Stop/go criteria

Choose the TWA option if all of the following remain true after the prototype:

- keeping `rum1n8.unrau.xyz` online and stable is acceptable;
- browser-owned storage and backup semantics are acceptable;
- first-launch-online is acceptable with a friendly offline fallback;
- backup/import, WebDAV, Google Drive, sharing, and device APIs work well enough through the browser;
- Digital Asset Links and Play signing can be owned operationally;
- the product does not need broad native APIs or app-private secrets/storage.

Stop and prefer the standalone plan if any of these become requirements:

- core use must work on first launch with no network;
- the app must survive permanent loss of the hosted origin;
- memorization data must live in app-private native storage;
- sync must work without the hosted WebDAV proxy;
- Google authorization or files require a native bridge that becomes more than a narrow exception;
- browser-provider storage and lifecycle behaviour is unacceptable.

## References to recheck at implementation time

- TWA quick start: <https://developer.chrome.com/docs/android/trusted-web-activity/quick-start>
- TWA integration guide: <https://developer.chrome.com/docs/android/trusted-web-activity/integration-guide/>
- TWA offline-first guidance: <https://developer.chrome.com/docs/android/trusted-web-activity/offline-first>
- Bubblewrap CLI: <https://github.com/GoogleChromeLabs/bubblewrap/tree/main/packages/cli>
- Digital Asset Links: <https://developers.google.com/digital-asset-links>
- Android App Links and `assetlinks.json`: <https://developer.android.com/training/app-links/configure-assetlinks>
- Play target API requirements: <https://developer.android.com/google/play/requirements/target-sdk>
- Play app quality policy: <https://support.google.com/googleplay/android-developer/answer/9898783>
