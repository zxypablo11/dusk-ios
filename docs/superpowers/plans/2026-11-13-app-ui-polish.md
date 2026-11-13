# Dusk App UI Polish Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans. Steps track the approved UI proposal.

**Goal:** Make song selection visible immediately and expose useful personal music in the app's empty search and home.

**Architecture:** A small browser/Node UI core owns validated local history and derives playback phases. Existing MurielCore adapters expose canonical track keys and search; mobile presentation subscribes to existing playback events and new completed-search/artist events.

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

Interfaces: `DuskUiCore.createHistory(storage)` returns `queries()`, `rememberQuery(query)`, `removeQuery(query)`, `clearQueries()`, `artists()`, `rememberArtist(artist)`. `playbackPhase(key,currentKey,loading,paused)` returns `idle`, `loading`, `paused` or `playing`. MurielCore adds `trackKey(track)`, `refreshTrackSelection()` and `search(query)`. Events `muriel:search` and `muriel:artist` carry only current successful results.

- [x] Write/run failing tests for history validation, bounded deduplication, persistence, profile isolation and playback-state precedence.
- [x] Implement the core and events/adapters; connect mobile playback markers and the empty-search history.
- [x] Run `node --test test/dusk-ui-core.test.js test/stream-playback.test.js test/profiles-core.test.js test/background-audio.test.js`.

## Task 2: Personal home and visual verification

Files: edit `mobile/dusk-mobile.js`, `mobile/dusk-mobile.css`, `locales/de-reviewed.json`, generated `dusk-locales.js`; update documentation.

- [x] Add compact continuation, translations, secondary ink and functional marker styles.
- [x] Build the locale/web bundle and inspect actual UI at mobile sizes, including greyscale hierarchy and keyboard access.
- [x] Run full Node suite and inspect task-only diff.
- [ ] Obtain one independent review.
- [ ] Commit/push task changes, build/download/inspect a new unsigned iPhone IPA and report remaining physical-device checks.

## Execution evidence

- Core history and playback tests: 9/9; related UI, locale, preferences, streaming and background-audio checks: 49/49.
- Full Node suite: 344 tests, 338 passed, 4 failed, 2 skipped. The failures reproduce the baseline: trending library endpoint and three shell-dependent play-retry tests on Windows.
- Locale generation, JavaScript syntax checks and `node mobile/build.mjs` succeeded. The iPhone workflow also runs the UI/history, preferences and locale tests before building.
- Actual browser UI at 375×812, 390×844 and 844×390: successful artist/search history, rerun/remove/clear, reload persistence, rapid song selection, playing/paused/loading states and a playlist continuation entry. Keyboard Tab exposes a visible focus outline and Enter removes a query.
- Long titles keep the 14 px marker outside the truncated title. Colour and greyscale screenshots preserve the hierarchy of title, section and secondary text.
- Ruling: set the existing hero cover to full width after landscape testing exposed aspect-ratio shrinkage. This keeps the established artwork layout; the change is CSS only and was visually verified after rebuilding.
- User-file SHA256 snapshot remains unchanged. Preview music and playlist data are local browser test data. Physical iPhone interaction still requires a device check.
