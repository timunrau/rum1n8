# Android TWA development

rum1n8's Android project is a Bubblewrap-generated Trusted Web Activity in `android-twa/`. It launches the hosted production PWA at `https://rum1n8.unrau.xyz/app/`; it does not bundle the Vue application or implement the separate standalone/Capacitor architecture.

## Fixed prototype decisions

- Origin: `https://rum1n8.unrau.xyz`
- Android application ID: `xyz.unrau.rum1n8`
- Display and launcher name: `rum1n8`
- Launcher and shortcut scope: `/app/`
- Display/orientation: standalone, portrait
- Unsupported-browser fallback: Custom Tab, never WebView
- Optional native delegations: disabled
- Bubblewrap CLI: `1.24.1`, isolated and pinned in `android-twa/package-lock.json`; its vulnerable transitive `tar` is overridden to patched `7.5.21`

The application ID and production origin become permanent once a signed build is distributed. Confirm both before creating the upload key or Play listing.

## Environment setup

Install the normal web dependencies and the isolated Bubblewrap toolchain:

```bash
npm install
npm run twa:setup
npm run twa:doctor
```

On first use, Bubblewrap offers to install its required JDK 17 and Android SDK. Review and accept the Android SDK terms yourself. Alternatively, configure existing installations with Bubblewrap's `updateConfig` command. Android Studio, `adb`, a current TWA-capable browser, and physical Android hardware are required for the acceptance gates.

## Verify and regenerate

The normal production build includes the launch-safety check:

```bash
npm run build
npm run twa:validate
```

Regenerate Android source only from `android-twa/twa-manifest.json`:

```bash
npm run twa:update
```

`twa:update` runs Bubblewrap in `android-twa/`, reapplies the deterministic `/app/` App Link restriction, builds the web app, and verifies every launch declaration. Bubblewrap otherwise claims the whole host and overwrites generated Android files, so do not run `bubblewrap update` from the repository root or hand-edit generated source.

## Build and install

For a locally installable debug APK:

```bash
npm run twa:build:debug
npm run twa:lint
npm run twa:install:debug
```

The Gradle wrapper reuses the JDK and SDK paths recorded by Bubblewrap. The debug APK is written to `android-twa/app/build/outputs/apk/debug/app-debug.apk`. It should open a Custom Tab until its signing certificate is associated with the production origin.

Pull-request and `main` CI runs compile and verify a debug APK to catch broken Android packaging, but do not retain or publish the artifact. Distribution builds are created locally so the upload key stays off GitHub. A debug APK can still be uploaded directly through Play Console's Internal App Sharing for quick testing. Google re-signs Internal App Sharing uploads, so use the SHA-256 fingerprint of Play's Internal App Sharing certificate in `assetlinks.json` when testing the trusted, full-screen presentation; a missing association intentionally falls back to a Custom Tab.

For unsigned release artifacts:

```bash
npm run twa:build:unsigned
```

For a signed release, keep the keystore outside this repository, ensure `android-twa/twa-manifest.json` has the intended alias, and provide passwords only through `BUBBLEWRAP_KEYSTORE_PASSWORD` and `BUBBLEWRAP_KEY_PASSWORD`:

```bash
npm run twa:version -- 2
npm run twa:build:release
```

Replace `2` with an integer greater than the last distributed Android `versionCode`; the command maps the current root `package.json` version to Android `versionName`. The committed signing path resolves outside the repository. A different path can be supplied with Bubblewrap's `--signingKeyPath` option from `android-twa/`. Never commit a keystore, password, service-account file, APK, or AAB.

Internal, closed, open, and production testing tracks use a signed Android App Bundle rather than the debug artifact. Create the upload key first, store it and its passwords outside the repository (or as protected CI secrets), run the signed release command above, and upload the resulting `.aab`. After Play App Signing is enabled, publish Play's app-signing certificate fingerprint—not merely the local upload certificate—in `assetlinks.json`.

## Digital Asset Links

Do not publish a placeholder statement. Once a real upload/release certificate exists, create the public directory and let the pinned Bubblewrap CLI record its SHA-256 fingerprint and generate the statement:

```bash
mkdir -p public/.well-known
cd android-twa
npm run fingerprint -- add "AA:BB:..." --name=local-release --manifest=twa-manifest.json --output=../public/.well-known/assetlinks.json
```

After enabling Play App Signing, repeat this for the Play app-signing certificate. The Play fingerprint is normally different from the local upload fingerprint. Commit only the public fingerprints and generated `assetlinks.json`, deploy them, and verify that the public endpoint returns 200 without a redirect and with `Content-Type: application/json`.

## Required gates before distribution

The generated repository project is an unsigned prototype. Before calling the TWA complete, follow the remaining gates and acceptance matrix in [the TWA implementation plan](android-twa-plan.md): verify a signed local build and Play-signed internal build, exercise core/import/export/sync/OAuth/device flows on physical hardware and a fallback browser, test offline-after-first-launch and first-launch-offline behaviour, and confirm the production monitoring/rollback process.
