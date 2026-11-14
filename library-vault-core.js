// Lightweight library vault: playlists, favorites, short history, Dusk themes and language.
// Metadata only — no audio files, no data:image blobs, no local paths. Survives reinstall via Keychain.
(function (root) {
  const VERSION = 1;
  const MAX_BYTES = 450000; // hard cap so Keychain/Documents stay tiny
  const HISTORY_CAP = 100;
  const KEYS = [
    'devsize_playlists',
    'devsize_favorites',
    'devsize_history',
    'dusk_themes_v1',
    'dusk_ui_lang',
  ];
  const YT_ID = /^[A-Za-z0-9_-]{11}$/;
  const LOCAL_ID = /^local_[A-Za-z0-9_-]{1,64}$/;
  const SAFE_KEY = /^[A-Za-z_][A-Za-z0-9_]{0,39}$/;
  const clip = (s, n) => (typeof s === 'string' || typeof s === 'number' ? String(s) : '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);
  const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
  function parseUrl(s) {
    try { return new URL(String(s)); } catch (e) { return null; }
  }
  const httpsUrl = (s, n = 2048) => {
    if (typeof s !== 'string' || s.length > n || s.startsWith('data:')) return '';
    const u = parseUrl(s);
    return u && u.protocol === 'https:' ? u.href : '';
  };

  function cleanTrack(t) {
    if (!isObj(t)) return null;
    const title = clip(t.title || t.name, 300);
    const artist = clip(t.artist || t.artistName || t.author, 300);
    const out = {};
    if (title) out.title = title;
    if (artist) out.artist = artist;
    const album = clip(t.album, 300);
    if (album) out.album = album;
    const d = Number(t.duration);
    if (d > 0 && d < 86400) out.duration = Math.round(d);
    const id = typeof t.id === 'string' || typeof t.id === 'number' ? String(t.id) : '';
    const platform = String(t.platform || t.source || '').toLowerCase();
    const thumb = httpsUrl(t.thumbnail) || httpsUrl(t.cover);
    if (thumb) out.thumbnail = thumb;
    if (platform === 'local' || LOCAL_ID.test(id)) {
      // keep the library id only; the audio file itself is not in the vault
      if (LOCAL_ID.test(id)) { out.id = id; out.platform = 'local'; return out; }
      return title ? out : null;
    }
    if (platform === 'soundcloud') {
      const url = httpsUrl(t.url);
      const host = url ? parseUrl(url).hostname.toLowerCase() : '';
      out.platform = 'soundcloud';
      if (id) out.id = clip(id, 200);
      if (url && /^(?:www\.|m\.)?soundcloud\.com$/.test(host)) out.url = url;
      return out.title || out.id ? out : null;
    }
    const url = httpsUrl(t.url);
    const yt = YT_ID.test(id) ? id : (() => {
      const u = url ? parseUrl(url) : null;
      if (!u) return '';
      const host = u.hostname.toLowerCase();
      if (!/^(?:www\.|m\.|music\.)?youtube\.com$|^youtu\.be$/.test(host)) return '';
      const vid = host === 'youtu.be' ? u.pathname.slice(1) : (u.searchParams.get('v') || '');
      return YT_ID.test(vid) ? vid : '';
    })();
    if (yt) {
      out.id = yt;
      out.platform = 'youtube';
      out.url = `https://www.youtube.com/watch?v=${yt}`;
      if (!out.thumbnail) out.thumbnail = `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`;
      return out;
    }
    return out.title ? out : null;
  }

  function cleanPlaylists(list) {
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    const out = [];
    for (const p of list.slice(0, 500)) {
      if (!isObj(p)) continue;
      let id = typeof p.id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(p.id) ? p.id : '';
      while (!id || seen.has(id)) id = `pl_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
      seen.add(id);
      const pl = {
        id,
        name: clip(p.name, 100) || 'untitled',
        tracks: (Array.isArray(p.tracks) ? p.tracks : []).map(cleanTrack).filter(Boolean).slice(0, 5000),
      };
      const cover = httpsUrl(p.cover);
      if (cover) pl.cover = cover;
      const description = clip(p.description, 500);
      if (description) pl.description = description;
      out.push(pl);
    }
    return out;
  }

  function cleanThemes(raw) {
    if (typeof raw !== 'string' || !raw) return '';
    try {
      const obj = JSON.parse(raw);
      if (!isObj(obj)) return '';
      // strip anything executable-looking; keep JSON text only
      return JSON.stringify(obj).slice(0, 200000);
    } catch (e) { return ''; }
  }

  function parseEntry(key, raw) {
    if (typeof raw !== 'string') return null;
    if (key === 'dusk_ui_lang') {
      const lang = clip(raw, 16);
      return lang === 'de' || lang === 'en' || lang === 'system' ? lang : '';
    }
    if (key === 'dusk_themes_v1') return cleanThemes(raw);
    try {
      const data = JSON.parse(raw);
      if (key === 'devsize_playlists') return cleanPlaylists(data);
      if (key === 'devsize_favorites') return (Array.isArray(data) ? data : []).map(cleanTrack).filter(Boolean).slice(0, 5000);
      if (key === 'devsize_history') return (Array.isArray(data) ? data : []).map(cleanTrack).filter(Boolean).slice(0, HISTORY_CAP);
    } catch (e) { return null; }
    return null;
  }

  function makeVault(entries, { profileName = '', appVersion = '' } = {}) {
    const map = entries instanceof Map ? entries : new Map(entries || []);
    const data = {};
    for (const key of KEYS) {
      const raw = map.get(key);
      if (raw == null) continue;
      const cleaned = parseEntry(key, raw);
      if (cleaned === null || cleaned === '') continue;
      data[key] = typeof cleaned === 'string' ? cleaned : JSON.stringify(cleaned);
    }
    const vault = {
      app: 'Dusk',
      kind: 'dusk-library-vault',
      version: VERSION,
      appVersion: String(appVersion || ''),
      exportedAt: new Date().toISOString(),
      profile: { name: clip(profileName, 24) },
      data,
    };
    const text = JSON.stringify(vault);
    if (text.length > MAX_BYTES) {
      // drop history first, then trim favorites
      delete vault.data.devsize_history;
      let next = JSON.stringify(vault);
      if (next.length > MAX_BYTES && vault.data.devsize_favorites) {
        try {
          const favs = JSON.parse(vault.data.devsize_favorites).slice(0, 500);
          vault.data.devsize_favorites = JSON.stringify(favs);
        } catch (e) { delete vault.data.devsize_favorites; }
        next = JSON.stringify(vault);
      }
      if (next.length > MAX_BYTES) throw new Error('Library backup is too large');
      return vault;
    }
    return vault;
  }

  function readVault(obj) {
    if (!isObj(obj) || obj.kind !== 'dusk-library-vault') throw new Error("That file isn't a Dusk library backup");
    if (Number(obj.version) !== VERSION) throw new Error('This library backup is from a newer Dusk');
    if (!isObj(obj.data)) throw new Error('That library backup is empty');
    const entries = {};
    for (const key of KEYS) {
      if (!(key in obj.data)) continue;
      const raw = obj.data[key];
      if (typeof raw !== 'string') continue;
      const cleaned = parseEntry(key, raw);
      if (cleaned === null || cleaned === '') continue;
      entries[key] = typeof cleaned === 'string' ? cleaned : JSON.stringify(cleaned);
    }
    if (!Object.keys(entries).length) throw new Error('That library backup is empty');
    const bytes = JSON.stringify(entries).length;
    return {
      entries,
      profileName: isObj(obj.profile) ? clip(obj.profile.name, 24) : '',
      exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : '',
      bytes,
      counts: {
        playlists: (() => { try { return JSON.parse(entries.devsize_playlists || '[]').length; } catch (e) { return 0; } })(),
        favorites: (() => { try { return JSON.parse(entries.devsize_favorites || '[]').length; } catch (e) { return 0; } })(),
      },
    };
  }

  function parseVaultText(text) {
    if (typeof text !== 'string' || !text.trim()) throw new Error('That library backup is empty');
    if (text.length > MAX_BYTES * 2) throw new Error('Library backup is too large');
    let obj;
    try { obj = JSON.parse(text.replace(/^\uFEFF/, '')); } catch (e) { throw new Error("That file isn't a Dusk library backup"); }
    return readVault(obj);
  }

  function isEmptyLibrary(getItem) {
    const playlists = getItem('devsize_playlists');
    const favorites = getItem('devsize_favorites');
    try {
      const pl = playlists ? JSON.parse(playlists) : [];
      const fav = favorites ? JSON.parse(favorites) : [];
      return !(Array.isArray(pl) && pl.length) && !(Array.isArray(fav) && fav.length);
    } catch (e) { return true; }
  }

  const api = { VERSION, MAX_BYTES, HISTORY_CAP, KEYS, makeVault, readVault, parseVaultText, isEmptyLibrary, cleanTrack };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DuskLibraryVault = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
