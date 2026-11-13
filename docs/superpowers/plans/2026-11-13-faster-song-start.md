# Faster Song Start Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Begin uncached iPhone HLS playback before the whole audio file finishes downloading, with the existing download route as fallback.

**Architecture:** A cache-only server lookup preserves existing offline behavior. A mobile coordinator resolves the source and starts a native loopback HLS proxy. The proxy retains request headers and shares segment responses with the existing offline downloader; the player and its retry path remain authoritative.

**Tech Stack:** JavaScript, Node test runner, Capacitor 8, Swift/Foundation/Network, esbuild.

**Spec:** `docs/superpowers/specs/2026-11-13-faster-song-start-design.md`

## Global Constraints

- iPhone first; desktop and Android retain their existing paths.
- No new npm dependencies and no visual or website changes.
- Preserve complete-file offline caching and the existing audio element.
- Bind the native proxy to loopback and accept opaque identifiers only.
- Preserve existing local logo/icon changes without committing them as part of this work.

## Review Focus

- Skipping during resolution or native startup cannot return stale audio or leak its session.
- A cached track never starts a remote request.
- Streaming failures and non-HLS sources use the old complete-download route.
- Cache work and playback share a stream session; changing tracks releases it only after both finish.
- Native resources preserve required headers, relative HLS URIs, byte ranges, and reject encrypted/non-HTTPS sources.

### Task 1: Streaming coordinator and player integration

**Files:** Create `mobile/stream-playback.js` and `test/stream-playback.test.js`; modify `mobile/bridge.js`, `mobile/shims/child_process.js`, `server.js`, `app.js`.

**Interfaces:** `createStreamPlayback({call, resolveAudio, plugin, log})` produces `lookup(url, init)`, `started(streamId)`, `release(streamId)`, `downloadSource(target, audio)`. Native plugin consumes `start({url,headers})` and `stop({id})`, returns `{id,url}`. Stream answers contain `mobileStreamId`, `isHls:true`, and the loopback URL.

- [x] Write and run failing tests for cached-first lookup, response before complete download, unsupported-source/error fallback, abort-before/after-native-start, shared offline source, release after caching, and cache-only endpoint.
- [x] Implement the coordinator, connect native iOS only, preserve retries and bound startup stalls.
- [x] Run `node --test test/stream-playback.test.js test/youtube-opus.test.js test/soundcloud-hls.test.js test/background-audio.test.js test/stream-proxy-17.test.js`.

### Task 2: Native HLS proxy and build verification

**Files:** Create `ios/App/App/DuskStreamProtocol.swift`, `ios/App/App/DuskStreamPlugin.swift`, `tools/test-dusk-stream.swift`; modify `ios/App/App/AppDelegate.swift`, `ios/App/App/Info.plist`, `ios/App/App.xcodeproj/project.pbxproj`, `tools/build-dusk-ios.sh`, `DUSK.md`.

**Interfaces:** `DuskStreamProtocol` parses bounded HTTP requests and rewrites HLS resources. `DuskStreamPlugin.start/stop` follows Task 1. The proxy shares concurrent requests, keeps bounded segment data, and releases tasks and sockets on stop.

- [x] Write portable Swift tests for relative/absolute segment URIs, initialization segments, opaque identifiers, invalid requests/ranges, encrypted and non-HTTPS playlists.
- [x] Implement and register the native plugin, add localhost-only ATS support and the Swift test runner to the Mac build.
- [x] Build locales and the web bundle, run the relevant tests and full existing Node suite, inspect the complete diff, and obtain one independent code review.
- [ ] Verify the Swift tests and iOS compilation on a Mac runner if GitHub access is available; otherwise report that native compilation remains unverified.

## Execution note

Implement in the current checkout on `codex/faster-song-start` to retain installed dependencies and pending user assets. The user approved implementation; no additional execution-method confirmation is needed. Only this task's files are staged/committed. Device playback remains a required follow-up validation, not a claim made by automated tests.
