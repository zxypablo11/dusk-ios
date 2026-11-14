# Dusk App UI Polish Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans. Steps track the approved UI proposal.

**Goal:** Make song selection visible immediately and expose useful personal music in the app's empty search and home.

**Architecture:** A small browser/Node UI core owns validated local history and derives playback phases. Existing DuskCore adapters expose canonical track keys and search; mobile presentation subscribes to existing playback events and new completed-search/artist events.

**Tech Stack:** JavaScript, CSS, existing Node tests, esbuild and Capacitor.

**Spec:** `docs/superpowers/specs/2026-11-13-app-ui-polish-design.md`.

## Global Constraints

App only. No dependencies or website edits. Preserve user assets and executable-mode changes. Work in the current checkout on `codex/app-ui-polish`, based on `4c931be`, so the verified faster streaming work stays included. Preserve the existing player and profile-local storage.

## Review Focus

- Quick skips must clear the previous song's loading marker.
- A paused audio element during loading must still show loading.
- Stale search/artist responses must not populate history.
- Corrupt history, full storage and profile changes must not break music search.
- Hidden recent content and empty libraries must not create redundant home sections.

## Task 1: History and playback feedback

Files: create `mobile/dusk-ui-core.js`, `test/dusk-ui-core.test.js`; edit `app.js`, `mobile/dusk-mobile.js`, `mobile/build.mjs`.

Interfaces: `DuskUiCore.createHistory(storage)` returns `queries()`, `rememberQuery(query)`, `removeQuery(query)`, `clearQueries()`, `artists()`, `rememberArtist(artist)`. `playbackPhase(key,currentKey,loading,paused)` returns `idle`, `loading`, `paused` or `playing`. DuskCore adds `trackKey(track)`, `refreshTrackSelection()` and `search(query)`. Events `muriel:search` and `muriel:artist` carry only current successful results.

- [x] Write/run failing tests for history validation, bounded deduplication, persistence, profile isolation and playback-state precedence.
- [x] Implement the core and events/adapters; connect mobile playback markers and the empty-search history.
- [x] Run `node --test test/dusk-ui-core.test.js test/stream-playback.test.js test/profiles-core.test.js test/background-audio.test.js`.

## Task 2: Personal home and visual verification

Files: edit `mobile/dusk-mobile.js`, `mobile/dusk-mobile.css`, `locales/de-reviewed.json`, generated `dusk-locales.js`; update documentation.

- [x] Add compact continuation, translations, secondary ink and functional marker styles.
- [x] Build the locale/web bundle and inspect actual UI at mobile sizes, including greyscale hierarchy and keyboard access.
- [x] Run full Node suite and inspect task-only diff.
- [x] Obtain one independent review.
- [x] Commit/push task changes, build/download/inspect a new unsigned iPhone IPA and report remaining physical-device checks.

## Execution evidence

- Core history and UI integration tests: 21/21; related UI, locale, preferences, streaming and background-audio checks: 61/61.
- Final full Node suite: 356 tests, 350 passed, 4 failed, 2 skipped. The failures reproduce the baseline: trending library endpoint and three shell-dependent play-retry tests on Windows.
- Locale generation, JavaScript syntax checks and `node mobile/build.mjs` succeeded. The iPhone workflow also runs the UI/history, preferences and locale tests before building.
- Actual browser UI at 375×812, 390×844 and 844×390: successful artist/search history, rerun/remove/clear, reload persistence, rapid song selection, playing/paused/loading states and a playlist continuation entry. Keyboard Tab exposes a visible focus outline and Enter removes a query.
- Long titles keep the 14 px marker outside the truncated title. Colour and greyscale screenshots preserve the hierarchy of title, section and secondary text.
- Ruling: set the existing hero cover to full width after landscape testing exposed aspect-ratio shrinkage. This keeps the established artwork layout; the change is CSS only and was visually verified after rebuilding.
- User-file SHA256 snapshot remains unchanged. Preview music and playlist data are local browser test data. Physical iPhone interaction still requires a device check.

## Independent review and fixes

One read-only review of `4c931be..82f4964` found no critical issues and one important issue: a dismissed pending search could enter persistent history. It also found focus loss after history deletion, playlist recency following manual array order and a resume action announcing Play while it would pause.

All four were treated as functional issues and fixed in one pass. Twelve integration regressions exercise actual production search handlers, renderers and callbacks, with observed failures before the relevant fixes. Dismissal invalidates the request token and scheduled rendering; deletion restores adjacent-query/input focus; continuation labels follow the playback action; playlist choice uses save/creation metadata and legacy ID timestamps, independent of manual order. User edits update playlist save time; automatic artwork repair and library reordering do not. No re-review or deferred minor findings.

Build routing: the corrected ARM Mac run remained queued for several minutes. Use the official `macos-15-intel` runner from actions/runner-images; it runs the same native/UI tests and cross-compiles the same iPhone target.

## Delivered iPhone build

- Source: `6c3b58fbf9192587901585de3b5fe2e2a5293172` on `codex/app-ui-polish`.
- Successful workflow: https://github.com/zxypablo11/dusk-ios/actions/runs/43470903178.
- CI: 44/44 UI/history/preferences/locale tests, 38/38 streaming tests and native streaming tests passed; unsigned iPhone archive compiled and uploaded.
- Download: `dist-ipa/app-ui-polish/Dusk.ipa`, 3,026,098 bytes. SHA256: `123c268ad92a6921dd15d398ff8d16a760686324b26b4a0992cce7a03d6a30d7`.
- Inspected IPA: UI core, mobile script/CSS, app script and locales match the checked source; the UI core is included before mobile initialization; build metadata identifies the source commit. App `io.github.zxypablo11.dusk`, widget `io.github.zxypablo11.dusk.LyricsWidget`, display name Dusk, minimum iOS 16.2.
- Screenshots: `dist-ipa/app-ui-polish/ui-home.jpg`, `ui-search.jpg` and `ui-home-greyscale.jpg`.
- Physical-device checks remaining: tap-to-audio latency, native VoiceOver, background playback and rapid selection on an actual iPhone. The IPA needs signing for sideloading.

## Logo follow-up

The user supplied the DUSK logo and asked about its inclusion. The earlier UI IPA still used the committed headphones icon; the supplied logo was already prepared locally. The iPhone app icon now uses that version, including the DUSK wordmark, exported as an opaque 1024×1024 RGB PNG. Other user artwork and website files remain untouched.

- Source: `f35b7f2ccd729cccf7b211e3a74d02d865cc7729`.
- Successful build: https://github.com/zxypablo11/dusk-ios/actions/runs/43473653708; 44 UI tests, 38 streaming tests and native streaming tests passed.
- New IPA: `dist-ipa/app-logo/Dusk.ipa`, 3,222,332 bytes; SHA256 `9742979797e3c62fdd59369a676ab04c471645d65ffa8df5d15cd14bc6355b99`. The earlier IPA is preserved.
- The actual packaged iPhone icon was extracted and visually verified after decoding Apple's CgBI PNG format: `dist-ipa/app-logo/app-icon-preview.png` (120×120). App identity, iOS minimum, icon registration, source metadata and all five UI script/style/locale assets were verified.
