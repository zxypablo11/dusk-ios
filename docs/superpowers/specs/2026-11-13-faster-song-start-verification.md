# Faster song start verification — 13 November 2026

Implementation branch: `codex/faster-song-start`. Base: `5348917`. Built code: `9558e031ce7bac818125fbfb7a250c4b1427e613`.

## Evidence

- Mac run: https://github.com/zxypablo11/dusk-ios/actions/runs/43451771221 — success.
- Native Swift tests: passed. Exercises playlist rewriting, initialization and relative URLs, HTTPS/encryption rejection, valid/suffix and invalid byte ranges, media host validation, playlist range probes, first-segment playback, shared segment cache, required headers and released-session 404.
- Related Node suite: 38 passed, zero failed, on both Windows and Mac. Exercises cached-first lookup, response before complete download, fallback, cancellation, offline-source sharing, quick-skip cleanup and mid-song position/loading recovery.
- Full Windows suite: 335 total, 329 passed, four failed, two skipped. The same failures existed before this work: Trending now in `library-endpoints.test.js`, and the three shell-dependent playback tests in `play-retry.test.js`.
- Web bundle: `node mobile/build.mjs` passed. Only the mobile/native playback path changed; no website or visual changes are committed.
- Independent read-only branch review: `streaming_review_available`; its three P2 findings are addressed. JavaScript regressions were observed failing before their fixes, then passing. The added native regressions pass in the final Mac run.
- First integrated Xcode build identified optional-array inference for Capacitor plugin methods. The explicit `[CAPPluginMethod]` type matches the existing vault plugin and compiles in the final build.

## Artifact

- Local file: `dist-ipa/faster-song-start/Dusk.ipa` — unsigned, for signing and sideloading.
- Size: 3,021,946 bytes.
- SHA-256: `a93c388f694aec5404ee76071a8229727e008447029699c9f3c272326a2dc97a`.
- Bundle: `io.github.zxypablo11.dusk`, display name Dusk, minimum iOS 16.2.
- Widget: `io.github.zxypablo11.dusk.LyricsWidget`.
- Archive checks passed for the compiled DuskStream plugin, streaming coordinator, download fallback and localhost ATS without global arbitrary-load permission.
- Previous IPA and pending user assets remain intact; existing executable-mode working-tree changes remain unstaged.

## Decisions and their costs

1. Retain the current ended/paused source for replay and seeking. A new selection releases it. Cost if wrong: one session remains until the next selection; the four-session and 32 MiB limits still apply.
2. Preserve the offline downloader's pre-existing byte-range handling. Cost if wrong: an uncommon rendition retains its existing fallback/failure limitation rather than receiving a separate downloader redesign.
3. Keep the four existing full-suite failures outside this startup change; the iOS build gates on all 38 relevant Node tests plus the native tests. Cost if wrong: those unrelated failures still need separate investigation.
4. Do not treat automated tests as an iPhone latency or locked-screen measurement. Cost if wrong: device-specific issues remain undiscovered until the checks below.

No deferred minor review findings.

## Required iPhone checks

1. Sign and install the new IPA; tap an uncached YouTube song and an uncached SoundCloud song. Compare tap-to-audio with the previous version on the same connection.
2. Tap several songs quickly during startup. Only the last selection may begin playback.
3. Seek forward/back, pause/resume, and replay an ended song.
4. Lock the screen during playback and during a song change; check lock-screen controls and background continuation.
5. Let a song finish caching, restart the app offline, and play it again.
6. Interrupt the network during streaming; check fallback, position recovery and a useful failure if no usable connection remains.

These checks remain unperformed: no physical iPhone is available in this workspace.
