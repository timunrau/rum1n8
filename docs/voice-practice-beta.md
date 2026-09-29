# Voice practice beta

Voice is an alternate, English-only input for Learn, Memorize, Master, and review. Speech is recognized on the user's own device by a sherpa-onnx WebAssembly streaming recognizer, replacing the browser's `SpeechRecognition` service. The microphone control is hidden when the browser cannot run the local engine. Selecting voice may request microphone permission and may offer a one-time model download.

## The offline model

The model is optional and never downloaded automatically, so installing Ruminate never waits on it.

- A first run in voice mode shows a one-time download of roughly 200 MB (`VOICE_MODEL_SIZE_LABEL`).
- The assets are versioned under `/voice-model/sherpa-en-v1.13.7/` and pinned by SHA-256 in `build/voice-model.mjs`.
- Downloading stores the assets in Cache Storage so the recognizer can read them offline. Cancel stops the download and removes partial cache entries. A download only counts as ready after every asset is cached and the worker has actually built a recognizer.
- The voice panel can remove the model again. Removing it clears the versioned cache.
- The model is Apache-2.0. `NOTICE.md` ships beside the assets, and `build/voice-model.mjs` records the source and license metadata.
- The service worker precaches the small worker and AudioWorklet chunks but never the 200 MB model.

Audio never leaves the device. Ruminate does not record or save audio, store transcripts, collect voice telemetry, or contact any third-party speech service.

## Capture and control

- The microphone is owned by the capture layer for the whole attempt, from Start to Pause. Pause, input-mode switches, backgrounding, and navigation all release the audio tracks immediately.
- A sherpa endpoint ends a decoded segment. It is not a control event: it must never set the button to Paused, close the microphone, or interrupt the user mid-verse. Natural pauses are the normal case.
- Pause responds immediately, then lets the worker settle any final segment it already decoded.
- A loaded model is kept warm across Pause so Resume is quick, and torn down after five idle minutes.
- Pause, Retry, input switching, completion, and leaving stop capture. The model guessing wrong never does.

## Matching and mistakes

Speech recognition omits, substitutes, and reorders words on ordinary readings of a verse. Those are recognizer errors, not memorization errors, so the matcher never reports `incorrect`.

- Every decision is `heard` or `bridged`. `heard` means the recognizer heard that display unit. `bridged` means a later distinctive phrase located the speaker past those words, which were accepted without proof.
- Reveal next word is the only way a voice attempt records a mistake.
- Bridging is bounded to eight units, and a two-unit anchor is required whenever another content unit is available, so a repeated word or a single trailing word cannot jump the passage.
- When several positions fit, progress stays pending and the recognizer keeps listening rather than guessing. Uncertain alignment still names the next word with "Continue from…".
- Alternatives are ranked by genuinely heard words first, then fewest bridges, then reach, so a clean shorter hypothesis beats a longer bridging one and a worse guess never vetoes a better one.
- Speech may cross a reference in one utterance. A misheard final content word is bridged once a full spoken reference locates the end; a partial reference stays pending.
- Unsupported imported references fall back to keyboard input without losing verse progress.

## Attempt and saving rules

- Interim results only outline provisional matches. Final results advance the same display units as keyboard input.
- Committed words never move backward. Attempt IDs invalidate in-flight callbacks on new attempts, backgrounding, and aborts.
- Input changes keep completed units, typed reference digits, and mistakes. Pending speech is discarded.
- Mistakes are recorded before unit completion can finish a passage segment. The in-memory ledger distinguishes keyboard mistakes, deliberate reveals, and voice input.
- A completed voice attempt uses the regular completion tray. Retry discards the unsaved attempt and starts listening again. Done, Next Verse, or Continue saves the completed result, then moves on; listening starts automatically on the next practice item. Review attempts below 90% may still be saved at the user's discretion.
- Combined-passage first attempts stay in memory until passage-end confirmation. Segments saved before switching to voice remain saved, and confirmed first-attempt grades survive retries.
- Navigation away from completed unsaved results offers Discard result and Stay. Refreshing or closing discards unconfirmed memory.

## Implementation

- `build/voice-model.mjs`: the pinned manifest, asset hashes, licenses, and notices shared by the build scripts and the browser.
- `scripts/prepare-voice-model.mjs`, `scripts/verify-voice-model.mjs`, `scripts/verify-voice-model-serving.mjs`: download, checksum, stage, and serving checks.
- `src/utils/voice/capability.js`: microphone, Worker, AudioWorklet, WebAssembly, and SIMD checks, with a SIMD probe rather than feature sniffing.
- `src/utils/voice/model-store.js`: Cache Storage download with progress, cancellation, storage headroom, and removal.
- `src/workers/voice/pcm-capture.worklet.js`: 16 kHz mono PCM batching.
- `src/utils/voice/audio-capture.js`: `getUserMedia`, worklet, and immediate track release.
- `src/workers/voice/asr-worker.js`: classic worker that owns the recognizer, reads the preloaded model from Cache Storage, and decodes in a dedicated thread.
- `src/utils/voice/local-recognition.js`: prepare, start, pause, finish, abort, dispose.
- `src/utils/voice/matcher.js`: bounded alignment, accept-only decisions, alternative ranking.
- `src/utils/voice/session.js`, `spoken-reference.js`, `normalization.js`: cross-result matching, spoken reference parsing, and number/contraction/homophone folding.
- `src/components/VoicePracticePanel.vue` and `src/App.vue`: capture controls, model download, session coordination, attempt ledger, grading, and navigation guards.

`getPreloadedPackage` in the pinned emscripten glue is synchronous, so the worker preloads model bytes into its own heap before instantiating. That is why the preload payload is read in the worker rather than on the main thread.

## Validation status

The production build, the unit suite, and the Chrome Playwright suite are the regression checks.

Automated coverage that exists today:

- `src/utils/voice/normalization.test.js`, `matcher.test.js`, `spoken-reference.test.js`, and `session.test.js` cover number, contraction, punctuation, and homophone folding; accept-only content matching, anchors, bridge bounds, alternatives, and spoken reference parsing.
- `src/utils/verse-words.test.js` and `src/utils/practice-operations.test.js` cover content splitting, completion ordering, and voice-save eligibility.
- `build/deploy-workflow.test.js` guards the deployment gate, which smoke-tests the model over real HTTP.
- `e2e/specs/voice-practice.spec.ts` drives the local adapter with a fake worker, microphone, and model cache. It covers capture state, matching, navigation, and saving without downloading the large model in CI.

This review also started the production worker in offline Chrome with the real cached model. The worker initialized without a network connection. The unit suite and all 26 voice-practice browser cases passed. The full browser suite passed 243 of 245 cases; two unrelated timeouts passed on rerun.

Earlier behavior was additionally exercised with synthetic browser recognition results, including the completion tray, Retry, Next Verse, below-threshold saves, the Learn → Memorize → Master ladder, whole-passage retry, passage-end confirmation, and mobile-sized layouts. Those demonstrations used the retired browser speech API and are not evidence of real recognition quality.

## Required before release

- Exercise real Android Chrome and the installed TWA on a Pixel 7: model download, permission grant and denial, natural pauses, long passages, each reference format, backgrounding, input switching, Read Aloud, and network failure.
- Exercise real desktop Chrome and an unsupported browser.
- Confirm usable progression without cascading false mistakes, reliable reference completion, and no schedule changes before confirmation.

No Android device was attached to ADB during implementation; real-device acceptance is pending. Do not release based on unit coverage or build checks alone.
