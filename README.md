# Dusk

**A free music player for everyone** — no ads, no account, no subscription.

Stream from YouTube, YouTube Music and SoundCloud, keep a local library, download for offline listening, lyrics, EQ, themes. Same soul on **Windows**, **iPhone**, **Android**, and in the **browser**.

Dusk is independent and open source ([MIT](LICENSE)). It hosts no music. Use it for private listening and only keep tracks you’re allowed to. Details: [LEGAL.md](LEGAL.md).

Based on [Muriel](https://github.com/cloverscripts/riff-muriel) by cloverscripts and [Riff](https://github.com/rootscripts/riff) by rootscripts.

![Dusk](design/dusk/app-integrated.jpg)

## Platforms

| | |
|---|---|
| **Windows** | Native desktop app (Tauri) — sidebar, playbar, volume, Discord presence |
| **iPhone** | Sideload IPA (Capacitor) |
| **Android** | Capacitor build |
| **Browser** | Local preview / shared web UI |

One shared player core; each shell adapts chrome to the device. Architecture and build notes: [DUSK.md](DUSK.md). Older Muriel desktop docs: [docs/UPSTREAM_README.md](docs/UPSTREAM_README.md).

## Try it (browser)

Node 22+:

```sh
npm ci
node tools/build-locales.mjs
node mobile/build.mjs
node mobile/dev-server.mjs
```

Open http://127.0.0.1:5173 — then `npm test`.

## Windows desktop

```sh
cd desktop
npm install
npm run dev          # needs the short dev server
# release:
powershell -File scripts/build-windows.ps1
```

More: [desktop/README.md](desktop/README.md).

## iPhone

Unsigned IPA via Actions or local Mac build — see [DUSK.md](DUSK.md#iphone-build). Sign with your sideloading tool before install.

## What works / what doesn’t

Playback, library, queue, favorites, playlists, themes, DE/EN — in good shape on desktop and in the browser. YouTube can still refuse streams (“bot” / sign-in). Treat catalog streaming and offline YouTube as best-effort until you’ve verified on your machine.
