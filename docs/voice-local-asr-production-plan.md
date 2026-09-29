# Production plan: local speech recognition for Recite Out Loud

## Assignment

Replace Ruminate's browser `SpeechRecognition` implementation with on-device, streaming English recognition for the existing voice practice feature. Keep live word feedback, make Pause reliable, and allow normal pauses during a verse. Speech processing must run on the user's device after an optional model download. Do not add a paid transcription service or require the user's server to transcribe audio.

This is a production feature, not a demo page. Implement it in the real Learn, Memorize, Master, and review flows. Preserve keyboard practice, completion confirmation, combined-passage behavior, and existing save rules. Work locally and on staging until the integrated feature passes the acceptance checks below. A push to `main` triggers production deployment through `.github/workflows/deploy.yml` and Watchtower; do not push an unaccepted candidate.

## Facts already established

- The installed Android TWA uses Brave on a Pixel 7. The existing Web Speech service ended and restarted roughly 11 times during a 45-second Matthew 6:31–33 attempt, causing gaps. `continuous = true` did not prevent this.
- A standalone Brave tab on that phone successfully loaded the English sherpa-onnx Zipformer WebAssembly demo. The user said a second, approximately 20-second recitation worked perfectly and the visible transcript covered nearly the whole passage. The first attempt was less accurate, and the user said they had recited that attempt poorly. This proves the model is promising on this phone; it does not prove integration, offline reload, battery life, or TWA behavior.
- The tested release was `sherpa-onnx-wasm-simd-v1.13.7-en-asr-zipformer.tar.bz2` from [the upstream v1.13.7 release](https://github.com/k2-fsa/sherpa-onnx/releases/download/v1.13.7/sherpa-onnx-wasm-simd-v1.13.7-en-asr-zipformer.tar.bz2). Its SHA-256 is `21559527d65f7674a45834870e4f51b0af14be27d4de1043aa6f576d9b426acc`. The browser loaded about 182 MiB of model data plus about 13 MiB of Wasm. The upstream [build workflow](https://github.com/k2-fsa/sherpa-onnx/blob/master/.github/workflows/wasm-simd-hf-space-en-asr-zipformer.yaml) identifies the underlying English model. Verify the runtime and model licenses, and include the required notices, before distributing their binaries.
- A small Vosk browser model was tried earlier and mangled this passage. Do not substitute that model merely because it is smaller.
- The upstream demo's `app-asr.js` is **demo UI code**: it uses deprecated `ScriptProcessorNode`, decodes on the main thread, and creates playable audio clips. Do not copy that capture/UI design into production. Use its result only as evidence about the model.

## Current code map

- `src/utils/voice/recognition.js` owns `SpeechRecognition`, permission probing, restarts, result deduplication, and the 1.5-second Pause delay. Replace this as the default voice engine. Do not keep its automatic restart loop as a hidden fallback.
- `src/App.vue` around `voiceSupported`, `voiceBuffers`, `consumeVoiceAlternatives`, `startVoice`, `stopVoice`, and `abortVoice` connects recognition to practice. The same voice panel is rendered for memorization and review. Preserve attempt IDs so late worker messages cannot affect another attempt.
- `src/utils/voice/matcher.js` can mark up to eight skipped words incorrect when it finds a later anchor. `src/utils/voice/session.js` and `spoken-reference.js` can also create incorrect decisions. This conflicts with the user's explicit preference: uncertain recognition should get the benefit of the doubt.
- `src/utils/voice/normalization.js` already removes punctuation and handles some contractions, numbers, and homophones. Punctuation characters are not themselves the cause of the Brave failure; natural pauses near punctuation exposed the recognizer's endpointing.
- `src/components/VoicePracticePanel.vue` displays Listening/Pause/Resume and still says speech may be processed online. `site/privacy/index.html` has the same old disclosure. Update both when local processing ships.
- `vite.app.config.js` has `publicDir: false`, an explicit static-asset list, and a Workbox precache pattern that excludes large model files. `Dockerfile.app` builds the app image. `nginx.app.conf.template` serves the app origin. Plan model delivery through these files rather than assuming a file under `public/` will automatically ship.

## Working sequence for the implementing model

1. Read this plan and `AGENTS.md`, confirm a clean `main`, and run `git pull --ff-only` before edits. Install dependencies with `npm ci` if needed.
2. Implement the asset preparation and worker initialization first. Demonstrate the pinned model working inside a Worker on the actual Pixel before changing verse grading. If this fails, diagnose it and report the specific blocker; do not present the original main-thread demo as the production implementation.
3. Add AudioWorklet capture and a minimal local transcript view behind the existing voice entry point. Use `npm run dev:app` and `adb reverse tcp:5173 tcp:5173` to exercise `http://localhost:5173/app/` on the phone without deploying. This browser-tab test is an intermediate check only.
4. Connect partial/final events to the generous matcher and existing practice flow. Test every state transition on the phone, then arrange the HTTPS staging TWA check described below.
5. Show the integrated candidate to the user. Wait for explicit approval of its **Ruminate** behavior before writing/updating new-feature tests. Complete the automated, build, offline, privacy, and TWA checks before proposing a production push.

## Target architecture

`microphone → AudioWorklet → PCM frames → dedicated Worker running sherpa-onnx → provisional/final text → generous verse matcher → existing practice/completion flow`

The browser owns the microphone from Start until the user taps Pause/Finish, navigates away, or completes the passage. A sherpa endpoint marks a transcript segment boundary; it must **not** close the microphone or change the button to Paused. Audio never goes to Ruminate's server or a third party. The server serves versioned static model files only.

### 1. Pin and deliver the model

1. Audit the upstream release and underlying model license. Pin a release URL, SHA-256, required notices, and exact asset names in a small manifest/script. Do not commit the roughly 192 MB `.data` file to Git.
2. Make the app Docker build download and checksum-verify the pinned archive, then install only the runtime JS, `.wasm`, `.data`, and notices under a versioned same-origin path such as `/voice-model/sherpa-en-v1.13.7/`. Exclude the upstream demo HTML and `app-asr.js`. Fail the build on a hash mismatch or missing file. Provide a local development command that prepares the same pinned assets without requiring a production deploy.
3. Add an explicit Nginx location for that path. A missing model file must return 404, never the `/app/` HTML fallback. Serve JS and Wasm with correct MIME types, long immutable caching for versioned URLs, and ordinary HTTPS through the existing app origin. Add a Docker smoke check for the model manifest and asset headers.
4. Keep these large assets out of the service worker's install precache. Add a dedicated versioned runtime cache and an explicit, cancelable “Download voice model” flow with real progress, retry, and a clear size warning (roughly 200 MB). Download only when someone opts into voice practice. Say “Available offline” only after **all** required assets are cached and can actually initialize without network access. Detect cache eviction or insufficient storage and offer a clean re-download. Do not make ordinary app installation wait for the model. See [Workbox guidance for large runtime assets](https://developer.chrome.com/docs/workbox/caching-resources-during-runtime) and [browser storage eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).
5. Version runtime and model assets together. Do not mix a cached old `.data` file with new JS/Wasm. Keep the last working model usable until a replacement is fully ready; clean obsolete caches deliberately.

### 2. Build a real-time, local recognition adapter

1. Put model creation and decoding in a dedicated Web Worker. First prove this upstream build initializes in a worker on the Pixel 7; the demo only proved main-thread operation. If it cannot, adapt/build an upstream-supported worker variant. Do not ship main-thread decoding merely because the demo used it.
2. Capture audio with `getUserMedia` and an `AudioWorklet`. The worklet should only gather/transfer small PCM batches; it must not run ASR, block the audio callback, or update Vue. Use the actual `AudioContext.sampleRate` and resample to the model's 16 kHz input if necessary. Avoid deprecated `ScriptProcessorNode`. [AudioWorklet runs on the rendering thread](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletProcessor).
3. Give the adapter explicit operations: prepare/load model, start, pause, finish, abort, dispose. Keep the loaded model across Pause/Resume so Resume is quick, but stop/release microphone tracks immediately on Pause, input-mode switch, backgrounding, or exit. Dispose the worker when the practice session ends or after an idle timeout. Preserve the existing behavior that leaving a completed but unsaved attempt asks before discarding it.
4. Send structured worker messages with a session/attempt ID and sequence number. Emit revisable **partial** text for display and **final** text at sherpa segment boundaries. Reset the recognizer's segment stream after an endpoint while the mic keeps capturing. Never append the same cumulative text twice. Ignore stale worker events after Pause, Retry, navigation, or a new verse. Clear unresolved transcript buffers on each intentional Pause/Resume boundary, after finalizing available speech.
5. Make control state reflect capture, not model guesses: Starting while permission/audio graph starts; Listening only while PCM is flowing; Paused immediately after the tap; Error with a useful Retry action when mic/model actually fails. Normal silence must not set Paused or start a new browser recognition session. A Finish tap may flush pending decoding asynchronously, but the control must respond immediately.

### 3. Replace automatic voice penalties with generous matching

1. Keep punctuation-insensitive comparison and useful contraction, number, and homophone normalization. Compare each provisional hypothesis without permanently revealing words; it may be revised. Apply permanent progress only from final segment evidence or an explicitly confirmed action.
2. **Do not create an incorrect practice decision solely because ASR omitted, substituted, or failed to recognize a word.** This includes the final content word and spoken-reference digits. Change `matcher.js`, `session.js`, and `spoken-reference.js` or introduce a separate voice-only matcher; leave keyboard grading intact. Only explicit Reveal (or another deliberate user acknowledgment of a miss) records a voice mistake in `attemptLedger` and `reviewMistakes`.
3. If a later distinctive two-or-more-word phrase clearly locates the speaker beyond uncertain words, advance across that gap as accepted/correct. This knowingly risks granting credit for a truly skipped word; the user prefers that over false penalties. Bound look-ahead and require context so a repeated “and” or isolated last word cannot jump across a passage. If multiple positions fit, leave progress pending and keep listening.
4. Keep live words appearing smoothly. Avoid flicker: partial text may outline likely next words; committed words never move backward. If the model hears a different phrase, do not show red errors. Offer a quiet “Continue from…” cue only when progress really stalls.
5. Do not stop at punctuation or silence. Auto-complete only after the ending **phrase** and any required spoken reference are confidently aligned. Add a visible Finish control as a fallback. Finish flushes available text; if words remain unresolved, offer Continue or an explicit “I said the rest” action that credits them without a penalty. Do not silently claim the model proved every word was spoken. Keep the existing completion tray and user confirmation before any schedule save.

### 4. Capability, copy, and privacy

1. Replace the `recognitionConstructor()` gate with checks for microphone access, Worker, AudioWorklet, WebAssembly SIMD, and successful model initialization. Show a useful keyboard fallback on unsupported browsers or model-load failure. Do not silently fall back to Brave's Web Speech service. The phone test only qualified Brave on one Pixel; WebAssembly does not guarantee enough memory/performance on every browser and device. [Emscripten SIMD support](https://emscripten.org/docs/porting/simd).
2. Update `VoicePracticePanel.vue`, `site/privacy/index.html`, and `docs/voice-practice-beta.md`: explain the optional large download, local processing, offline availability after download, and that audio/transcripts are not uploaded or retained. Verify the implementation matches this claim with network inspection during recitation. Do not log raw audio or transcripts in production diagnostics.
3. Model files are application assets, not user data. Do not place audio blobs in Cache Storage, IndexedDB, localStorage, or analytics. Stop and release all microphone tracks on every exit path.

## Verification and release gates

Implement in small increments and verify each layer before moving on: model loading in Worker; microphone capture and partial text; Pause/Resume and endpoint continuity; matching; full practice completion; offline and deployment. Keep a simple timing diagnostic that reports only state changes, decode time, and audio backlog, with no words or audio.

The repository's `AGENTS.md` says **do not add or update automated tests for a new feature until the user confirms its integrated behavior**. The standalone model demo approval is not approval of the finished Ruminate flow. Run the existing suites while developing, use temporary manual diagnostics, and have the user test the integrated candidate first. After that approval, add focused matcher/adapter tests and end-to-end coverage for the new engine, then run `npm test` and `npm run test:e2e` before any commit or push. Run Playwright with escalated permissions from the outset as `AGENTS.md` requires. Also run the app build and Docker smoke checks.

Physical-device acceptance must include all of these:

- Brave on the Pixel 7, reading Matthew 6:31–33 and another long punctuation-heavy passage at a natural pace, with 2–3-second pauses. There must be no unrequested Pause/Resume state change, no lost ending, and no false red words or automatic mistake count.
- Tap Pause during speech, immediately after speech, and during silence; then Resume. The button must respond immediately, mic capture must stop while paused, and accepted progress must remain. Repeat rapidly enough to expose stale worker callbacks.
- Complete a verse and spoken reference; Retry; switch to keyboard; navigate away; background/foreground; deny microphone permission; revoke permission; interrupt audio; and test combined-passage and review saves. No schedule change until the normal completion confirmation.
- Download the model once, restart the browser/TWA, switch off Wi-Fi/mobile data, and complete a passage offline. Then test a cleared/evicted model cache, low storage, interrupted download, and a version upgrade. The app must never falsely claim the model is ready offline.
- Measure first-load transfer/startup, warm Resume delay, partial-result delay, worker audio backlog, memory, and battery/heat during at least ten minutes of continuous recitation. Treat user-perceived stutter as a release failure even if transcripts are accurate.
- Check Chrome Android and at least one desktop browser. For browsers that fail capability or resource checks, verify a clean keyboard fallback; do not claim universal browser support.

Test the **installed TWA** before release. `http://localhost` in a Brave tab is useful for development but does not validate the TWA's origin, permission, or lifecycle behavior. Use an HTTPS staging origin with matching Digital Asset Links and a staging/debug TWA build, or another genuinely equivalent trusted TWA setup. Follow `docs/android-twa.md`; do not repoint the production package to an unverified local origin. If staging TWA verification cannot be arranged, report that as a release blocker rather than treating the browser-tab demo as sufficient.

When the integrated feature is accepted and all gates pass, use a Conventional Commit on `main`. Pull first, run both test suites, and remember that pushing `main` automatically publishes the app image and Watchtower deploys it. After deployment, verify model asset URLs, first-time download, offline retry, and a real recitation in the installed production TWA. Keep the previous app image SHA available for rollback. Do not bump `package.json` manually; semantic-release does that.

## Definition of done

The user can choose voice practice, download the model once, recite a full verse with natural pauses and live word feedback, Pause and Resume reliably, finish or confirm uncertain remaining words without automatic penalties, and save only through the existing confirmation flow. It works in the installed Brave TWA after the model is cached and the phone is offline. The model assets are reproducibly packaged, licensed, versioned, and served from the app origin; no speech is uploaded; failure modes return cleanly to keyboard practice. The user has approved the integrated behavior, automated coverage has then been added, and the release has passed the physical-device and deployment checks above.
