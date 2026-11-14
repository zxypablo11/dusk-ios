# Dusk Desktop Gamer Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Windows Tauri Dusk use real desktop chrome (sidebar, playbar volume, titlebar) with performance mode on by default, without restyling into cyber/AI-slop.

**Architecture:** Stop forcing `html.is-mobile` in the Tauri bridge so existing desktop CSS in `styles.css` applies. Seed `muriel_perf_mode=1` on first desktop launch from the bridge. Touch no mobile Capacitor path; no new theme.

**Tech Stack:** Tauri 2, shared `www/` from `mobile/build.mjs`, `desktop/tauri-desktop.js`, existing Muriel/Dusk CSS tokens, Node `--test`.

**Spec:** `docs/superpowers/specs/2026-11-14-dusk-desktop-gamer-design.md`

## Global Constraints

- No cyber/neon/glow/HUD/glass restyle; layout + flags + perf default only (no-ai-slop).
- Do not add `is-mobile` on the Tauri host; Capacitor/iPhone keeps adding it.
- Reuse `muriel_perf_mode` / `body.perf`; no second “gamer mode” key.
- Do not invent tray, Discord, or mini-overlay in this plan.
- Prefer commits only when the user asks.

## Review Focus

- Fresh profile (`muriel_perf_mode` unset) on Tauri must land in perf mode without a toast spam loop.
- User who already set `muriel_perf_mode=0` must stay off after upgrade.
- Capacitor `is-mobile` path must still hide volume in the phone now-playing sheet.
- `prepare-www.mjs` must still inject `tauri-desktop.js` into `www/index.html`.
- Volume slider must remain the existing `#volume-slider` / `#btn-volume-mute` (no duplicate control chrome).

## File map

| File | Role |
|------|------|
| `desktop/tauri-desktop.js` | Host flags + first-run perf seed |
| `desktop/prepare-www.mjs` | Unchanged inject path (verify only) |
| `test/desktop-host.test.js` | Assert bridge contract |
| `DUSK.md` | Desktop section: chrome + perf default |
| `docs/superpowers/specs/2026-11-14-dusk-desktop-gamer-design.md` | Already approved; no code |

---

### Task 1: Desktop host flags + perf seed

**Files:**
- Modify: `desktop/tauri-desktop.js`
- Create: `test/desktop-host.test.js`
- Verify: `desktop/prepare-www.mjs` (read-only unless inject breaks)

**Interfaces:**
- Consumes: existing `window.electronAPI` polyfill surface; `localStorage`
- Produces: `document.documentElement` classes `is-tauri` + `is-windows` only (no `is-mobile`); `electronAPI.isMobile === false`; if `localStorage.muriel_perf_mode === null`, set `'1'` once at bridge init

- [ ] **Step 1: Write the failing test**

In `test/desktop-host.test.js` (Node `--test`):

```js
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const bridge = readFileSync(new URL('../desktop/tauri-desktop.js', import.meta.url), 'utf8');

test('tauri bridge does not force is-mobile', () => {
  assert.equal(/classList\.add\([^)]*['"]is-mobile['"]/.test(bridge), false);
});

test('tauri bridge keeps is-tauri and is-windows', () => {
  assert.match(bridge, /is-tauri/);
  assert.match(bridge, /is-windows/);
});

test('tauri bridge seeds muriel_perf_mode when unset', () => {
  assert.match(bridge, /muriel_perf_mode/);
  assert.match(bridge, /localStorage\.setItem\(\s*['"]muriel_perf_mode['"]\s*,\s*['"]1['"]/);
});

test('tauri bridge sets isMobile false', () => {
  assert.match(bridge, /isMobile:\s*false/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/desktop-host.test.js`  
Expected: FAIL on `is-mobile` and/or perf seed assertions (current bridge still adds `is-mobile`).

- [ ] **Step 3: Implement bridge changes in `desktop/tauri-desktop.js`**

- Delete `document.documentElement.classList.add('is-mobile')` and the comment about keeping mobile chrome.
- Keep `classList.add('is-tauri', 'is-windows')`.
- Keep `isMobile: false`.
- At bridge init (when Tauri is detected), if `localStorage.getItem('muriel_perf_mode') === null`, `localStorage.setItem('muriel_perf_mode', '1')`. Do not overwrite `'0'` or `'1'`.
- Do not add CSS, neon, or new chrome elements.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/desktop-host.test.js`  
Expected: PASS (all four).

- [ ] **Step 5: Rebuild www**

Run: `cd desktop && npm run build:www`  
Expected: `www/ ready for Tauri (tauri-desktop.js injected)`.

---

### Task 2: Docs + visual smoke (no restyle)

**Files:**
- Modify: `DUSK.md` (Desktop section ~94–113)
- Smoke: `desktop` via `npm run dev` (VsDevShell if needed)

**Interfaces:**
- Consumes: Task 1 bridge behavior
- Produces: documented desktop chrome + perf default; screenshot evidence optional under `desktop/` only if easy

- [ ] **Step 1: Update `DUSK.md` Desktop blurb**

State clearly: Windows uses desktop sidebar/playbar (volume visible); performance mode defaults on first launch; iPhone keeps `is-mobile`; no cyber restyle.

- [ ] **Step 2: Smoke-run the app**

Run: `cd desktop && npm run dev` (with VS Build Tools on PATH).  
Check: left sidebar (not bottom tabs), playbar shows volume mute+slider, titlebar min/max/close, `body.perf` or Settings performance switch on for a fresh profile.  
Screenshot if possible; if anything looks like new neon/glow chrome was added, remove it before finishing.

- [ ] **Step 3: Confirm iPhone path untouched**

Grep: `mobile/bridge.js` / `mobile/electron-api.js` still add or set `is-mobile` / `isMobile: true`. No edits required if already true.

- [ ] **Step 4: Re-run host tests**

Run: `node --test test/desktop-host.test.js`  
Expected: PASS.

---

## Self-review (plan vs spec)

| Spec item | Task |
|-----------|------|
| Stop forcing `is-mobile` | Task 1 |
| Volume via existing playbar | Task 1 (CSS cascade) + Task 2 smoke |
| Perf default on first desktop launch | Task 1 |
| No cyber restyle / no-ai-slop | Global + Task 1/2 constraints |
| DUSK.md update | Task 2 |
| iPhone unchanged | Task 2 Step 3 |
| Language detection | Explicitly out of scope (no task) |
