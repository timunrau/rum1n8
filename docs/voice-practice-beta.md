# Voice practice beta

Voice is an alternate, English-only input for Learn, Memorize, Master, and review. It uses the browser's `SpeechRecognition` or `webkitSpeechRecognition` implementation. The microphone control is hidden when neither exists. Selecting it starts listening and may request microphone permission.

## Attempt and saving rules

- Interim results only outline provisional matches. Final results advance the same display units as keyboard input.
- Final-result indexes are tracked per recognition instance. New instances, attempt changes, backgrounding, and aborts invalidate older callbacks.
- When a browser repeats the growing transcript in successive result entries, only the new suffix is matched. Separate result entries remain separate speech.
- Pause accepts final results for up to 1.5 seconds, then aborts. An unexpected browser ending restarts recognition automatically while the attempt is active; repeated immediate endings pause with a message. Errors require a tap to resume.
- Input changes keep completed units, typed reference digits, and mistakes. Pending speech is discarded.
- Mistakes are recorded before unit completion can finish a passage segment. The in-memory ledger distinguishes keyboard mistakes, automatic voice flags, and deliberate reveals.
- A completed voice attempt uses the regular completion tray. Retry discards the unsaved attempt and starts listening again. Done, Next Verse, or Continue saves the completed result, then moves on; listening starts automatically on the next practice item. Review attempts below 90% may still be saved at the user’s discretion.
- Combined-passage first attempts stay in memory until passage-end confirmation. Segments saved before switching to voice remain saved, and confirmed first-attempt grades survive retries.
- Navigation away from completed unsaved results offers Discard result and Stay. Refreshing or closing discards unconfirmed memory.
- No audio, transcript, or voice telemetry is persisted. The privacy page describes browser speech-service processing.

## Implementation

- `src/utils/practice-operations.js`: shared completion and save eligibility.
- `src/utils/voice/normalization.js`: explicit number, contraction, and homophone normalization with source offsets.
- `src/utils/voice/matcher.js`: bounded eight-unit alignment with subsequent anchors and conservative ambiguity handling.
- `src/utils/voice/spoken-reference.js`: canonical Bible book identities and structurally parsed spoken references, without splitting digit runs from the expected answer.
- `src/utils/voice/session.js`: content and reference matching across recognition results, with bounded buffers for unresolved speech.
- `src/utils/voice/recognition.js`: browser API lifecycle and revisable result lists.
- `src/components/VoicePracticePanel.vue` and `CompletionTray.vue`: centered capture controls and unified completion actions.
- `src/App.vue`: session coordination, attempt ledger, existing grading, and navigation guards.

The adapter follows the [Web Speech result-list and lifecycle specification](https://webaudio.github.io/web-speech-api/#speechreco-section). Correct matches from any supplied recognition alternative are accepted; worse guesses do not veto them. A recognizably different word counts as missed when later words locate the position, even if a shorter alternative ends early. A different final word may count as missed when no reference follows, or when a complete spoken reference locates the end. Silence and fillers do not count as mistakes. Uncertain alignment names the next word with “Continue from…” and preserves accepted words; recognizer shutdown never supplies missing trailing words. Unsupported imported references fall back to keyboard input without losing verse progress.

## Validation status

Implementation is available locally and has not been released. The production build, the unit suite, and the Chrome Playwright suite are the regression checks.

Behavior was approved, so deterministic automated coverage now exists:

- `src/utils/voice/normalization.test.js`, `matcher.test.js`, `spoken-reference.test.js`, `recognition.test.js`, and `session.test.js` cover number, contraction, punctuation, and homophone folding; content matching, anchors, alternatives, and mistake decisions; spoken reference parsing; and the recognition lifecycle adapter.
- `src/utils/verse-words.test.js` and `src/utils/practice-operations.test.js` cover content splitting, completion ordering, and voice-save eligibility.
- `e2e/specs/voice-practice.spec.ts` drives the app through a fake Web Speech API installed before bootstrap and covers control availability, revisable interim and final results, cumulative browser transcripts, substituted words, clean later alternatives, split spoken references, unsupported-reference keyboard fallback, automatic restart after a browser session ends, denied and silent microphones, stale callback rejection, input-mode switching, Retry, Next Verse, deferred review and passage saves, below-threshold saves, and the Learn → Memorize → Master ladder.

Behavior approval and automated coverage are complete. Temporary isolated Chrome demonstrations additionally exercised:

- Immediate listening when selecting voice, with interim-only previews.
- The unified completion tray: Retry discards the result, Next Verse saves it and starts listening on the next verse, and Done saves the final review once.
- A below-90% voice review saved through Next Verse, and Learn → Memorize → Master listening on each advance.
- A 92% unsaved result discarded with Retry, followed by a 100% retry saved through the completion tray.
- Uncertain recognition pointing to the next word and accepting continuation without losing prior progress.
- Whole-passage retry discarding unsaved segment grades and saving only the replacement attempt.
- Passage-end confirmation, separate segment grades, browser Back, and a reference split across final results.
- Partially typed reference numbers, a whole-number voice flag, manual retry, switching to keyboard, and rejection of late callbacks.
- Keyboard completion after voice still requiring a completion-tray save action, and discarding a retry without replacing the first grade.
- Mobile-sized light and dark layouts, including 360 × 640.

These demonstrations use synthetic browser recognition results. They are not evidence of real speech recognition quality or TWA compatibility.

## Required before release

- Exercise real Android Chrome and the installed TWA: permission grant/denial, natural pauses, long passages, each reference format, backgrounding, input switching, Read Aloud, and network failure.
- Exercise real desktop Chrome recognition and an unsupported browser.
- Confirm usable progression without cascading false mistakes, reliable reference completion, and no schedule changes before confirmation.

No Android device was attached to ADB during implementation; real-device acceptance is pending. Do not release based on the synthetic demonstrations or passing regression checks alone.
