# Dusk Music — Windows

Tauri 2 shell around the shared web UI (`../www`). Same player as phone and browser; desktop chrome includes sidebar, playbar, volume, and optional Discord presence.

See the root [README](../README.md).

## Prerequisites

- Node 22+
- Rust (rustup) + MSVC build tools / WebView2

## Dev

```sh
cd desktop
npm install
npm run dev
```

## Release

```powershell
cd desktop
powershell -File scripts/build-windows.ps1
```

Or `npm run build` from a VS Dev Shell. The installer lands under the Cargo target `bundle/nsis/`.
