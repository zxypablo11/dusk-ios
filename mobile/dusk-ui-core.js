(function (root) {
  'use strict';
  const QUERY_KEY = 'dusk_recent_searches_v1', ARTIST_KEY = 'dusk_recent_artists_v1';
  function queryOf(value) {
    if (typeof value !== 'string') return '';
    const query = value.replace(/\s+/g, ' ').trim();
    return query.length <= 160 ? query : '';
  }
  function artistOf(value) {
    if (!value || typeof value !== 'object') return null;
    const name = queryOf(value.name);
    if (!name) return null;
    const id = typeof value.id === 'string' || typeof value.id === 'number' ? String(value.id).slice(0,256) : '';
    const avatar = typeof value.avatar === 'string' && /^https?:\/\//.test(value.avatar) && value.avatar.length <= 2048 ? value.avatar : '';
    return { name, id, avatar };
  }
  function createHistory(storage) {
    const queryKey = value => value.toLowerCase();
    const artistKey = value => value.id ? 'id:'+value.id : 'name:'+value.name.toLowerCase();
    function read(key, clean, identity, limit) {
      try {
        const values = JSON.parse(storage.getItem(key) || '[]');
        if (!Array.isArray(values)) return [];
        const seen = new Set(), result = [];
        for (const value of values) {
          const item = clean(value);
          if (!item || seen.has(identity(item))) continue;
          seen.add(identity(item)); result.push(item);
          if (result.length === limit) break;
        }
        return result;
      } catch (_) { return []; }
    }
    const queries = () => read(QUERY_KEY,queryOf,queryKey,8);
    const artists = () => read(ARTIST_KEY,artistOf,artistKey,6);
    const write = (key,values) => { try { storage.setItem(key,JSON.stringify(values)); } catch (_) {} };
    return {
      queries, artists,
      rememberQuery(value) {
        const query = queryOf(value); if (!query) return;
        write(QUERY_KEY,[query,...queries().filter(item=>queryKey(item)!==queryKey(query))].slice(0,8));
      },
      removeQuery(value) { write(QUERY_KEY,queries().filter(item=>queryKey(item)!==queryKey(queryOf(value)))); },
      clearQueries() { try { storage.removeItem(QUERY_KEY); } catch (_) {} },
      rememberArtist(value) {
        const artist = artistOf(value); if (!artist) return;
        write(ARTIST_KEY,[artist,...artists().filter(item=>artistKey(item)!==artistKey(artist))].slice(0,6));
      },
    };
  }
  function playbackPhase(key, currentKey, loading, paused) {
    if (!key || key !== currentKey) return 'idle';
    return loading ? 'loading' : paused ? 'paused' : 'playing';
  }
  const api = { createHistory, playbackPhase };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DuskUiCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
