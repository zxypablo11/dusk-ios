// Device library vault UI + auto-save. Snapshot logic lives in library-vault-core.js.
// On iPhone the Keychain copy survives deleting the app; Documents gets a readable copy.
(function () {
  const V = window.DuskLibraryVault;
  if (!V) return;

  const META = 'dusk_vault_meta_v1';
  const LS_VAULT = 'dusk_library_vault_v1';
  const WATCH = new Set(V.KEYS);
  const I18n = () => window.MurielI18n || (() => {
    const f = (s, ...a) => String(s).replace(/\{(\d)\}/g, (_, i) => (a[i] != null ? a[i] : ''));
    return { T: (s) => s, Tf: f, Tm: f, Th: f, text: (el, s, ...a) => { if (el) el.textContent = f(s, ...a); } };
  })();
  const toast = (m, kind) => { try { window.MurielCore && window.MurielCore.toast(m, kind || 'info'); } catch (e) {} };
  const $ = (id) => document.getElementById(id);

  let core = null;
  let timer = null;
  let applying = false;
  let saving = false;

  function ownEntries() {
    const out = new Map();
    for (const key of V.KEYS) {
      try {
        const raw = localStorage.getItem(key);
        if (raw != null) out.set(key, raw);
      } catch (e) {}
    }
    return out;
  }

  function readMeta() {
    try { return JSON.parse(localStorage.getItem(META) || 'null') || null; } catch (e) { return null; }
  }

  function writeMeta(meta) {
    try { localStorage.setItem(META, JSON.stringify(meta)); } catch (e) {}
  }

  function fmtBytes(n) {
    const b = Math.max(0, Number(n) || 0);
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(b < 10 * 1024 ? 1 : 0)} KB`;
    return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  }

  function fmtWhen(iso) {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return '';
      return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    } catch (e) { return ''; }
  }

  function refreshStatus() {
    const el = $('device-vault-status');
    if (!el) return;
    const meta = readMeta();
    const I = I18n();
    if (!meta || !meta.at) {
      I.text(el, 'Not backed up yet');
      return;
    }
    I.text(el, 'Last saved {0} · {1}', fmtWhen(meta.at), fmtBytes(meta.bytes));
  }

  async function appVersion() {
    try {
      return (window.electronAPI && window.electronAPI.getAppVersion && (await window.electronAPI.getAppVersion())) || '';
    } catch (e) { return ''; }
  }

  async function writeVaultText(text) {
    const api = window.electronAPI;
    if (api && typeof api.vaultWrite === 'function') return api.vaultWrite(text);
    try {
      localStorage.setItem(LS_VAULT, text);
      return { ok: true, bytes: text.length, keychain: false, documents: false };
    } catch (e) {
      return { ok: false, error: (e && e.message) || 'Could not save the library backup' };
    }
  }

  async function readVaultText() {
    const api = window.electronAPI;
    if (api && typeof api.vaultRead === 'function') return api.vaultRead();
    try {
      const value = localStorage.getItem(LS_VAULT);
      return value ? { value, source: 'local' } : { value: null };
    } catch (e) {
      return { value: null };
    }
  }

  async function persist(opts = {}) {
    if (saving || applying) return null;
    saving = true;
    try {
      const me = window.MurielProfiles ? window.MurielProfiles.current() : { name: '' };
      const vault = V.makeVault(ownEntries(), { profileName: me && me.name, appVersion: await appVersion() });
      const text = JSON.stringify(vault);
      const r = await writeVaultText(text);
      if (!r || !r.ok) throw new Error((r && r.error) || 'Could not save the library backup');
      writeMeta({ at: vault.exportedAt || new Date().toISOString(), bytes: text.length });
      refreshStatus();
      if (opts.toast) toast('Library saved on this device', 'success');
      return vault;
    } catch (e) {
      if (opts.toast) toast((e && e.message) || 'Could not save the library backup', 'error');
      return null;
    } finally {
      saving = false;
    }
  }

  function scheduleSave() {
    if (applying) return;
    clearTimeout(timer);
    timer = setTimeout(() => { persist({ toast: false }); }, 1800);
  }

  async function restoreFromDevice({ silent } = {}) {
    let parsed;
    try {
      const r = await readVaultText();
      if (!r || !r.value) {
        if (!silent) toast('Nothing to restore on this device', 'info');
        return false;
      }
      parsed = V.parseVaultText(r.value);
    } catch (e) {
      if (!silent) toast((e && e.message) || 'Could not restore the library backup', 'error');
      return false;
    }
    const apply = () => {
      applying = true;
      try {
        for (const [k, v] of Object.entries(parsed.entries)) {
          try { localStorage.setItem(k, v); } catch (e) {}
        }
        writeMeta({ at: parsed.exportedAt || new Date().toISOString(), bytes: parsed.bytes });
      } finally {
        applying = false;
      }
    };
    apply();
    refreshStatus();
    toast('Library restored from this device', 'success');
    // themes/lang and in-memory playlists need a clean boot; keep applying on pagehide like backup.js
    window.addEventListener('pagehide', apply);
    setTimeout(() => location.reload(), silent ? 200 : 700);
    return true;
  }

  async function maybeAutoRestore() {
    try {
      if (sessionStorage.getItem('dusk_vault_restored') === '1') return;
      if (!V.isEmptyLibrary((k) => localStorage.getItem(k))) return;
      const r = await readVaultText();
      if (!r || !r.value) return;
      const parsed = V.parseVaultText(r.value);
      if (!(parsed.counts.playlists || parsed.counts.favorites)) return;
      sessionStorage.setItem('dusk_vault_restored', '1');
      await restoreFromDevice({ silent: true });
    } catch (e) {}
  }

  function watchStorage() {
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = function vaultWatchSetItem(key, value) {
      const r = orig.apply(this, arguments);
      if (!applying && typeof key === 'string' && WATCH.has(key)) scheduleSave();
      return r;
    };
    window.addEventListener('storage', (e) => {
      if (e && e.key && WATCH.has(e.key)) scheduleSave();
    });
  }

  function hook() {
    core = window.MurielCore;
    const on = (id, fn) => { const b = $(id); if (b) b.addEventListener('click', fn); };
    on('btn-device-vault-save', () => persist({ toast: true }));
    on('btn-device-vault-restore', () => restoreFromDevice({ silent: false }));
    refreshStatus();
    watchStorage();
    // first save after launch if the library already has something; restore if empty + vault exists
    maybeAutoRestore().then(() => {
      if (!V.isEmptyLibrary((k) => { try { return localStorage.getItem(k); } catch (e) { return null; } })) {
        scheduleSave();
      }
    });
  }

  if (window.MurielCore) hook();
  else window.addEventListener('muriel:ready', hook, { once: true });
})();
