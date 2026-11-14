# Dusk Music

**A free music player for everyone.**

No ads. No account. No subscription. Stream from YouTube, YouTube Music, and SoundCloud, keep a local library, download for offline listening, and enjoy lyrics, EQ, and themes — on **Windows**, **iPhone**, **Android**, and in the **browser**.

Dusk Music is independent and open source ([MIT](LICENSE)). It does not host music. Use it for private listening, and only keep tracks you have the right to keep. See [LEGAL.md](LEGAL.md).

Built on [Muriel](https://github.com/cloverscripts/riff-muriel) and [Riff](https://github.com/rootscripts/riff).

![Dusk Music](design/dusk/app-integrated.jpg)

## Platforms

| Platform | How |
|----------|-----|
| **Windows** | Desktop app (Tauri) — sidebar, playbar, volume, optional Discord presence |
| **iPhone** | Sideload the IPA (Capacitor) |
| **Android** | Capacitor APK build |
| **Browser** | Local web preview of the shared UI |

One player core; each shell fits the device. Technical notes: [DUSK.md](DUSK.md).

## Quick start (browser)

Requires Node.js 22+.

```sh
npm ci
node tools/build-locales.mjs
node mobile/build.mjs
node mobile/dev-server.mjs
```

Open http://127.0.0.1:5173  
Run tests with `npm test`.

## Windows desktop

```sh
cd desktop
npm install
npm run dev
```

Release build:

```powershell
cd desktop
powershell -File scripts/build-windows.ps1
```

Details: [desktop/README.md](desktop/README.md).

## iPhone

Build an unsigned IPA (Actions or a Mac with Xcode), then sign it with your sideloading tool. See [DUSK.md](DUSK.md#phone-ios--android).

## Notes

Local files and confirmed streams work well. YouTube may still block some requests (“bot” / sign-in). Treat catalog streaming and offline YouTube as best-effort until you verify on your machine.
