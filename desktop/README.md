# Dusk Desktop (Windows)

Tauri 2 shell around the shared Dusk web UI (`../www`). Same player as phone and browser; desktop chrome (sidebar, playbar, volume, Discord presence).

Dusk is a free music player for everyone — see the root [README](../README.md).

## Prerequisites

- Node 22+
- Rust (rustup) + MSVC build tools / WebView2

## Dev

```sh
cd desktop
npm install
npm run dev
```

`npm run build:www` runs `mobile/build.mjs` and injects `tauri-desktop.js`.

## Release

```powershell
cd desktop
powershell -File scripts/build-windows.ps1
```

Or `npm run build` after entering a VS Dev Shell (needs `link.exe`). NSIS setup lands under the Cargo target `bundle/nsis/` (or `CARGO_TARGET_DIR` if set).
