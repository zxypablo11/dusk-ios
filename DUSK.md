# Dusk Music — technical notes

Shared web UI and player core, with thin shells for Windows (Tauri), iPhone/Android (Capacitor), and local browser preview. Product overview: [README.md](README.md). Rights: [LEGAL.md](LEGAL.md). Upstream history: [docs/UPSTREAM_README.md](docs/UPSTREAM_README.md).

## Layout

| Path | Role |
|------|------|
| `app.js`, `server.js`, `audio-engine.js`, … | Shared player, library, streaming |
| `dusk.css`, `dusk-themes.js`, `i18n.js` | Look, themes, DE/EN |
| `mobile/` → `www/` | Web bundle used by every shell |
| `desktop/` | Windows Tauri host |
| `ios/`, `android/` | Capacitor native projects |

`mobile/build.mjs` fills `www/`. Desktop injects `tauri-desktop.js` and clears phone-only `is-mobile`.

## Local preview

```sh
npm ci
node tools/build-locales.mjs
node mobile/build.mjs
node mobile/dev-server.mjs
```

http://127.0.0.1:5173 — then `npm test`.

## Windows desktop

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

See [desktop/README.md](desktop/README.md).

## Phone (iOS / Android)

```sh
npm ci
DUSK_BUNDLE_ID=io.github.zxypablo11.dusk bash tools/build-dusk-ios.sh
```

Unsigned IPA → sign with your sideloading tool. Workflow: `.github/workflows/dusk-ios.yml`.

## Design

Source comps live under `design/dusk/`.
