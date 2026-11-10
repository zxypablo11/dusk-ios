(function () {
  'use strict';
  const C = window.DuskThemeCore;
  if (!C) return;
  const $ = id => document.getElementById(id);
  const I = window.MurielI18n;
  let loaded;
  try { loaded = C.readState(localStorage.getItem(C.KEY)); }
  catch (_) { loaded = { state: C.defaultState(), recovered: true }; }
  let state = loaded.state;
  let initialized = false;
  const tokens = document.createElement('style');
  tokens.id = 'dusk-theme-tokens';
  document.head.appendChild(tokens);
  const root = document.documentElement;
  const status = message => I.text($('dusk-theme-status'), message);
  function reapply() {
    root.classList.toggle('dusk-active', state.enabled);
    if (!state.enabled) {
      tokens.textContent = '';
      for (const key of ['recent', 'recommendations', 'artists']) delete root.dataset['duskHide' + key[0].toUpperCase() + key.slice(1)];
      return;
    }
    document.body.classList.remove('theme-light');
    document.body.classList.add('theme-dark');
    const t = state.active, c = t.colors;
    const onAccent = C.contrast(c.accent, '#000000') >= C.contrast(c.accent, '#ffffff') ? '#000000' : '#ffffff';
    const vars = {};
    for (const [key, value] of Object.entries({
      background: c.background, surface: c.background, 'surface-dim': c.background,
      'surface-bright': c.elevated, 'surface-container-lowest': c.background,
      'surface-container-low': c.surface, 'surface-container': c.surface,
      'surface-container-high': c.elevated, 'surface-container-highest': c.elevated,
      'on-surface': c.text, 'on-surface-variant': c.muted,
    })) {
      vars[`--md-sys-color-${key}`] = value;
      vars[`--md-sys-color-${key}-solid`] = value;
    }
    Object.assign(vars, {
      '--md-sys-color-primary': c.accent, '--md-sys-color-on-primary': onAccent,
      '--md-sys-color-primary-container': c.elevated, '--md-sys-color-on-primary-container': c.text,
      '--md-sys-color-secondary-container': c.elevated, '--md-sys-color-on-secondary-container': c.text,
      '--md-sys-color-outline': c.muted, '--md-sys-color-outline-variant': c.elevated,
      '--md-shape-corner-l': `${t.radius}px`, '--md-shape-corner-m': `${Math.max(0, t.radius - 4)}px`,
      '--font-scale': String(t.fontScale / 100 * 1.1875),
      '--btn-primary-bg': c.accent, '--btn-primary-fg': onAccent, '--btn-primary-hover': c.accent,
      '--dusk-accent': c.accent, '--dusk-on-accent': onAccent,
    });
    tokens.textContent = `html:root.dusk-active { ${Object.entries(vars).map(([k,v]) => `${k}:${v} !important;`).join('')} }`;
    for (const [key, visible] of Object.entries(t.sections)) root.dataset['duskHide' + key[0].toUpperCase() + key.slice(1)] = String(!visible);
  }
  function commit(next) {
    // Persist first: a full device must not appear to have saved a theme that disappears on restart.
    try { localStorage.setItem(C.KEY, JSON.stringify(next)); }
    catch (_) { throw new Error('Could not save the theme. Check device storage.'); }
    state = next;
    reapply();
    if (initialized) render();
    window.MurielCore?.refreshTheme();
  }
  function report(error) { status(error.message || 'Could not save the theme. Check device storage.'); }
  function action(fn) { try { fn(); } catch (e) { report(e); } }
  function render() {
    $('dusk-enabled').checked = state.enabled;
    $('dusk-active-name').textContent = state.enabled ? state.active.name : I.T('Advanced appearance');
    for (const button of $('dusk-theme-gallery').children) {
      const preset = C.PRESETS.find(p => p.name === button.dataset.preset);
      const selected = state.enabled && C.serialize(state.active) === C.serialize(preset);
      button.setAttribute('aria-pressed', String(selected));
      button.querySelector('.dusk-selected').textContent = selected ? I.T('Selected') : '';
    }
    const list = $('dusk-saved-list');
    list.replaceChildren();
    if (!state.saved.length) {
      const hint = document.createElement('p'); hint.className = 'dusk-hint';
      I.text(hint, 'Your saved themes appear here.'); list.append(hint);
    }
    for (const theme of state.saved) {
      const row = document.createElement('div'); row.className = 'dusk-saved-row';
      const pick = document.createElement('button'); pick.type = 'button'; pick.className = 'dusk-saved-pick';
      const dot = document.createElement('span'); dot.className = 'dusk-color-dot'; dot.style.backgroundColor = theme.colors.accent;
      dot.setAttribute('aria-hidden', 'true');
      const name = document.createElement('span'); name.textContent = theme.name; name.setAttribute('data-no-i18n', '');
      pick.append(dot, name);
      pick.setAttribute('aria-pressed', String(state.enabled && C.serialize(theme) === C.serialize(state.active)));
      pick.addEventListener('click', () => action(() => { commit({ ...state, enabled: true, active: C.validate(theme) }); status('Theme applied.'); }));
      const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'btn-outline-pill';
      I.text(edit, 'Edit'); edit.setAttribute('aria-label', I.Tf('Edit {0}', theme.name));
      edit.addEventListener('click', () => openEditor(theme));
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'btn-outline-pill';
      I.text(remove, 'Delete'); remove.setAttribute('aria-label', I.Tf('Delete {0}', theme.name));
      remove.addEventListener('click', () => action(() => {
        const removed = theme;
        commit({ ...state, saved: state.saved.filter(t => t.name !== theme.name) });
        status('Theme removed.');
        const undo = document.createElement('button'); undo.type = 'button'; undo.className = 'btn-outline-pill'; I.text(undo, 'Undo');
        undo.addEventListener('click', () => action(() => {
          const restored = C.withSaved(state, removed);
          commit({ ...restored, active: state.active, enabled: state.enabled }); status('Theme restored.');
        }));
        $('dusk-theme-status').append(' ', undo);
      }));
      row.append(pick, edit, remove); list.append(row);
    }
    for (const [id, value] of [['slider-font-scale', state.active.fontScale], ['slider-corner-radius', state.active.radius]]) {
      if (state.enabled && $(id)) $(id).value = value;
    }
    if (state.enabled) {
      if ($('val-font-scale')) $('val-font-scale').textContent = `${state.active.fontScale}%`;
      if ($('val-corner-radius')) $('val-corner-radius').textContent = `${state.active.radius}px`;
    }
  }
  const dialog = $('dusk-editor');
  let returnFocus;
  function draft() {
    return {
      version: C.VERSION, name: $('dusk-theme-name').value,
      colors: Object.fromEntries([...dialog.querySelectorAll('[data-color]')].map(n => [n.dataset.color, n.value])),
      radius: Number($('dusk-radius').value), fontScale: Number($('dusk-font-scale').value),
      sections: Object.fromEntries([...dialog.querySelectorAll('[data-section]')].map(n => [n.dataset.section, n.checked])),
    };
  }
  function preview() {
    const t = draft(), box = $('dusk-theme-preview');
    for (const [key, val] of Object.entries(t.colors)) box.style.setProperty(`--preview-${key}`, val);
    box.style.setProperty('--preview-radius', `${t.radius}px`);
    box.style.setProperty('--preview-scale', t.fontScale / 100);
    $('dusk-font-value').value = `${t.fontScale}%`;
    $('dusk-radius-value').value = `${t.radius}px`;
    try { C.validate(t); $('dusk-editor-error').textContent = ''; }
    catch (e) { I.text($('dusk-editor-error'), e.message); }
  }
  function openEditor(theme) {
    returnFocus = document.activeElement;
    const t = C.validate(theme);
    $('dusk-theme-name').value = t.name;
    for (const n of dialog.querySelectorAll('[data-color]')) n.value = t.colors[n.dataset.color];
    for (const n of dialog.querySelectorAll('[data-section]')) n.checked = t.sections[n.dataset.section];
    $('dusk-font-scale').value = t.fontScale; $('dusk-radius').value = t.radius;
    preview(); dialog.showModal();
    $('dusk-theme-name').focus();
  }
  async function exportTheme() {
    const btn = $('dusk-export'); btn.disabled = true;
    try {
      const name = state.active.name.replace(/[^\p{L}\p{N}_-]+/gu, '-').slice(0, 40) || 'Dusk';
      const content = C.serialize(state.active);
      if (typeof window.electronAPI?.saveTextFile === 'function') {
        const result = await window.electronAPI.saveTextFile({ defaultName: `${name}.dusk.json`, content, kind: 'theme' });
        if (result?.canceled) return;
        if (!result?.success) throw new Error('Could not export the theme.');
      } else {
        const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
        const a = document.createElement('a'); a.href = url; a.download = `${name}.dusk.json`; document.body.append(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      status('Theme exported.');
    } catch (e) { report(e); }
    finally { btn.disabled = false; }
  }
  function init() {
    if (initialized) return;
    initialized = true;
    const gallery = $('dusk-theme-gallery');
    for (const theme of C.PRESETS) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'dusk-theme-card'; button.dataset.preset = theme.name;
      button.setAttribute('aria-label', theme.name);
      const swatch = document.createElement('span'); swatch.className = 'dusk-theme-swatch'; swatch.setAttribute('aria-hidden', 'true');
      swatch.style.backgroundColor = theme.colors.background;
      for (const color of [theme.colors.surface, theme.colors.elevated, theme.colors.accent]) {
        const shape = document.createElement('i'); shape.style.backgroundColor = color; swatch.append(shape);
      }
      const name = document.createElement('span'); name.textContent = theme.name; name.setAttribute('data-no-i18n', '');
      const selected = document.createElement('small'); selected.className = 'dusk-selected';
      button.append(swatch, name, selected);
      button.addEventListener('click', () => action(() => { commit({ ...state, enabled: true, active: C.validate(theme) }); status('Theme applied.'); }));
      gallery.append(button);
    }
    $('dusk-enabled').addEventListener('change', e => action(() => {
      try { commit({ ...state, enabled: e.target.checked }); }
      catch (error) { e.target.checked = state.enabled; throw error; }
    }));
    $('dusk-edit').addEventListener('click', () => openEditor({ ...state.active, name: state.saved.some(t => t.name === state.active.name) ? state.active.name : `${state.active.name} ${I.T('Custom')}` }));
    $('dusk-editor-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => { if (returnFocus?.isConnected) returnFocus.focus(); });
    $('dusk-editor-form').addEventListener('input', preview);
    $('dusk-editor-form').addEventListener('submit', e => {
      e.preventDefault();
      try {
        commit(C.withSaved(state, draft())); dialog.close(); status('Theme saved and applied.');
      } catch (error) { I.text($('dusk-editor-error'), error.message); $('dusk-editor-error').focus(); }
    });
    $('dusk-import').addEventListener('click', () => $('dusk-import-file').click());
    $('dusk-import-file').addEventListener('change', async e => {
      const file = e.target.files[0]; e.target.value = ''; if (!file) return;
      try {
        if (file.size > C.MAX_BYTES) throw new Error('Theme file is too large.');
        openEditor(C.parse(await file.text()));
      } catch (error) { report(error); }
    });
    $('dusk-export').addEventListener('click', exportTheme);
    $('dusk-reset').addEventListener('click', () => action(() => { commit({ ...state, enabled: true, active: C.validate(C.PRESETS[0]) }); status('Appearance reset. Your music and saved themes are unchanged.'); }));
    // Existing layout controls and the theme editor share one persisted appearance.
    for (const [id, field] of [['slider-font-scale', 'fontScale'], ['slider-corner-radius', 'radius']]) {
      $(id)?.addEventListener('input', e => {
        if (state.enabled) action(() => commit({ ...state, active: C.validate({ ...state.active, [field]: Number(e.target.value) }) }));
      });
    }
    window.addEventListener('muriel:i18n', render);
    render(); reapply();
    if (loaded.recovered) status('Saved appearance could not be read. Graphite is active; the original data has been kept.');
  }
  window.DuskThemes = { reapply };
  reapply();
  if (window.MurielCore) init(); else window.addEventListener('muriel:ready', init, { once: true });
})();
