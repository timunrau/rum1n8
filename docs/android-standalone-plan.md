# Standalone Android App Implementation Plan

Status: future work; no Android implementation has been started.

This document is a handoff for an agent implementing a standalone Android edition of rum1n8 in this repository. It is intended to be followed incrementally. Do not turn this into a separate Android repository or rewrite the application in Kotlin/Compose.

## Goal

Ship rum1n8 as an installable Android application whose compiled Vue application is bundled inside the APK/AAB and whose core memorization features work without a rum1n8 web server or an internet connection.

The Android app should:

- reuse the existing Vue application and domain logic;
- retain the existing hosted web/PWA build from the same repository;
- store important user data durably in app-private native storage;
- import and export portable backups through Android-native file flows;
- support optional direct WebDAV and Google Drive sync without depending on the rum1n8 hosting stack;
- retain the existing privacy-friendly, self-hosted Umami analytics and user opt-out on Android;
- contain no embedded OAuth client secret, plaintext sync password backup, or refresh-token backup;
- be buildable as a debug APK and, later, as a signed Play Store AAB.

"No web server" means no rum1n8 application server is needed after installation. Optional operations still require their own remote services:

- automatic Bible-text import calls `fetch.bible` and therefore needs internet access;
- WebDAV sync needs the user's WebDAV server;
- Google Drive sync needs Google's OAuth and Drive APIs;
- opted-in anonymous usage analytics sends events to the configured self-hosted Umami endpoint;
- Play Store or APK updates need a distribution channel.

Manual verse entry, collections, practice, review scheduling, search, stats, and local backup/restore must not require a network connection.

## Repository facts to preserve

- The application is Vue 3 built with Vite.
- The production build is multi-page. The actual app entry is `app/index.html`, while the root entry is the public marketing site.
- The PWA plugin and service-worker update flow are web-only concerns.
- The app currently stores verses, collections, settings, sync state, tombstones, and credentials in `localStorage`.
- `App.vue`, `app-settings.js`, `sync/sync-manager.js`, both sync providers, `ui-state.js`, and `migrate-storage.js` access `localStorage` directly.
- The production WebDAV implementation routes through `/api/webdav` to avoid browser CORS.
- Google Drive currently uses a popup callback and a build-time `VITE_GOOGLE_CLIENT_SECRET`; this flow must not be copied into Android.
- Backups currently include provider settings, which can include WebDAV passwords and Google refresh tokens. That must be corrected before an Android release.
- Analytics is currently enabled only when both `VITE_UMAMI_SCRIPT_URL` and `VITE_UMAMI_WEBSITE_ID` are present. The app and bundled public pages share the same user-controlled `analyticsOptOut` setting.
- `vite.config.js` has post-build logic that assumes the output directory is exactly `dist`; Android output work must account for this.
- `App.vue` contains browser service-worker update controls and browser-download implementations for JSON and CSV.

Before editing, inventory the current state rather than relying only on this document:

```bash
rg -n "localStorage|sessionStorage|serviceWorker|window\.open|link\.download|fetch\(" src
rg -n "VITE_GOOGLE_CLIENT|api/webdav|VitePWA|closeBundle|outDir" src vite.config.js
```

## Architecture decisions

### One repository

Keep all code in this repository. Commit the generated `android/` Gradle project because it will contain native configuration, permissions, icons, plugin registration, and release settings. Continue ignoring generated web bundles and native build artifacts.

The eventual high-level layout should be similar to:

```text
rum1n8/
├── android/                       # Committed native Android project
├── app/                           # Existing web app HTML entry
├── public/
├── src/
│   ├── platform/                  # Shared platform interfaces/adapters
│   │   ├── runtime.js
│   │   ├── storage/
│   │   ├── files/
│   │   ├── http/
│   │   ├── auth/
│   │   └── lifecycle.js
│   └── ...                        # Existing shared Vue/domain code
├── capacitor.config.*
├── vite.config.js
└── package.json
```

Do not create a second copy of `App.vue`, a separate Android frontend, or Android-only copies of the SRS and sync merge algorithms.

### Capacitor, not a Trusted Web Activity

Use the current stable Capacitor release compatible with this project's supported Node and Android toolchain. A Trusted Web Activity normally launches a hosted website and therefore does not satisfy the standalone requirement. Capacitor packages the compiled web assets and provides narrowly scoped native APIs.

Verify current Capacitor and Android requirements at implementation time rather than blindly using versions mentioned in old discussion. Primary references:

- <https://capacitorjs.com/docs/getting-started>
- <https://capacitorjs.com/docs/android>
- <https://capacitorjs.com/docs/config>

### Separate outputs, shared multi-page inputs, direct app launch

Retain the existing `dist` output for hosting and add a generated `dist-android` output for Capacitor. Add `dist-android` to `.gitignore`.

The Android build should retain the existing multi-page inputs and public assets. It should contain the marketing page, privacy page, memorization tips, BibleMemory import guide, icons, and screenshots, but Capacitor must always cold-start at `/app/index.html` using `server.appStartPath`. The bundled marketing page is optional in-app content reached deliberately through About; it is never the Android launch screen.

This is an intentional simplicity tradeoff. At the time this plan was written, `public/` was about 2.4 MB, almost entirely marketing screenshots. That modest package-size cost avoids creating a second HTML architecture, changing the app's `/app/` route assumptions, or replacing all current public-page navigation. Reassess only if measured APK/AAB size becomes a real distribution problem; do not pre-emptively build an app-only HTML pipeline.

Keep the normal public-directory copy behaviour in Android mode so bundled pages resolve their images and icons. The Android build may omit web-only generated artifacts such as runtime HTML templates, `robots.txt`, and `sitemap.xml`, but it should not omit the actual public pages or assets they need.

Do not point Capacitor at the normal web `dist`, because that makes it too easy to package the PWA service worker or a stale web build accidentally.

Do not set a production `server.url`. All pages in `dist-android` must load through Capacitor's packaged local asset handler, not from the hosted website.

### Retain analytics without making it an app dependency

Keep the existing self-hosted Umami integration in Android release builds. Analytics is an intentional optional network feature, not a requirement for startup or core use. If the device is offline, the analytics host is unavailable, or the user opts out, the app must continue normally without blocking UI, sync, storage, or navigation.

Use the same self-hosted Umami endpoint. Before implementation, choose one of these reporting arrangements:

1. **Separate Android website ID (recommended):** cleanly separates native and hosted-web pageviews while retaining the same Umami server.
2. **Shared website ID with an Android tag:** use Umami's tracker `data-tag` support to distinguish Android traffic in one dashboard.

Do not rely only on `window.location.hostname`, because Capacitor uses a local hostname such as `localhost`. Add `platform: 'android'` and the app version to custom event data in the analytics wrapper. Do not add these fields manually at every call site.

The tracker script URL and website ID are public build configuration, not secrets. Release builds should receive explicit Android analytics configuration, for example an Android-specific website ID alongside the existing script URL. Debug builds should use a test analytics property or be clearly marked so local testing does not pollute production analytics.

Preserve the current Settings opt-out. On native startup, load the durable `analyticsOptOut` preference before calling `initAnalytics`. The bundled marketing, tips, import, and privacy pages must read the same native preference before initializing analytics; do not let a full-page navigation reset an Android user's opt-out.

Do not persist an offline analytics event queue to disk. A bounded in-memory retry is acceptable, but analytics must not create durable behavioural history on the device or replay a large backlog later.

Analytics payloads must never contain verse text or references, collection names, Google email addresses, WebDAV URLs/usernames, filenames, credentials, tokens, backup contents, or other user-authored content. Preserve the current aggregate event approach.

Primary Umami references to re-check at implementation time:

- <https://docs.umami.is/docs/tracker-configuration>
- <https://docs.umami.is/docs/track-events>
- <https://docs.umami.is/docs/tracker-functions>

### Explicit platform adapters

Do not scatter `Capacitor.isNativePlatform()` checks throughout components. Add platform services with stable interfaces, then select a web or native implementation at the edge.

Target interfaces should cover at least:

- runtime/platform detection;
- durable application data and lightweight preferences;
- secrets/credentials;
- file import/export/share;
- arbitrary HTTP methods needed by WebDAV;
- Google authorization;
- app lifecycle, Android back navigation, and external links.

### Native storage is authoritative on Android

Do not release an Android app that treats WebView `localStorage` as authoritative storage for memorization data. Capacitor documents WebView local storage as potentially transient. See <https://capacitorjs.com/docs/guides/storage>.

Recommended initial native data design:

- one versioned app-private JSON snapshot for verses, collections, sync tombstones/state, and durable app settings;
- atomic writes using a temporary file followed by replacement/rename;
- native Preferences only for small lightweight values;
- Keystore-backed storage for WebDAV credentials and OAuth refresh tokens;
- `sessionStorage` only for truly ephemeral UI state;
- browser `localStorage` retained behind the web storage adapter so the existing PWA keeps its data.

The app currently loads and rewrites its dataset as a whole, so an app-private JSON snapshot is a smaller and safer first migration than SQLite. Reconsider SQLite only if measured dataset size, query needs, or write performance justify it.

Do not monkey-patch `window.localStorage`. Refactor call sites toward the storage interfaces and use an asynchronous bootstrap before mounting Vue.

## Required preflight decisions

The implementing agent must resolve these before generating `android/`:

1. **Application ID:** confirm the permanent reverse-domain package ID with the user. `xyz.unrau.rum1n8` is a plausible candidate, but do not assume it. Changing it after OAuth and Play configuration is painful.
2. **Initial distribution:** confirm whether the first target is a sideloaded APK, a closed Play testing track, or both. The plan supports both.
3. **App display name:** confirm whether Android should display `rum1n8` exactly.
4. **Signing ownership:** determine where the release keystore will live and who controls it. Never commit it.
5. **Google Cloud ownership:** identify the project in which the Android OAuth client and Drive API configuration will be created.
6. **Android analytics reporting:** confirm whether Android uses a separate Umami website ID (recommended) or the web ID plus an `android` tag, and identify a non-production property for debug builds.

If the user only wants an early local proof, Stage 1 can use a tentative debug-only package ID, but do not configure release signing or Google OAuth against it.

## Working rules for every stage

1. Read `AGENTS.md` and run `git pull --ff-only` before new work.
2. Preserve unrelated user changes in a dirty worktree.
3. Keep the normal web build working throughout.
4. Run risk-proportionate existing tests during development. Before committing or pushing, run both `npm test` and `npm run test:e2e` unless the user explicitly says not to.
5. Per repository policy, do not add or update tests for new feature behaviour until the user explicitly confirms that behaviour is correct. After confirmation, add appropriate coverage in a follow-up.
6. Do not manually bump `package.json`; semantic-release owns normal version changes.
7. Use Conventional Commit subjects for any commits.
8. Stop at each stage gate for a physical-device demonstration and user confirmation. Do not implement all stages as one unreviewable change.
9. Do not commit `.env`, keystores, signing passwords, OAuth tokens, WebDAV credentials, `dist-android`, APKs, AABs, or Gradle build directories.

## Stage 0: Baseline and implementation branch

### Work

- Confirm the preflight decisions above.
- Record current Node/npm versions and install dependencies.
- Confirm Android Studio, a compatible JDK, Android SDK, `adb`, and at least one emulator or physical device are available.
- Run the existing baseline before modifying anything:

```bash
npm install
npm test
npm run build
npm run test:e2e
```

- Make a current JSON backup from the hosted app before testing migrations against real data.
- Create a focused feature branch if requested, using the repository's `codex/` prefix convention.

### Gate

- Baseline web build and tests pass, or existing failures are recorded clearly before implementation begins.
- Permanent package ID is confirmed for any non-throwaway native project.

## Stage 1: Capacitor scaffold and first debug APK

### Work

1. Install the current compatible packages, using their official setup instructions:
   - `@capacitor/core` as a runtime dependency;
   - `@capacitor/cli` as a development dependency;
   - `@capacitor/android`;
   - only the official plugins actually used in this stage.
2. Initialize Capacitor with the confirmed app ID and display name.
3. Add Android and commit the generated `android/` project.
4. Add `dist-android` and native build outputs to `.gitignore`.
5. Add scripts similar to the following, adjusting names for the installed Capacitor version:

```json
{
  "build:android": "vite build --mode android",
  "android:sync": "npm run build:android && cap sync android",
  "android:open": "cap open android",
  "android:run": "npm run android:sync && cap run android"
}
```

6. Configure Capacitor with:
   - `webDir: 'dist-android'`;
   - `server.appStartPath: '/app/index.html'` if still supported by the selected version;
   - default secure local scheme/hostname settings;
   - no production `server.url`, because that would load a remote site.
7. Add an Android flag in `vite.config.js`, derived from `mode === 'android'`.
8. Set the Android build `outDir` to `dist-android`.
9. Refactor `createSiteMetadataPlugin` so its `closeBundle` logic does not hard-code `dist`. Preserve HTML placeholder replacement and the analytics privacy-section rewrite for bundled Android pages, while either passing the selected output directory or skipping only web-hosting artifacts such as runtime templates, robots, and sitemap files in Android mode.
10. In Android mode, omit `VitePWA` entirely. Do not generate or register a service worker in the packaged app.
11. Retain all current HTML inputs and the required `public/` assets. Do not create a separate Android HTML entry or change `APP_ROOT_PATH` from `/app/`.
12. Add an Android build verification that fails if:
    - `dist-android/app/index.html` is missing;
    - Capacitor is not configured to start at `/app/index.html`;
    - a production `server.url` is configured;
    - service-worker or Workbox files are present;
    - a non-empty Google client secret is embedded;
    - a release build lacks the expected HTTPS Umami script URL and selected Android website ID/tag;
    - a debug build points at production analytics without an explicit override.
13. Build and install a debug APK. Useful native commands will usually include:

```bash
npm run android:sync
cd android
./gradlew assembleDebug
```

Run shell commands separately in automation if necessary so errors are easy to attribute.

### Manual checks

- Fresh install opens the collections/app view, not the marketing page.
- A cold launch after force-stop or device reboot opens `/app/index.html`, even if the user was previously viewing About or another bundled page.
- Core navigation renders in light and dark themes.
- Assets resolve without 404s.
- Reload returns to a valid app route.
- The bundled marketing, privacy, tips, and BibleMemory guide pages can be opened deliberately without a server.
- Android Back returns from each bundled page to the app.
- The analytics Settings toggle appears when Android analytics is configured, and opting out stops app and bundled-page analytics requests.
- The normal `npm run build` output still contains the hosted PWA.

### Gate

The user can install a debug APK and open the existing app. This is a scaffolding preview only; do not encourage storing important data yet.

## Stage 2: Truly offline Android build and platform boundary

### Work

1. Add `src/platform/runtime.js` as the single authoritative platform detector.
2. Define a build-time/native capability that can be used to hide or replace web-only UI.
3. Update `usePWAInstall.js` so install prompts are never offered inside the native app.
4. Hide the service-worker "check for update" action in the Android build. Continue showing `__APP_VERSION__`; Android updates come from the Play Store or a replacement APK.
5. Bundle the fonts currently loaded from Google Fonts as local WOFF2 assets with appropriate license files and `@font-face` declarations. Remove external font requests from the Android HTML output.
6. Retain and adapt the Umami integration for Android:
   - select the confirmed Android website ID or tag at build time;
   - initialize only after the native analytics preference has loaded;
   - enrich custom event data centrally with `platform: 'android'` and `app_version`;
   - keep auto page tracking only if its local Capacitor hostname/path reporting is useful in the chosen Umami property; otherwise disable auto-track on Android and send normalized app pageviews explicitly;
   - make script load and event-send failures silent and non-blocking;
   - preserve immediate opt-out across the app and all bundled pages;
   - never use native HTTP to bypass an analytics opt-out or failed browser request.
7. Preserve the existing deliberate navigation to trusted bundled pages:
   - About may open the bundled marketing root;
   - Memorization Tips should open the bundled tips page;
   - BibleMemory import should open the bundled migration guide;
   - Privacy may open the bundled privacy page;
   - Android Back must return from those pages to the prior app route;
   - links to genuinely external origins should open in the system browser rather than navigating the privileged app WebView.
8. Add the Capacitor App plugin and integrate Android hardware back with the existing browser history/modal model. Preserve the current `popstate` logic. At the root view, either allow the normal Android exit behaviour or implement a deliberate exit affordance; do not make Back trap the user.
9. Replace Android's current `getMarketingPageUrl()` behaviour for Share App. `window.location.origin` will be a private Capacitor origin such as `https://localhost`; Android must share the canonical public website URL instead. Keep bundled navigation URLs relative and sharing URLs explicitly public.
10. Validate system-bar/safe-area handling, keyboard resizing, rotation policy, clipboard, sharing capability detection, vibration/haptics, and speech synthesis. Add a native adapter only where the existing Web API is unreliable.
11. Preserve the existing offline message for automatic Bible-text import. It is acceptable for that optional feature to require `fetch.bible`; manual paste must remain available.
12. Keep Google Drive hidden or explicitly unavailable in Android preview builds until native authorization exists. The presence of the bundled `gdrive-callback.html` does not make the web popup flow valid on Android.

### Manual checks

- Install the build, launch it once, enable airplane mode, force-stop it, and launch it again.
- Confirm every cold launch goes directly into `/app/index.html`, never the bundled marketing root.
- Add, edit, practice, review, search, and organize verses without network access.
- Exercise every modal and nested view with Android Back.
- Open About, Tips, Privacy, and the BibleMemory guide in airplane mode, then return to the same app route with Back.
- Confirm Share App sends the canonical HTTPS website URL rather than `https://localhost`.
- With analytics enabled and online, confirm app and bundled-page events reach the intended Android property/tag and are identifiable as Android.
- Opt out, navigate through the app and every bundled page, and confirm no further analytics requests are sent.
- Re-enable analytics, go offline, and confirm failed analytics loading/sending does not delay startup, display errors, or affect core use.
- Verify keyboard behaviour in verse entry and practice.
- Verify dark theme and system bars on at least one gesture-navigation device.
- Confirm no service-worker, Google Fonts, or rum1n8 application-host requests appear during offline core use. An opted-in build may attempt the configured Umami endpoint, but failure must be silent and bounded.

### Gate

The core app works in airplane mode and feels like a coherent Android shell. Data is still not considered production-safe until Stage 3.

## Stage 3: Durable native storage and migration

### Storage schema

Create a versioned snapshot containing only application data, not secrets. A possible starting shape is:

```json
{
  "schemaVersion": 1,
  "savedAt": "ISO-8601 timestamp",
  "verses": [],
  "collections": [],
  "appSettings": {},
  "appSettingsLastModified": null,
  "sync": {
    "activeProvider": null,
    "state": {},
    "deletedVerses": [],
    "deletedCollections": []
  }
}
```

Adjust this after inventorying every current durable key. Distinguish carefully among:

- valuable domain data;
- sync state/tombstones required to prevent deleted data from reappearing;
- durable user preferences;
- ephemeral UI/navigation state;
- credentials and tokens, which belong in secure storage and never in this snapshot.

### Work

1. Create web and native storage implementations behind a common asynchronous interface, such as:
   - `loadSnapshot()`;
   - `saveSnapshot(snapshot)`;
   - `loadPreference(key)` / `savePreference(key, value)` where justified;
   - `getSecret(key)` / `setSecret(key, value)` in a separate secrets service.
2. Refactor `main.js` into an asynchronous bootstrap that:
   - initializes the selected storage adapter;
   - performs schema/legacy migration;
   - loads the snapshot;
   - applies the native analytics opt-out before analytics initialization;
   - only then creates and mounts Vue.
3. Move direct durable `localStorage` calls out of:
   - `App.vue`;
   - `app-settings.js`;
   - `sync/sync-manager.js`;
   - `sync/providers/*.js`;
   - `ui-state.js` where the state is truly durable;
   - `migrate-storage.js`.
4. Keep the web adapter compatible with existing `rum1n8-*` browser keys so current PWA users do not lose data.
5. On Android, write an app-private file. Serialize writes through one queue so older async writes cannot finish after newer writes.
6. Use atomic replacement: write a complete temporary snapshot, flush/close it, then replace the previous snapshot. Retain a last-known-good copy if the chosen Filesystem API permits it safely.
7. Add schema versioning and fail safely on unknown future versions rather than overwriting them.
8. Add a one-time native migration that can import data left in the Android WebView's `localStorage` by Stage 1/2 preview builds. Mark completion only after the native write succeeds.
9. Flush pending saves when the app moves to the background, while keeping normal writes debounced enough to avoid excessive bridge traffic.
10. Choose a maintained Keystore-backed secret-storage plugin or implement a minimal Capacitor native plugin. Evaluate current maintenance and Android compatibility before adding a third-party dependency. Do not silently fall back to plaintext storage.
11. Make the same lightweight analytics preference available to `marketing.js` and the other bundled full-page entries. A navigation away from Vue must not bypass an opt-out stored in native Preferences.

### Failure handling

- A corrupt primary snapshot should not erase the last-known-good copy.
- A failed write must surface an actionable error and keep the in-memory state.
- An unknown schema version should put the app into a read-only/recovery path with export options if feasible.
- Uninstalling the app may remove app-private data; backup/sync remains the user's portability mechanism.

### Manual checks

- Create data, force-stop during ordinary use, and reopen.
- Reboot the device and reopen.
- Install a newer debug APK over the previous one and verify data remains.
- Simulate a write failure or corrupt snapshot in a debug environment and verify recovery behaviour.
- Confirm the hosted PWA still reads existing browser data.
- Confirm browser and Android storage are independent; migration between them is by backup/restore or sync, not magic shared storage.

### Gate

User data survives force-stop, reboot, and APK upgrade, and the user approves the storage behaviour. Only after that approval should new storage tests be added under the repository's testing policy.

## Stage 4: Native backup, restore, CSV, and credential hygiene

### Work

1. Add web and native file adapters.
2. Keep browser anchor-download behaviour for the hosted web app.
3. On Android, use official Capacitor Filesystem and Share capabilities where suitable. For importing, validate whether the existing `<input type="file">` correctly invokes the Android document picker. If it is unreliable, choose a maintained Storage Access Framework/file-picker integration.
4. Support:
   - save/share full JSON backup;
   - restore JSON backup from the Android picker;
   - import CSV;
   - export a collection CSV;
   - user cancellation without error noise;
   - safe filename and MIME handling.
5. Introduce a new backup schema version that excludes all provider credentials and tokens.
6. Continue accepting old backup versions, but ignore imported WebDAV passwords and Google access/refresh tokens. Restore harmless sync configuration only where safe, and tell the user to reconnect.
7. Review the current backup payload recursively to prove it contains no:
   - password;
   - Authorization header;
   - access token;
   - refresh token;
   - OAuth client secret.
8. Update privacy/user-facing copy to distinguish app-private storage from browser `localStorage` when running on Android and disclose opted-in anonymous requests to the self-hosted Umami endpoint.

### Manual checks

- Export a current web backup and import it into Android.
- Export from Android, inspect the JSON manually for secrets, and restore it into a clean Android install.
- Import and export CSV using Google Files and at least one other document provider if available.
- Cancel every picker/share flow.
- Attempt malformed, oversized, and unsupported files and verify clear errors without overwriting existing data.

### Gate

The Android app is safe for offline personal use without sync. Backup round trips are successful and exported data contains no credentials.

## Stage 5: Direct native WebDAV transport

### Architecture

Keep sync merge/conflict/tombstone logic shared. Only the transport and secret retrieval should differ:

```text
Shared WebDAV provider and sync merge logic
                  │
          platform HTTP interface
             ┌────┴────┐
             │         │
      browser fetch   Capacitor native HTTP
      current proxy   direct WebDAV URL
```

### Work

1. Add an HTTP interface that supports arbitrary methods, headers, text/JSON responses, timeouts, and useful status/error normalization.
2. For Android, use explicit Capacitor native HTTP requests for WebDAV. Do not globally patch `window.fetch` unless a measured requirement justifies the broader behavioural change.
3. Make Android `buildSyncFileUrl` target the configured WebDAV URL directly. It must never construct `https://localhost/api/webdav` or depend on `proxy-server.js`.
4. Preserve current browser production/development proxy behaviour.
5. Support and test `PROPFIND`, `GET`, and `PUT`, including Basic authentication, redirects, `207`, `401`, `403`, `404`, timeouts, and malformed responses.
6. Require HTTPS for release use. Do not enable global Android cleartext traffic merely to accommodate an insecure WebDAV server. If local HTTP development is necessary, isolate it to a debug network-security configuration.
7. Retrieve the WebDAV username/password from secure storage and keep it out of logs, snapshots, backups, and analytics.
8. Handle offline state without corrupting local sync state. Retrying a failed upload must be safe.
9. Test against the user's real WebDAV/Nextcloud instance, not only mocks.

### Gate

With the rum1n8 web host and proxy unavailable, Android can configure WebDAV, test the connection, upload, download, merge, delete, and recover from an interrupted sync.

## Stage 6: Native Google Drive authorization

This is the highest-risk integration stage. Research the current official Google recommendation at implementation time; OAuth rules and Android identity APIs change. Start with:

- <https://developers.google.com/identity/protocols/oauth2/native-app>
- <https://developers.google.com/identity/protocols/oauth2/policies>

### Non-negotiable security requirements

- Use an Android OAuth client registered to the final package ID and signing certificate fingerprints.
- Do not embed or send `VITE_GOOGLE_CLIENT_SECRET` from Android.
- Use a system browser or current official Android authorization API, not an embedded credential-collection WebView.
- Use PKCE and state/nonce validation where the selected flow requires them.
- Store long-lived credentials in Keystore-backed storage.
- Never export tokens in backups or logs.
- Retain the least-privilege `drive.file` scope unless requirements change.

### Work

1. Split authorization from the shared Drive file operations. Likely modules:
   - `gdrive-auth-web.js`;
   - `gdrive-auth-android.js`;
   - shared Drive request/file functions;
   - shared sync merge integration.
2. Evaluate maintained Capacitor plugins against current Google guidance. If none correctly supports the needed Drive scope, offline access, refresh behaviour, package/signature validation, and current Android API level, implement a narrow native Capacitor plugin around Google's recommended Android authorization library rather than accepting an insecure workaround.
3. Configure the Android OAuth client for both debug and release signing fingerprints as appropriate. Never use the debug credential in production.
4. Implement sign-in/authorization, cancellation, token refresh or reauthorization, sign-out, and revoked-consent handling.
5. Move Google tokens out of `localStorage` on Android.
6. Ensure the native build cannot accidentally include the web client secret. Prefer removing the frontend secret from the web architecture too; at minimum add a build assertion that fails if a native bundle contains it.
7. Reuse the current folder/file format and sync merge logic after authorization.
8. Verify account switching and app reinstall behaviour.

### Gate

On a release-like signed build, the user can authorize `drive.file`, sync, refresh/recover authorization, revoke access, sign out, and reconnect without a rum1n8 server or embedded secret.

## Stage 7: Release engineering and distribution

### Native project hardening

- Set the current required Android target SDK and a supported minimum SDK. Verify Play requirements at release time: <https://developer.android.com/google/play/requirements/target-sdk>.
- Keep cleartext network access disabled in release builds.
- Review exported activities, intent filters, deep/app links, backup rules, file providers, and WebView navigation allowlists.
- Prevent arbitrary external origins from navigating inside the privileged app WebView.
- Add final adaptive launcher icons, monochrome icon if supported, splash assets, display name, theme colours, and accessibility labels.
- Disable release WebView debugging and verbose token/sync logging.
- Confirm Android automatic backup policy does not copy secrets unintentionally. Explicitly exclude sensitive native storage if needed.

### Versioning

- Continue treating `package.json` as the source of the user-visible semantic version.
- Feed that value into Android `versionName` during the build rather than maintaining it manually in two places.
- Generate an always-increasing integer `versionCode` in CI. A GitHub workflow run number or a documented semver-to-integer mapping can work; prove that official releases can never reuse or decrease it.
- Do not manually bump `package.json`; keep semantic-release and Conventional Commits intact.

### Signing and CI

1. Create a release keystore under the user's ownership and store it outside the repository.
2. Put the encoded keystore and passwords in the approved CI secret store.
3. Configure Gradle to read signing material only from environment/CI inputs.
4. Add a workflow that:
   - installs the pinned Node/JDK/Android toolchain;
   - runs the web regression suites;
   - builds `dist-android`;
   - runs `cap sync android`;
   - runs Android lint/native tests where present;
   - builds a signed AAB and optional APK;
   - archives checksums and artifacts without exposing secrets.
5. Keep local debug builds unsigned by the release key.

### Play preparation

- Create current screenshots and store listing copy.
- Update the privacy policy for native storage, opted-in self-hosted Umami analytics, `fetch.bible`, optional WebDAV, and optional Google Drive.
- Complete the Play Data Safety form from actual behaviour, not assumptions.
- Provide a durable privacy-policy URL if Play requires one; this does not make the installed app server-dependent.
- Start with internal or closed testing, then stage production rollout.
- Test installation from Play as well as local `adb` installation because signing and deep-link behaviour differ.

### Gate

A signed AAB passes the closed test track. It upgrades over the prior installed build without data loss, uses the correct OAuth client/signature, and has an owned/recoverable signing process.

## Stage 8: Regression coverage after behaviour approval

This stage follows user confirmation of each implemented feature, in accordance with `AGENTS.md`.

### Web/unit coverage candidates

- platform adapter selection;
- snapshot schema validation and migrations;
- serialized/atomic save coordinator behaviour;
- credential stripping from all backup versions;
- legacy backup restore that ignores credentials;
- WebDAV URL selection for browser versus native;
- normalized native HTTP responses and errors;
- native-build exclusion of PWA/client-secret markers and validation of the intended Android analytics property/tag;
- Android analytics platform/version enrichment and sensitive-field rejection;
- opt-out initialization before both app and bundled-page analytics;
- Google authorization state handling at the JavaScript boundary.

### Native coverage candidates

- Gradle unit tests for any custom plugin;
- instrumentation tests for secure storage and lifecycle restoration;
- an emulator smoke test that launches packaged `/app/index.html`;
- optional Appium/Maestro tests only after manual flows are stable. Do not duplicate the complete Playwright suite immediately.

### Required regression runs before commit/push

Unless the user explicitly says otherwise:

```bash
npm test
npm run build
npm run test:e2e
npm run build:android
npx cap sync android
```

Also run the applicable Gradle checks from `android/`, such as `assembleDebug` and `lint`, using commands supported by the generated project.

## Manual Android acceptance matrix

Run this matrix on at least one physical phone and one emulator before release. Add more OS/WebView versions based on the generated Capacitor minimum SDK and the current user base.

### Installation and lifecycle

- fresh install;
- upgrade install preserving data;
- force-stop and reopen;
- reboot and reopen;
- background/resume during an edit and during sync;
- low-storage/write-failure recovery;
- uninstall/reinstall followed by backup restore.

### Offline core

- launch in airplane mode after initial installation;
- add/paste/edit/delete verses;
- collections, nested collections, and search;
- learn/memorize/master/review flows;
- review schedule and stats;
- light/dark/system theme;
- automatic Bible import shows an offline fallback while manual paste remains usable.

### Android interaction

- hardware/gesture Back through modals and views;
- keyboard resize and focus;
- system bars and display cutouts;
- clipboard, share, vibration/haptics, and speech;
- rotation/multi-window according to supported policy;
- external links open safely.

### Portability

- web backup to Android restore;
- Android backup to clean Android restore;
- Android backup to web restore;
- CSV import/export through multiple document providers;
- malformed backup rejection without data loss;
- exported JSON inspection proving credentials are absent.

### Sync

- WebDAV first upload, first download, merge, deletion, bad password, timeout, offline interruption, and retry;
- Google first authorization, cancellation, sync, token expiry/recovery, revocation, sign-out, account switch, and reinstall;
- two-device conflicts using Android plus the hosted web app.

## Known risks and mitigations

### `localStorage` migration touches many files

Risk: an attempted big-bang rewrite of `App.vue` and sync code can introduce silent data loss.

Mitigation: first introduce interfaces and characterize the existing key/schema behaviour. Move one category at a time, preserve the browser adapter, and require backup plus physical-device upgrade testing.

### Multi-page Vite build assumes web hosting

Risk: Capacitor opens the marketing page, post-build logic edits the wrong directory, or absolute paths break.

Mitigation: use `dist-android`, parameterize output paths, retain the trusted multi-page inputs and public assets, set `server.appStartPath` to `/app/index.html`, and smoke-test the packaged build rather than only `vite preview`.

### Android relaunches into bundled marketing content

Risk: Android restores a previously viewed About/marketing URL or configuration drifts, causing the launcher to open the marketing page instead of the app.

Mitigation: make `/app/index.html` an asserted Capacitor start path and manually test fresh launch, force-stop/relaunch, and reboot/relaunch after leaving the WebView on every bundled public page. Treat any cold launch outside `/app/` as a release blocker.

### Local and public origins are confused

Risk: Share App exposes `https://localhost/`, or an external website is opened inside the privileged Capacitor WebView.

Mitigation: keep bundled navigation relative, define the canonical public share URL explicitly, and open genuinely external origins in the system browser.

### Analytics reports the Capacitor origin or ignores opt-out on bundled pages

Risk: Android pageviews appear as ordinary `localhost` web traffic, debug builds pollute production metrics, or navigation to a bundled page initializes analytics before the native opt-out is loaded.

Mitigation: use a separate Android website ID or explicit Android tag, enrich custom events centrally with platform/version, use a debug property, load the native preference before initialization on every entry, and test requests after opt-out. Analytics failure must remain silent and must never block offline use.

### Analytics captures sensitive application data

Risk: future event properties accidentally include verse content, references, collection names, sync identities, remote URLs, filenames, or credentials.

Mitigation: keep aggregate event schemas, document forbidden fields, centralize platform enrichment, review new event payloads, and add sensitive-field rejection tests after behaviour approval.

### Service workers conflict with packaged releases

Risk: stale or partially cached PWA assets override the version bundled in the APK.

Mitigation: omit `VitePWA` completely in Android mode and hide service-worker update UI.

### Backups currently contain credentials

Risk: a portable plaintext file exposes WebDAV passwords or Google refresh tokens.

Mitigation: make credential-free backup schema and legacy sanitization a release blocker. Add post-confirmation automated tests that recursively reject secret fields.

### Native HTTP differs from browser fetch

Risk: response parsing, redirects, TLS errors, multipart bodies, or WebDAV methods behave differently.

Mitigation: use an explicit adapter, normalize results, test real `PROPFIND`/`GET`/`PUT`, and avoid global fetch patching.

### Google OAuth rules and plugins change

Risk: an outdated community plugin or redirect technique fails review or weakens security.

Mitigation: verify current primary Google documentation, use the final package/signing identity, prefer official authorization libraries, and write a narrow native bridge if necessary.

### Native and web data do not automatically share storage

Risk: users expect installed Android to contain their PWA data.

Mitigation: explicitly guide them through backup/restore or sync. Do not promise direct access to Chrome's PWA storage.

### Native plugin dependency churn

Risk: unmaintained plugins block future target-SDK upgrades.

Mitigation: minimize plugin count, prefer official Capacitor plugins, record why each third-party plugin was selected, and keep custom native bridges narrow.

## Documentation to update during implementation

- `README.md`: Android availability and installation path once real.
- `docs/developer.md`: Android prerequisites, commands, and common failures.
- `docs/hosting.md`: clarify that Android WebDAV does not use the deployed proxy.
- `public/privacy.html`: native storage, credential handling, and optional remote services.
- this document: mark completed stages and record deviations with reasons.
- a release/signing runbook that does not contain secret values.

## Definition of done

The standalone Android project is complete when all of the following are true:

- One repository builds both the existing hosted PWA and the Android app from shared Vue/domain code.
- The APK/AAB contains the existing trusted multi-page site, its HTML, JavaScript, CSS, icons, screenshots, and fonts, and has no production `server.url`.
- Every Android cold launch enters `/app/index.html`, never the bundled marketing root.
- Core memorization use works from that cold launch in airplane mode.
- Bundled About, Privacy, Tips, and BibleMemory guide navigation works without a rum1n8 server, and Back returns to the app.
- Share App uses the canonical public HTTPS URL rather than the Capacitor local origin.
- Android release builds send the existing anonymous aggregate analytics to the intended self-hosted Umami property/tag when enabled.
- The analytics opt-out applies immediately across the Vue app and every bundled page, survives relaunch, and prevents further analytics requests.
- Analytics is non-blocking and offline-tolerant and never contains user-authored content, sync identities, remote URLs, filenames, credentials, or tokens.
- Android does not register a service worker or expose the PWA install/update controls.
- Valuable Android data is authoritative in durable app-private native storage, not WebView `localStorage`.
- Data survives force-stop, reboot, and app upgrade.
- JSON and CSV import/export work through Android-native flows.
- Backups contain no passwords, access tokens, refresh tokens, authorization headers, or client secrets.
- WebDAV sync connects directly from Android without the rum1n8 proxy.
- Google Drive uses a supported native authorization flow with no embedded client secret.
- Secrets are Keystore-backed and excluded from Android backup/export.
- Existing web behaviour and tests remain healthy.
- A signed AAB upgrades correctly through a closed Play track.
- Privacy, Data Safety, signing, versioning, recovery, and release documentation are complete.

## Recommended delivery checkpoints

1. **Scaffold preview:** Stage 1; installs and opens, no real data.
2. **Offline UX preview:** Stage 2; core works in airplane mode, storage still provisional.
3. **Offline personal-use release:** Stages 3-4; durable data and safe backups, no sync required.
4. **WebDAV release candidate:** Stage 5.
5. **Full sync release candidate:** Stage 6.
6. **Play-ready release:** Stages 7-8 and the complete manual matrix.

Do not collapse these checkpoints. The fastest safe path is to make the offline app trustworthy before allowing OAuth and sync complexity to determine the architecture.
