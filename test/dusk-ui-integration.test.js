'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const UI = require('../mobile/dusk-ui-core');
const app = fs.readFileSync(require.resolve('../app.js'), 'utf8');
const mobile = fs.readFileSync(require.resolve('../mobile/dusk-mobile.js'), 'utf8');
function between(source, start, end) {
  const from = source.indexOf(start), to = source.indexOf(end, from);
  assert.ok(from >= 0 && to > from, 'production function boundaries');
  return source.slice(from, to);
}
function memory() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}
function searchApp() {
  const input = Object.assign(new EventTarget(), { value: 'Miles Davis', blur() {} });
  const clear = new EventTarget(), requests = [], events = [], frames = [], rendered = [];
  const classList = () => ({ add() {}, remove() {} });
  clear.classList = classList();
  const store = memory(), history = UI.createHistory(store), window = new EventTarget();
  store.setItem('dusk_search_artists', '0');
  window.addEventListener('dusk:search', e => { events.push(e.detail.query); history.rememberQuery(e.detail.query); });
  const ctx = {
    state: { platform: 'youtube', searchResults: [] }, window, localStorage: store,
    el: { searchInput: input, searchClearBtn: clear, discoverEmpty: { classList: classList() }, searchResultsContainer: { classList: classList() }, searchTracksList: {} },
    document: { getElementById: () => null, documentElement: { classList: { contains: () => true } } },
    navigator: { onLine: true }, CustomEvent, console, getAdv: () => false,
    switchView() {}, syncHomeAmbientVisibility() {}, importSharedPlaylist() {},
    requestAnimationFrame: callback => frames.push(callback), renderTracks: (_el, tracks) => rendered.push(tracks),
    fetchDuskAutoSearch: () => new Promise(resolve => requests.push(resolve)),
  };
  vm.createContext(ctx);
  vm.runInContext(between(app, '  async function performSearch(', '  const multiSel'), ctx);
  vm.runInContext(between(app, "  if (el.searchInput) {\n    el.searchInput.addEventListener('input'", '  function setPlatform('), ctx);
  return { ctx, input, clear, history, events, requests, frames, rendered, search: query => ctx.performSearch(query) };
}
for (const action of ['clear button', 'Escape', 'empty input']) {
  test(`a pending search dismissed by ${action} cannot repopulate cleared history`, async () => {
    const h = searchApp(), pending = h.search('Miles Davis');
    h.history.clearQueries();
    if (action === 'clear button') h.clear.dispatchEvent(new Event('click'));
    else if (action === 'Escape') h.input.dispatchEvent(Object.assign(new Event('keydown'), { key: 'Escape' }));
    else { h.input.value = ''; h.input.dispatchEvent(new Event('input')); }
    h.requests[0]([{ id: 'pending', title: 'So What' }]); await pending;
    assert.deepEqual(h.events, []);
    assert.deepEqual(h.history.queries(), []);
    assert.equal(h.ctx.state.searchResults.length, 0);
  });
}
test('dismissal also cancels a scheduled search-results render', async () => {
  const h = searchApp(), pending = h.search('Miles Davis');
  h.requests[0]([{ id: 'song', title: 'So What' }]); await pending;
  h.clear.dispatchEvent(new Event('click'));
  h.frames.forEach(callback => callback());
  assert.equal(h.rendered.length, 0);
});
test('an active completed search still records its query and renders its tracks', async () => {
  const h = searchApp(), pending = h.search('Miles Davis');
  h.requests[0]([{ id: 'song', title: 'So What' }]); await pending;
  h.frames.forEach(callback => callback());
  assert.deepEqual(h.history.queries(), ['Miles Davis']);
  assert.equal(h.rendered[0][0].id, 'song');
});

// A small DOM double supplies browser focus and nodes; the production renderers
// and click callbacks below remain unchanged and use the real history store.
function presentation() {
  const document = { activeElement: null }, buttons = [];
  function node(tag, className = '', text = '') {
    const attrs = {}, e = {
      tagName: tag.toUpperCase(), className, textContent: text, children: [], dataset: {},
      append(...children) { this.children.push(...children); },
      replaceChildren(...children) { this.children = children; },
      setAttribute(key, value) { attrs[key] = value; }, getAttribute: key => attrs[key] ?? null,
      hasAttribute: key => key in attrs,
      focus() { document.activeElement = this; },
      classList: { add() {}, contains: value => className.split(' ').includes(value) },
      querySelectorAll() { return this.children.flatMap(child => [child, ...child.querySelectorAll()]); },
    };
    return e;
  }
  const I = { T: value => value, Tf: (value, title) => value.replace('{0}', title) };
  function button(label, _icon, onClick, className = 'dusk-icon-button') {
    const e = node('button', className); e.setAttribute('aria-label', label); e.onClick = onClick;
    buttons.push(e); return e;
  }
  return { document, buttons, node, button, I, icon: () => node('svg'), cover: () => node('div') };
}
function searchPresentation(queries) {
  const p = presentation(), history = UI.createHistory(memory()), searchInput = p.node('input');
  for (const query of queries) history.rememberQuery(query);
  const ctx = { ...p, history, searchHint: p.node('div'), $: id => id === 'search-input' ? searchInput : null,
    core: { search() {}, openArtist() {}, dismissSearch() {} }, updateSearchHint() {} };
  vm.createContext(ctx);
  vm.runInContext(between(mobile, '    function renderSearchHistory(', '    function renderLibrary('), ctx);
  ctx.renderSearchHistory();
  const find = label => p.buttons.findLast(e => e.getAttribute('aria-label') === label);
  return { ...p, history, searchInput, find };
}
test('removing a query keeps keyboard focus on the adjacent query', () => {
  const h = searchPresentation(['Billie Eilish', 'Miles Davis']);
  const remove = h.find('Remove search for Miles Davis'); remove.focus(); remove.onClick();
  assert.deepEqual(h.history.queries(), ['Billie Eilish']);
  assert.equal(h.document.activeElement?.getAttribute('aria-label'), 'Search for Billie Eilish');
});
for (const action of ['Remove search for Miles Davis', 'Clear searches']) {
  test(`${action} returns focus to search when no queries remain`, () => {
    const h = searchPresentation(['Miles Davis']), button = h.find(action);
    button.focus(); button.onClick();
    assert.deepEqual(h.history.queries(), []);
    assert.equal(h.document.activeElement, h.searchInput);
  });
}
test('the continuation button announces the current play or pause action', () => {
  const p = presentation(), target = p.button('Play Song', null, () => {}, 'dusk-resume');
  target.dataset.duskTrackKey = 'song'; target.setAttribute('data-dusk-resume', '');
  const marker = p.node('span'), title = p.node('strong', '', 'Song');
  target.querySelector = selector => selector === '.dusk-track-indicator' ? marker : selector === '.dusk-resume-meta strong' ? title : null;
  p.document.querySelectorAll = () => [target];
  const core = { state: { currentTrack: { id: 'song', title: 'Song' }, trackLoading: false },
    audio: { paused: false }, trackKey: track => track.id, refreshTrackSelection() {} };
  const ctx = { ...p, core, ui: UI, feedbackLive: p.node('span') };
  vm.createContext(ctx);
  vm.runInContext(between(mobile, '    function syncPlaybackFeedback(', '    function trackRow('), ctx);
  ctx.syncPlaybackFeedback();
  assert.equal(target.getAttribute('aria-label'), 'Pause Song');
  core.audio.paused = true; ctx.syncPlaybackFeedback();
  assert.equal(target.getAttribute('aria-label'), 'Play Song');
  core.state.trackLoading = true; ctx.syncPlaybackFeedback();
  assert.equal(target.getAttribute('aria-label'), 'Loading Song…');
});
function homePlaylist(playlists) {
  const p = presentation(), homeContent = p.node('div');
  const core = { state: { playlists, currentTrack: null }, trackKey: t => t.id, thumb: () => '',
    getHomeSnapshot: () => ({ recent: [{ id: 'song', title: 'Song' }], artists: [], mixes: [], trending: [], wave: [] }) };
  const ctx = { ...p, core, ui: UI, homeContent, homeFilter: 'for-you', filters: { querySelectorAll: () => [] },
    root: { dataset: { duskHideRecommendations: 'true', duskHideArtists: 'true' } },
    section() { const e = p.node('section'); homeContent.append(e); return e; },
    markTrack(e, track) { e.dataset.duskTrackKey = track.id; return e; },
    trackTile: () => p.node('button'), syncPlaybackFeedback() {}, play() {}, route() {} };
  vm.createContext(ctx);
  vm.runInContext(between(mobile, '    function renderHome(', '    function renderSearchHistory('), ctx);
  ctx.renderHome();
  return p.buttons.find(e => e.className === 'dusk-resume' && !e.dataset.duskTrackKey)?.getAttribute('aria-label');
}
test('home chooses the latest saved playlist after manual library reordering', () => {
  const saved = { id: 'old', name: 'Recently saved', createdAt: 10, updatedAt: 30, tracks: [{}] };
  const newer = { id: 'new', name: 'Newer creation', createdAt: 20, updatedAt: 20, tracks: [{}] };
  assert.equal(homePlaylist([saved, newer]), 'Recently saved');
  assert.equal(homePlaylist([newer, saved]), 'Recently saved');
});
test('home understands both legacy playlist creation IDs and ignores empty playlists', () => {
  const older = { id: 'pl_1731500000000', name: 'Older', tracks: [{}] };
  const newer = { id: 'pl_' + (1731600000000).toString(36) + 'abcde', name: 'Newer', tracks: [{}] };
  assert.equal(homePlaylist([newer, older, { id: 'pl_1731700000000', name: 'Empty', tracks: [] }]), 'Newer');
});
test('a newly saved playlist persists its creation and save time', () => {
  const store = memory(), ctx = { state: { playlists: [] }, localStorage: store,
    Date: { now: () => 1731500000000 }, Math, stampAddedAt: track => track,
    renderPlaylistsList() {}, openPlaylistDetail() {} };
  vm.createContext(ctx);
  vm.runInContext(between(app, '  function createPlaylist(', '  function openPlaylistDetail('), ctx);
  ctx.createPlaylist('New playlist', [{ id: 'song' }]);
  const playlist = JSON.parse(store.getItem('devsize_playlists'))[0];
  assert.equal(playlist.createdAt, 1731500000000);
  assert.equal(playlist.updatedAt, 1731500000000);
});
