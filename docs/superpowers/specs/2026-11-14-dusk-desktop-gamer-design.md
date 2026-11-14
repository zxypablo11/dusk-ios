# Dusk Desktop — Gamer shell (Approach B)

**Date:** 2026-11-14  
**Status:** approved  
**Scope:** Windows Tauri host + shared www UI chrome (not a new player stack)

## Intent

Make Windows Dusk feel like a **desktop music client for gamers**: real window chrome, visible volume, Dusk visual language — while staying **light on CPU/GPU** so it can sit beside a game.

## Goals

- Desktop layout (sidebar + bottom playbar), not phone-in-a-window
- Volume mute + slider always reachable in the playbar
- Keep Dusk branding/themes; do not revert to plain Upstream Muriel skin
- Default toward performance mode on desktop (visualizer/blur/heavy motion off)
- iPhone build unchanged (`is-mobile` stays for Capacitor)

## Non-goals

- Full Electron API parity (Discord, tray miniplayer v1, plugin host)
- Separate desktop CSS redesign / new design system
- macOS/Linux hosts
- Changing audio engine or streaming path

## Anti-goals

- Heavy visualizers or animated blur on by default
- Shipping phone bottom-nav / mini-player sheet as the primary desktop chrome
- Hiding volume because “phones don’t have it”
- **AI/KI-slop / “cyber gamer” skin** — no neon grids, HUD overlays, acid green, purple glow, glassmorphism chrome, hairline-rule dashboards, pill kits, or a new dark SaaS theme. “Gamer” means performance + desktop utility, not a cyber aesthetic.

## Visual constraint (no-ai-slop)

- **Single idea:** Dusk’s existing music UI, stretched to a real desktop shell — cover/content lead; chrome stays quiet.
- **Will not use:** cyber/neon accents; glow/glass on chrome; stacked grey cards / hairline structure for “desktop polish.”
- Reuse Dusk tokens/components already in `styles.css` / themes. This pass is **layout + flags + volume + perf default**, not a restyle.
- Greyscale test: sidebar + playbar + volume should still read as the existing Dusk player, just not phone-cropped.

## Approaches considered

| | Trade-off |
|---|---|
| **A** Classic Muriel desktop | Fastest; looks Upstream, not Dusk |
| **B** Dusk-desktop gamer-first *(picked)* | Desktop chrome + Dusk look + perf defaults |
| **C** Mini-overlay-first | Lightest in-game; weak for library/search as primary UI |

## Design (B)

### Host / class flags

- Stop forcing `html.is-mobile` in `desktop/tauri-desktop.js`
- Keep `is-tauri` / `is-windows`; `electronAPI.isMobile = false` (already)
- Shared www still used; phone CSS only applies when Capacitor adds `is-mobile`

### What the user sees

```
┌─ titlebar (min / max / close) ─────────────────────────┐
│ [Dusk]                          search…                 │
├────┬────────────────────────────────────────────────────┤
│ ■  │  main content (home / search / library / …)        │
│ ■  │                                                    │
│ ■  │                                                    │
│nav │                                                    │
├────┴────────────────────────────────────────────────────┤
│ ♪ cover  title · artist   ‹ ⏯ ›   ═══════○══  🔊════   │
└─────────────────────────────────────────────────────────┘
```

- Left sidebar (vertical icons), not bottom tab bar
- Bottom playbar with scrubber + **volume group**
- Titlebar controls wired (already bridged)

### Volume

- Rely on existing `#volume-slider` / `#btn-volume-mute` once mobile CSS no longer hides `.playbar-right` / `.volume-control-group`
- Confirm WebView2 element.volume works (desktop path already uses `audioEngine.setVolume`)

### Performance (gamer default)

- Prefer existing `muriel_perf_mode` / `body.perf` (caps FPS, kills viz/blur/heavy transitions)
- On first desktop launch, if unset: turn **perf mode on** (logic already leans this way when `getGpuCompositing` exists — keep/ harden for Tauri)
- Leave toggle in Settings so users can opt into pretty mode
- Builder call: do **not** invent a second “gamer mode”; reuse perf mode

### Language

- Unchanged: System → `navigator.languages` → `de`/`en` offline; Settings override
- No desktop-specific language detection work in this change

### Docs

- Update `DUSK.md` Desktop section: desktop chrome + perf default; phone UI is iOS-only

## Builder calls (settled here)

- Flag strategy: remove `is-mobile` on Tauri, don’t fork a third layout class
- Perf = existing perf mode default on, not new settings keys
- No tray/Discord in this pass

## Out of scope leftovers

- Compact mini player / always-on-top overlay (Approach C later)
- Media-key OS integration beyond what Web Media Session already does
