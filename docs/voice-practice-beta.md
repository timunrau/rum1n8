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

## Field feedback: words after natural silence (2026-09-30)

- During normal recitation, a natural silence can leave the next word unrecognized or unaccepted, especially when that word is the last one in a verse. Repeating just that correct word may still leave progress stuck. A lone wrong word also does not register as a mistake.
- Voice practice must feel seamless. Do not ask the speaker to correct a transcript, inspect what the recognizer heard, use recognition controls, or follow a special repeat procedure. Normal pauses and single spoken words should work without extra interaction.
- Capture already remains continuous through natural silence. The worker currently declares an endpoint after a short quiet interval (0.6 or 1.0 seconds under its configured rules), emits a final segment, and resets the recognizer's stream. The pinned transducer reset preserves limited internal state, but the app no longer has the preceding words in the new segment's transcript. This segmentation may contribute to the problem; it has not yet been confirmed as the cause on the user's device.
- Investigate whether extending or disabling automatic endpointing improves isolated-word recognition while retaining live progress and bounded resource use. Disabling it alone would leave only cumulative partial results under the current worker contract, so committing stable words and avoiding duplicates would also need redesign. Compare actual recognition output with matching decisions during natural pauses, using developer-only, temporary diagnostics that never become part of the speaker's flow. Do not infer a mistake from silence or an empty recognizer result.
- For local real-microphone trials, start the app dev server and open `/app/?voiceDebug=1`. The browser console then receives opt-in, development-only `[voice debug]` lines for capture status, audio level, recognizer partial/final text, endpoint count, and matcher decisions. This trace stays in browser memory and is not uploaded or saved by the app. Add `&voiceEndpoint=long` to compare a 3–4-second silence threshold and a 60-second maximum segment against the default endpoint rules; this override exists only in development mode.
- A local microphone trial of Genesis 3:15 reached the final word after natural silence. The microphone trace showed clear audio, the recognizer transcribed the intended “heel” as “MEAL,” and the matcher left “MEAL” pending at the final content word. This confirms a recognizer error in that instance; the isolated-word matching policy then prevented progress. The trace alone does not prove whether endpoint timing caused the recognizer error.
- Two subsequent local attempts with the development-only long endpoint setting both transcribed the final “heel” as “HEEL” and accepted it. In one attempt it appeared with the preceding phrase; in the other it arrived as its own segment. One earlier word in each attempt was transcribed as “IN” where the verse expects “and” and counted as a replacement. These trials support further testing of longer endpointing, but they do not establish that it alone solves isolated-word recognition or false penalties.
- Another long-endpoint local trial completed the verse and accepted “heel.” The recognizer returned “MMETRY” where the verse expects “enmity” and “SEAT” where it expects “seed”; the matcher marked both as replacements. The speaker's intended isolated midverse word was not identified in the trace, so that particular pause test needs their clarification before drawing a conclusion.
- A controlled long-endpoint trial isolated “enmity” after a natural pause. The recognizer finalized “AND I WILL PUT,” then finalized “ENMITY” alone, and the matcher accepted that word at the current cursor. The completed trial scored 89.3% because the recognizer returned “IN,” “SEAT,” and “PRESS” where the verse expects “and,” “seed,” and “crush”; the matcher marked all three as replacements. Whether each was spoken correctly cannot be established from the transcript alone. The next engineering question is how to avoid unjustified penalties without asking the speaker to inspect or correct recognition output.
- The pinned sherpa transducer supports `modified_beam_search` as well as the current `greedy_search`. A development-only `&voiceDecoder=beam` switch allows a local microphone comparison, including decode backlog and recognition quality, with `&voiceEndpoint=long`. This trial uses no verse-specific hotwords: boosting expected words could conceal a real mistake. Keep the speaker's flow free of recognizer controls or transcript correction. Do not promote the decoder or endpoint setting to production until the trial shows an improvement without unacceptable lag.
- In the completed long-endpoint beam trial of Genesis 3:15, the recognizer kept “enmity” after the pause and recognized “crush” correctly. It still returned “SEAT” for the first “seed” and “PEEL” for the final “heel”; the matcher recorded two replacements and the UI showed 92.9% accuracy. Decode backlog remained zero in the debug trace. The entire 24-second reading was one segment, so progress stayed provisional until the trailing silence finalized it. This shows that extending the endpoint and changing decoding method do not by themselves prevent false penalties, even with preceding verse context. The next implementation needs an evidence policy for uncertain words and timely progress from stable hypotheses; it must still detect genuine errors without requiring transcript correction or recognizer controls.
- A further local-only prototype is available with `&voiceBias=verse` alongside `voiceDebug=1`. It supplies unique content words from the displayed verse to sherpa's modified beam decoder with a modest hotword score. The bundled English model lacks the BPE vocabulary sherpa needs to encode those words; `src/utils/voice/zipformer-bpe.vocab` was generated from the [source model](https://huggingface.co/marcoyang/icefall-libri-giga-pruned-transducer-stateless7-streaming-2023-04-04)'s `data/lang_bpe_500/bpe.model` with sherpa's `export_bpe_vocab.py` method. All 500 vocabulary pieces match the bundled token table, and the source `tokens.txt` matches the bundled one byte-for-byte. The worker loads this small vocabulary only for the local trial and rebuilds its recognizer when the verse vocabulary changes, while keeping the downloaded model assets in the same worker. Debug finals report `hotwordsCount` and `biasTokens` so the trial can tell whether the context graph participated. This is an experiment, not a scoring rule: test both correctly spoken “seed”/“heel” and a deliberately different word. Reject the bias if it turns a genuine wrong word into a match, even if it improves recognition of the expected words. No speaker-facing controls or transcript correction are added.
- In the first verse-bias trial, the speaker actually said “seed” for the first “seed” and said the final “heel” correctly. The recognizer finalized “ENMITY” alone after the pause, misheard that “seed” as “SEAT,” and returned “HEEL” at the end. Matching falsely marked the correctly spoken “seed” wrong; the UI showed 96.4% accuracy even though the speaker reports no mistake. An earlier interpretation that “seat” was deliberate was incorrect. Every final reported `hotwordsCount: 16` but `biasTokens: 0`, including words present in the hint list. Thus this run does not demonstrate that contextual bias caused the improvement over the earlier beam trial. Debug finals now also report `contextScoreCount`, and worker initialization errors are logged in the opt-in trace, to distinguish an absent context graph from one that never scored a token. No production behavior should change based on this comparison.
- For a longer local trial, add `&voiceTrial=1` to a `voiceDebug=1` URL. The development-only trial suppresses practice-result saves and SRS changes through the shared save eligibility gate, while Next Verse still advances through the collection and starts voice practice. Debug lines include verse ID/reference, and each completed verse logs its displayed accuracy, mistake count, and unit count. Read several verses naturally with ordinary pauses and use Next Verse; no user transcript correction or recognizer controls are involved. Compare the trace against what the speaker reports actually saying, since recognized text alone cannot establish a true mistake.
- In a five-verse local trial with long endpointing and verse bias, the UI reported Genesis 3:15 at 92.9% (2 marked words), Genesis 17:4–8 at 97.5% (3), Genesis 22:17–18 at 98% (1), Exodus 19:5–6 at 100%, and Exodus 20:12 at 100%. That is six marked units among 262 displayed units, or 97.7% as an aggregate *app score*. It is not a measured recognition accuracy: the trace contains recognizer text and matcher decisions but no ground truth for these six words. A separate verse-bias trial already established one false penalty when correctly spoken “seed” became “SEAT.”
- The five-verse bias diagnostic did not establish that hotwords helped. Every final had a positive `contextScoreCount` but `biasTokens: 0`; the former means a context graph object was attached, not that it contained usable word paths. In [the pinned sherpa decoder](https://github.com/k2-fsa/sherpa-onnx/blob/v1.13.7/sherpa-onnx/csrc/online-transducer-modified-beam-search-decoder.cc), `context_scores` are per-token scores on the selected hypothesis, and a nonzero score is emitted when that path receives a context bonus. Zero observed bonuses leave the bias effect unverified; an empty graph, tokenization mismatch, or no hotword path selected are still possible. Do not promote verse bias or credit it for these scores until the graph and a controlled comparison are verified.
- The speaker also reported a delay before wrong words appeared. Complete final-word phrases were visible in partial hypotheses, but the app committed only final segments after roughly three more seconds of quiet. Decode backlog stayed at zero. This identifies endpoint/commit timing as the visible delay; it does not explain the six marked words. Finish the accuracy and bias investigation before changing completion timing.

## Matching and mistakes

Speech recognition can omit or mishear words. When a later phrase locates a gap in the verse, the matcher counts the words in that gap as missed instead of crediting words it did not hear. A clearly transcribed replacement also counts as a mistake when the surrounding words locate it. A recognizer omission can therefore cause a false penalty; this version does not verify the underlying audio.

- Decisions are `heard`, `bridged`, or `replaced`. `heard` means the transcript matched the display unit. `bridged` means context located the speaker past a verse word without proving it was spoken; this now counts as a missed word. `replaced` means a distinct word occupied that unit between direct matches, so it counts as a mistake. Spoken-reference units retain their more forgiving rules.
- Filler or repeated words are ignored when the expected word follows them. When later context shows that the expected word was skipped, that word counts as missed. Reveal next word also records a mistake.
- Bridging is bounded to eight units. A two-unit anchor is required when another content unit follows; a single final word can locate a bounded gap, but those skipped words count as mistakes.
- When several positions fit, progress stays pending and the recognizer keeps listening rather than guessing. Uncertain alignment still names the next word with "Continue from…".
- A different final word counts as a mistake when it follows directly heard words in the same decoded segment. A final word recognized alone may still remain pending because it has no surrounding context.
- Alternatives are ranked by genuinely heard words first, then fewest inferred mistakes, then reach, so a clean shorter hypothesis beats a longer one with a gap and a worse guess never vetoes a better one.
- Speech may cross a reference in one utterance. A distinct replacement or omission of the final content word counts as a mistake when a full spoken reference anchors it. A partial reference stays pending.
- A fully parsed different book or distant reference number counts as a mistake. Nearby number mismatches are accepted as uncertain because the recognizer can confuse similar spoken numbers.
- Unsupported imported references fall back to keyboard input without losing verse progress.

## Attempt and saving rules

- Interim results show matching words provisionally. Final results advance the same display units as keyboard input.
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
- `src/utils/voice/matcher.js`: bounded alignment, conservative replacement detection, alternative ranking.
- `src/utils/voice/session.js`, `spoken-reference.js`, `normalization.js`: cross-result matching, spoken reference parsing, and number/contraction/homophone folding.
- `src/components/VoicePracticePanel.vue` and `src/App.vue`: capture controls, model download, session coordination, attempt ledger, grading, and navigation guards.

`getPreloadedPackage` in the pinned emscripten glue is synchronous, so the worker preloads model bytes into its own heap before instantiating. That is why the preload payload is read in the worker rather than on the main thread.

## Validation status

The production build, the unit suite, and the Chrome Playwright suite are the regression checks.

Automated coverage that exists today:

- `src/utils/voice/normalization.test.js`, `matcher.test.js`, `spoken-reference.test.js`, and `session.test.js` cover number, contraction, punctuation, and homophone folding; content replacements, uncertain gaps, bridge bounds, alternatives, and spoken reference parsing.
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
