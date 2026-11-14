import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const mobileUi = readFileSync(new URL('../mobile/mobile-ui.js', import.meta.url), 'utf8');

test('iOS audio engine patch only runs on is-mobile', () => {
  assert.match(mobileUi, /classList\.contains\(\s*['"]is-mobile['"]\s*\)/);
  // The init stub that skips Web Audio must be behind the phone gate.
  const gateIdx = mobileUi.search(/classList\.contains\(\s*['"]is-mobile['"]\s*\)/);
  const initStubIdx = mobileUi.indexOf('Engine.prototype.init = function');
  assert.ok(gateIdx >= 0 && initStubIdx > gateIdx, 'is-mobile check must wrap Engine.prototype.init stub');
});

test('desktop does not force phone font scale in mobile-ui', () => {
  // Either the font-scale seed is gated, or removed for shared www.
  const forcesPhoneScale =
    /dusk_font_scale['"]\s*,\s*['"]80['"]/.test(mobileUi) &&
    !/is-mobile[\s\S]{0,200}dusk_font_scale/.test(mobileUi) &&
    !/dusk_font_scale[\s\S]{0,200}is-mobile/.test(mobileUi);
  assert.equal(forcesPhoneScale, false);
});
