# Dusk — technical notes

Dusk is a **free music player for everyone**: one shared web UI and player core, with thin shells for Windows (Tauri), iPhone/Android (Capacitor), and local browser preview. Product overview: [README.md](README.md). License / rights: [LEGAL.md](LEGAL.md). Upstream Muriel docs: [docs/UPSTREAM_README.md](docs/UPSTREAM_README.md).

## Layout

| Path | Role |
|------|------|
| `app.js`, `server.js`, `audio-engine.js`, … | Shared player, library, streaming |
| `dusk.css`, `dusk-themes.js`, `i18n.js` | Look, themes, DE/EN |
| `mobile/` → `www/` | Web bundle used by every shell |
| `desktop/` | Windows Tauri host (desktop chrome, Discord presence) |
| `ios/`, `android/` | Capacitor native projects |

`mobile/build.mjs` fills `www/`. Desktop injects `tauri-desktop.js` via `desktop/prepare-www.mjs` and clears phone-only `is-mobile`. Capacitor keeps the phone chrome.

## Local preview (any OS)

```sh
npm ci
node tools/build-locales.mjs
node mobile/build.mjs
node mobile/dev-server.mjs
```

http://127.0.0.1:5173 — then `npm test`.

Useful slices:

```sh
node --test test/dusk-preferences.test.js test/i18n.test.js test/profiles-core.test.js test/library-import.test.js
```

## Windows desktop

Same `www/` UI with sidebar, playbar, volume. Performance mode (`dusk_perf_mode`) defaults on. Discord Rich Presence is off until enabled in Settings.

```sh
cd desktop
npm install
npm run dev
```

Release (MSVC / VS Build Tools + Rust):

```powershell
cd desktop
powershell -File scripts/build-windows.ps1
```

Or `npm run build`. Installer / EXE under the Cargo target `bundle/nsis/` and `release/`. Debug EXE alone needs the Tauri dev URL — use a release build for normal use. See [desktop/README.md](desktop/README.md).

## Phone (iOS / Android)

Capacitor wraps the same `www/`. iOS bundle id: `io.github.zxypablo11.dusk`.

```sh
npm ci
DUSK_BUNDLE_ID=io.github.zxypablo11.dusk bash tools/build-dusk-ios.sh
```

Unsigned IPA → sign with your sideloading tool. Workflow: `.github/workflows/dusk-ios.yml` (`workflow_dispatch` only). Public build repo historically: https://github.com/zxypablo11/dusk-ios

Mobile UI: `mobile/dusk-mobile.js` / `mobile/dusk-mobile.css`. Streaming helpers: `mobile/stream-playback.js` and native `DuskStream*` on iOS (HLS / loopback proxy). Android / non-HLS paths use the shared download route.

## Features (shared)

- DE/EN with auto locale; themes (Graphite, Obsidian, Cobalt, Violet, Ember, Ice + custom editor)
- Discover, library, search, player, queue, favorites, playlists, downloads
- Lyrics, EQ / sound presets, profiles, sync hooks (as in upstream)

YouTube may still block some fetches (“bot” / sign-in). Local files and confirmed streams are the reliable baseline until you’ve checked on your device.

## Design

Figma (personalization board): https://www.figma.com/design/0yMqrWseFEJHvPok1JpEtA/Dusk-iPhone?node-id=2-3  
Source comps: `design/dusk/`.
