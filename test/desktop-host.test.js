import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const bridge = readFileSync(new URL('../desktop/tauri-desktop.js', import.meta.url), 'utf8');

test('tauri bridge does not force is-mobile', () => {
  assert.equal(/classList\.add\([^)]*['"]is-mobile['"]/.test(bridge), false);
});

test('tauri bridge clears is-mobile from mobile-bridge', () => {
  assert.match(bridge, /classList\.remove\(\s*['"]is-mobile['"]\s*\)/);
});

test('tauri bridge keeps is-tauri and is-windows', () => {
  assert.match(bridge, /is-tauri/);
  assert.match(bridge, /is-windows/);
});

test('tauri bridge seeds dusk_perf_mode when unset', () => {
  assert.match(bridge, /dusk_perf_mode/);
  assert.match(bridge, /localStorage\.setItem\(\s*['"]dusk_perf_mode['"]\s*,\s*['"]1['"]/);
});

test('tauri bridge sets isMobile false', () => {
  assert.match(bridge, /isMobile:\s*false/);
});
