// Portable theme documents contain values, never executable CSS or remote resources.
(function (root) {
  'use strict';
  const VERSION = 1;
  const KEY = 'dusk_themes_v1';
  const MAX_BYTES = 16384;
  const MAX_SAVED = 24;
  const palette = (name, background, surface, elevated, accent) => ({
    version: VERSION, name,
    colors: { background, surface, elevated, accent, text: '#f5f5f7', muted: '#b2b5bf' },
    radius: 16, fontScale: 100,
    sections: { recent: true, recommendations: true, artists: true },
  });
  const PRESETS = [
    palette('Graphite', '#131416', '#202125', '#2b2d32', '#c0c5e8'),
    palette('Obsidian', '#000000', '#111214', '#24262a', '#e1e3e8'),
    palette('Cobalt', '#10151e', '#1b2331', '#273347', '#a6c6ff'),
    palette('Violet', '#17141d', '#252030', '#342c40', '#cdb6f2'),
    palette('Ember', '#191512', '#29221e', '#3a2e27', '#ecbb96'),
    palette('Ice', '#10191c', '#1b292d', '#27393d', '#a1d9dc'),
  ];
  function luminance(hex) {
    const values = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
    return values[0] * .2126 + values[1] * .7152 + values[2] * .0722;
  }
  function contrast(a, b) {
    const x = luminance(a), y = luminance(b);
    return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
  }
  function validate(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || value.version !== VERSION) throw new Error('Unsupported theme file.');
    if (typeof value.name !== 'string' || !value.name.trim() || value.name.trim().length > 40 || /[\u0000-\u001f<>]/.test(value.name)) throw new Error('Use a theme name with 1–40 characters.');
    const colors = {};
    for (const field of ['background', 'surface', 'elevated', 'text', 'muted', 'accent']) {
      const color = value.colors?.[field];
      if (typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color)) throw new Error('Use six-digit hex colors.');
      colors[field] = color.toLowerCase();
    }
    for (const surface of ['background', 'surface', 'elevated']) {
      if (contrast(colors.text, colors[surface]) < 4.5 || contrast(colors.muted, colors[surface]) < 4.5) throw new Error('Increase text contrast to at least 4.5:1 on every surface.');
      if (contrast(colors.accent, colors[surface]) < 3) throw new Error('Increase accent contrast to at least 3:1 on every surface.');
    }
    if (!Number.isInteger(value.radius) || value.radius < 0 || value.radius > 32) throw new Error('Corner radius must be between 0 and 32.');
    if (!Number.isInteger(value.fontScale) || value.fontScale < 80 || value.fontScale > 150) throw new Error('Text size must be between 80% and 150%.');
    const sections = {};
    for (const field of ['recent', 'recommendations', 'artists']) {
      if (typeof value.sections?.[field] !== 'boolean') throw new Error('Invalid home section settings.');
      sections[field] = value.sections[field];
    }
    return { version: VERSION, name: value.name.trim(), colors, radius: value.radius, fontScale: value.fontScale, sections };
  }
  function parse(text) {
    if (typeof text !== 'string' || text.length > MAX_BYTES) throw new Error('Theme file is too large.');
    let value;
    try { value = JSON.parse(text); } catch (_) { throw new Error('This is not a valid theme file.'); }
    return validate(value);
  }
  const serialize = value => JSON.stringify(validate(value), null, 2) + '\n';
  const defaultState = () => ({ version: VERSION, enabled: true, active: validate(PRESETS[0]), saved: [] });
  function readState(raw) {
    if (!raw) return { state: defaultState(), recovered: false };
    try {
      if (raw.length > MAX_BYTES * (MAX_SAVED + 1)) throw new Error('Too large');
      const v = JSON.parse(raw);
      if (v.version !== VERSION || typeof v.enabled !== 'boolean' || !Array.isArray(v.saved) || v.saved.length > MAX_SAVED) throw new Error('Invalid state');
      return { state: { version: VERSION, enabled: v.enabled, active: validate(v.active), saved: v.saved.map(validate) }, recovered: false };
    } catch (_) { return { state: defaultState(), recovered: true }; }
  }
  function withSaved(state, theme) {
    const active = validate(theme);
    const saved = state.saved.filter(t => t.name.toLocaleLowerCase() !== active.name.toLocaleLowerCase());
    if (saved.length >= MAX_SAVED) throw new Error('You can save up to 24 themes.');
    return { version: VERSION, enabled: true, active, saved: [...saved, active] };
  }
  const api = { VERSION, KEY, MAX_BYTES, MAX_SAVED, PRESETS, contrast, validate, parse, serialize, defaultState, readState, withSaved };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DuskThemeCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
