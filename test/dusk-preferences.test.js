'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const C = require('../dusk-theme-core');
const I = require('../i18n');
const P = require('../profiles-core');
const { de } = require('../dusk-locales');
const copy = v => JSON.parse(JSON.stringify(v));

test('system languages follow the first supported preferred locale; manual choice wins', () => {
  for (const tag of ['de-DE', 'de-AT', 'de-CH', 'DE_de']) assert.equal(I.resolveLanguage('system', [tag]), 'de');
  assert.equal(I.resolveLanguage('system', ['fr-FR', 'de-DE', 'en-US']), 'de');
  assert.equal(I.resolveLanguage('system', ['en-GB', 'de-DE']), 'en');
  assert.equal(I.resolveLanguage('system', ['ja-JP']), 'en');
  assert.equal(I.resolveLanguage('system', []), 'en');
  assert.equal(I.resolveLanguage('de', ['en-US']), 'de');
  assert.equal(I.resolveLanguage('en', ['de-DE']), 'en');
  assert.equal(I.preferenceOf('../../x'), 'system');
});

function languageApp({ language = 'de-AT', stored, native } = {}) {
  const storage = new Map(stored ? [[I.KEY, stored]] : []), listeners = new Map();
  let requests = 0;
  const ctx = {
    localStorage: { getItem: k => storage.get(k) || null, setItem: (k,v) => storage.set(k,String(v)) },
    navigator: { languages: [language] }, DuskNativeLanguages: native,
    document: { body: null, documentElement: { classList: { toggle() {} } } },
    addEventListener: (type, callback) => listeners.set(type, callback),
    fetch: () => { requests++; throw Error('Offline'); }, setTimeout, clearTimeout, console,
  };
  ctx.window = ctx; vm.createContext(ctx);
  for (const file of ['dusk-locales.js','i18n.js']) vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'), ctx);
  return { ctx, storage, listeners, requests: () => requests };
}

test('offline startup, switching and a later system language change never call translation endpoints', async () => {
  const app = languageApp(); const i = app.ctx.DuskI18n;
  assert.equal(i.preference, 'system'); assert.equal(i.lang, 'de');
  assert.equal(i.T('Settings'), 'Einstellungen');
  await i.connect('http://127.0.0.1:12345');
  await i.ready('An unknown future label');
  assert.equal(i.T('An unknown future label'), 'An unknown future label');
  await i.setLang('en'); assert.equal(i.T('Settings'), 'Settings');
  app.ctx.navigator.languages = ['de-DE']; app.listeners.get('languagechange')();
  assert.equal(i.lang, 'en', 'manual choice does not change with the device');
  await i.setLang('system'); assert.equal(i.lang, 'de');
  app.ctx.navigator.languages = ['en-GB']; app.listeners.get('languagechange')();
  assert.equal(i.lang, 'en'); assert.equal(app.storage.get(I.KEY), 'system');
  assert.equal(app.requests(), 0);
});

test('native app language takes priority, and a storage error leaves the previous choice active', async () => {
  const app = languageApp({ language: 'en-US', native: ['de-DE'] });
  assert.equal(app.ctx.DuskI18n.lang, 'de');
  app.ctx.localStorage.setItem = () => { throw Error('quota'); };
  assert.equal(await app.ctx.DuskI18n.setLang('en'), false);
  assert.equal(app.ctx.DuskI18n.preference, 'system');
  assert.equal(app.ctx.DuskI18n.lang, 'de');
});

test('locale placeholders are intact; Dusk and primary music terms are reviewed', () => {
  for (const [source, translated] of Object.entries(de)) assert.ok(I.pick(source, translated), source);
  assert.equal(de['Your Dusk'], 'Dein Dusk');
  assert.equal(de['Save and apply'], 'Speichern und anwenden');
  assert.equal(de.History, 'Verlauf');
  assert.equal(I.translatable('Dusk'), false);
  assert.equal(P.isDevice(I.KEY), false); assert.equal(P.isDevice(C.KEY), false);
});

test('all presets preserve readable text on every surface and survive export/import', () => {
  for (const p of C.PRESETS) {
    assert.deepEqual(C.parse(C.serialize(p)), C.validate(p));
    assert.ok(C.FX.includes(p.fx));
    for (const surface of ['background','surface','elevated']) {
      assert.ok(C.contrast(p.colors.text,p.colors[surface]) >= 4.5);
      assert.ok(C.contrast(p.colors.muted,p.colors[surface]) >= 4.5);
    }
  }
  assert.equal(C.PRESETS.find(p => p.name === 'Sakura').fx, 'sakura');
  assert.equal(C.PRESETS.find(p => p.name === 'Ink').fx, 'ink');
  assert.equal(C.PRESETS.find(p => p.name === 'Lantern').fx, 'ember');
});

test('theme fx is allowlisted and unknown values become none', () => {
  assert.equal(C.normalizeFx('sakura'), 'sakura');
  assert.equal(C.normalizeFx('hack'), 'none');
  assert.equal(C.normalizeFx(undefined), 'none');
  const base = copy(C.PRESETS[0]);
  base.fx = 'not-a-real-fx';
  assert.equal(C.validate(base).fx, 'none');
  base.fx = 'ink';
  assert.equal(C.validate(base).fx, 'ink');
  const round = C.parse(C.serialize(base));
  assert.equal(round.fx, 'ink');
});

test('theme import rejects executable values, unsupported versions, unreadable colors and corrupt documents', () => {
  assert.throws(() => C.parse('{broken'));
  assert.throws(() => C.parse(' '.repeat(C.MAX_BYTES+1)));
  for (const mutate of [
    p => p.version = 9,
    p => p.colors.accent = 'url(https://example.com/x)',
    p => p.colors.text = p.colors.background,
    p => p.colors.muted = p.colors.surface,
    p => p.radius = -1,
    p => p.fontScale = 999,
    p => p.sections.artists = 'false',
    p => p.name = '<img onerror=alert(1)>',
  ]) { const p = copy(C.PRESETS[0]); mutate(p); assert.throws(() => C.parse(JSON.stringify(p))); }
  const p = copy(C.PRESETS[0]); p.css = 'body{display:none}'; p.script = 'alert(1)'; p.__proto__ = { injected: true };
  const clean = C.parse(JSON.stringify(p));
  assert.equal(clean.css, undefined); assert.equal(clean.script, undefined); assert.equal(clean.injected, undefined);
});

test('corrupt saved appearance recovers without overwriting the source; collections have a bounded size', () => {
  const broken = '{'; const recovered = C.readState(broken);
  assert.equal(recovered.recovered, true); assert.equal(recovered.state.active.name, 'Graphite'); assert.equal(broken, '{');
  let state = C.defaultState();
  for (let i=0;i<C.MAX_SAVED;i++) state = C.withSaved(state,{ ...C.PRESETS[0],name:`Theme ${i}` });
  assert.throws(() => C.withSaved(state,{ ...C.PRESETS[0],name:'One too many' }));
  state = C.withSaved(state,{ ...C.PRESETS[1],name:'theme 0' });
  assert.equal(state.saved.length,C.MAX_SAVED);
  assert.deepEqual(C.readState(JSON.stringify(state)).state,state);
  assert.equal(C.readState(JSON.stringify(state)).recovered,false);
});
