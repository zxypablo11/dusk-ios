/* Dusk's mobile presentation. Playback and library mutations stay in DuskCore. */
(function () {
  'use strict';
  const root = document.documentElement;
  if (!root.classList.contains('is-mobile')) return;
  root.classList.add('dusk-mobile');
  const $ = id => document.getElementById(id);
  const I = window.DuskI18n;
  const paths = {
    discover: '<circle cx="12" cy="12" r="9"/><path d="m16 8-3 5-5 3 3-5Z"/>',
    library: '<path d="M5 4v16M11 4v16M16 5l4 14"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    settings: '<path d="M4 7h16M4 17h16M9 4v6M15 14v6"/>',
    back: '<path d="m14 6-6 6 6 6"/>', down: '<path d="m6 9 6 6 6-6"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    play: '<path d="m9 5 11 7-11 7Z" fill="currentColor" stroke="none"/>',
    pause: '<path d="M8 5v14M16 5v14" stroke-width="4"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    heart: '<path d="M20 5c-3-3-7-1-8 1-1-2-5-4-8-1-4 4 2 10 8 15 6-5 12-11 8-15Z"/>',
    download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
    album: '<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="12" cy="12" r="4"/>',
    artist: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
    history: '<path d="M3 11a9 9 0 1 1 2 7M3 4v7h7m2-5v6l4 2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    note: '<path d="M9 18V5l11-2v13"/><ellipse cx="6" cy="18" rx="3" ry="2"/><ellipse cx="17" cy="16" rx="3" ry="2"/>',
    next: '<path d="m9 6 6 6-6 6"/>',
  };
  function icon(name) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    for (const [k,v] of Object.entries({ viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.7', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' })) svg.setAttribute(k, v);
    svg.innerHTML = paths[name] || paths.note;
    return svg;
  }
  function node(tag, className, text, literal = false) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) {
      if (literal) { el.textContent = text; el.setAttribute('data-no-i18n', ''); }
      else I.text(el, text);
    }
    return el;
  }
  function button(label, name, run, className = 'dusk-icon-button') {
    const el = node('button', className); el.type = 'button';
    el.setAttribute('aria-label', I.T(label));
    el.dataset.label = label;
    if (name) el.append(icon(name));
    if (className !== 'dusk-icon-button') el.append(node('span', '', label));
    el.addEventListener('click', run);
    return el;
  }
  function init() {
    const core = window.DuskCore;
    if (!core || $('dusk-header')) return;
    const ui = window.DuskUiCore;
    const history = ui.createHistory(localStorage);
    let tab = 'discover', homeFilter = 'for-you', view = 'dusk-home', playerTab = 'player';
    let previousFocus = null, renderFrame = 0, drawerOpen = false;
    const main = $('main-content'), panel = $('right-panel'), playbar = $('playbar');
    const playerAnchor = document.createComment('Dusk mini player position');
    playbar.before(playerAnchor);
    const header = node('header', 'dusk-header'); header.id = 'dusk-header';
    const back = button('Back', 'back', () => {
      if (view === 'settings' && window.DuskSettingsBack?.()) return;
      route(tab === 'search' ? 'discover' : tab === 'library' ? 'dusk-library' : 'dusk-home');
    });
    const brand = node('div', 'dusk-header-brand');
    const heading = node('h1', '', 'Dusk', true); brand.append(heading);
    // Quiet easter egg: seven taps on the wordmark draw the horizon once.
    let brandTaps = 0, brandTapTimer = 0;
    brand.addEventListener('click', () => {
      clearTimeout(brandTapTimer);
      brandTaps += 1;
      brandTapTimer = setTimeout(() => { brandTaps = 0; }, 900);
      if (brandTaps < 7) return;
      brandTaps = 0;
      header.classList.remove('dusk-horizon-flash');
      void header.offsetWidth;
      header.classList.add('dusk-horizon-flash');
    });
    header.append(back, brand, button('Settings', 'settings', () => route('settings')));
    document.body.append(header);
    const nav = node('nav', 'dusk-tabbar'); nav.setAttribute('aria-label', I.T('Main navigation')); nav.id = 'dusk-tabbar';
    for (const [key,label,target] of [['discover','Discover','dusk-home'],['library','Library','dusk-library'],['search','Search','discover']]) {
      const b = button(label, key, () => { tab = key; route(target); }, 'dusk-tab'); b.dataset.tab = key; nav.append(b);
    }
    document.body.append(nav);
    const home = node('section', 'content-view dusk-home'); home.id = 'view-dusk-home';
    const filters = node('div', 'dusk-filters'); filters.setAttribute('role', 'group'); filters.setAttribute('aria-label', I.T('Discover'));
    for (const [key,label] of [['for-you','For you'],['new','Trending'],['mixes','Mixes']]) {
      const b = button(label, null, () => { homeFilter = key; renderHome(); }, 'dusk-filter'); b.dataset.filter = key; filters.append(b);
    }
    const homeContent = node('div', 'dusk-home-content'); home.append(filters, homeContent);
    const library = node('section', 'content-view dusk-library'); library.id = 'view-dusk-library';
    const libraryContent = node('div'); library.append(libraryContent);
    main.prepend(home, library);
    const searchHint = node('div', 'dusk-search-hint');
    $('view-discover').prepend(searchHint);
    const feedbackLive = node('span', 'dusk-sr-only');
    feedbackLive.setAttribute('role', 'status'); feedbackLive.setAttribute('aria-live', 'polite');
    document.body.append(feedbackLive);

    // Retire controls whose desktop layouts have been replaced by this shell.
    for (const id of ['settings-slider-scale','setting-home-layout','setting-search-pos-row','btn-show-local','btn-show-albums','btn-show-artists','btn-wavy-progress','btn-progress-knob','btn-progress-bg','btn-no-hand-cursor']) {
      const control = $(id);
      (control?.closest('.setting-item') || control)?.classList.add('gs-retired');
    }
    const settingsOverview = node('div', 'dusk-settings-overview');
    const primarySettings = node('div', 'dusk-library-shortcuts');
    const settingsGroups = [
      ['Language & interface', 'library', 'interface'], ['Appearance', 'settings', 'theme'],
      ['Playback & library', 'note', 'tracks'], ['Downloads & storage', 'download', 'storage'],
      ['Profiles', 'artist', 'profiles'], ['Sync', 'history', 'sync'],
    ];
    function settingsLink(label, name, category) {
      const b = button(label, name, () => window.showSettingsCategory(category), 'dusk-library-link');
      b.append(icon('next')); return b;
    }
    for (const [label,name,category] of settingsGroups) primarySettings.append(settingsLink(label,name,category));
    const moreSettings = node('details', 'dusk-more-settings');
    moreSettings.append(node('summary', '', 'More settings'));
    for (const [label,category] of [['Integrations','integrations'],['Advanced','advanced'],['Plugins','plugins'],['About Dusk','about']]) moreSettings.append(settingsLink(label,'settings',category));
    settingsOverview.append(primarySettings, moreSettings);
    document.querySelector('#view-settings .settings-layout').before(settingsOverview);

    function route(target) {
      core.navigate(target);
    }
    function syncView(next) {
      view = next;
      if (next === 'dusk-home') tab = 'discover';
      if (next === 'dusk-library') tab = 'library';
      if (next === 'discover') tab = 'search';
      document.body.dataset.duskView = next;
      const isRoot = ['dusk-home','dusk-library','discover'].includes(next);
      back.hidden = isRoot;
      header.lastElementChild.hidden = next === 'settings';
      const titles = { 'dusk-home': 'Dusk', 'dusk-library': 'Library', discover: 'Search', settings: 'Settings', favorites: 'Liked songs', local: 'Downloads & files', albums: 'Albums', artists: 'Artists', history: 'Recently played', 'playlist-detail': 'Playlist', album: 'Album', artist: 'Artist' };
      I.text(heading, titles[next] || 'Dusk');
      nav.querySelectorAll('button').forEach(b => b.setAttribute('aria-current', b.dataset.tab === tab ? 'page' : 'false'));
      main.scrollTop = 0;
      if (next === 'dusk-home') renderHome();
      if (next === 'dusk-library') renderLibrary();
      if (next === 'discover') renderSearchHistory();
    }
    function cover(track, className = 'dusk-cover') {
      const box = node('div', className); box.append(icon('note'));
      const src = core.thumb(track) || track?.thumbnail || track?.cover;
      if (src && /^(https?:|data:image\/|blob:|capacitor:)/.test(src)) {
        const img = node('img'); img.alt = ''; img.loading = 'lazy'; img.decoding = 'async';
        img.addEventListener('error', () => img.remove(), { once: true }); img.src = src; box.append(img);
      }
      return box;
    }
    function play(track, tracks, index) {
      core.state.myWaveActive = false;
      core.playTrack(track, tracks, index);
    }
    function markTrack(target, track) {
      target.dataset.duskTrackKey = core.trackKey(track);
      return target;
    }
    function syncPlaybackFeedback() {
      const currentKey = core.state.currentTrack ? core.trackKey(core.state.currentTrack) : '';
      core.refreshTrackSelection();
      for (const target of document.querySelectorAll('[data-dusk-track-key], .track-row')) {
        const key = target.dataset.duskTrackKey || (target.classList.contains('playing') ? target.dataset.canonicalId : '');
        const phase = ui.playbackPhase(key, currentKey, core.state.trackLoading, core.audio.paused);
        target.dataset.duskPlayback = phase;
        if (phase === 'idle') { target.removeAttribute('aria-current'); target.removeAttribute('aria-busy'); }
        else { target.setAttribute('aria-current', 'true'); target.setAttribute('aria-busy', String(phase === 'loading')); }
        if (target.hasAttribute('data-dusk-resume')) {
          const title = target.querySelector('.dusk-resume-meta strong')?.textContent || '';
          target.setAttribute('aria-label', I.Tf(phase === 'playing' ? 'Pause {0}' : phase === 'loading' ? 'Loading {0}…' : 'Play {0}', title));
        }
        let marker = target.querySelector('.dusk-track-indicator');
        if (!marker && phase !== 'idle') {
          const title = target.querySelector('.dusk-song-meta strong, .dusk-resume-meta strong, .track-row-title, .dusk-hero-caption h2, :scope > strong');
          if (title) {
            const line = node(title.tagName === 'H2' ? 'div' : 'span', 'dusk-track-title-line');
            marker = node('span', 'dusk-track-indicator'); marker.setAttribute('aria-hidden', 'true');
            title.before(line); line.append(title, marker);
          }
        }
        if (marker && marker.dataset.phase !== phase) {
          marker.dataset.phase = phase;
          marker.replaceChildren(...(phase === 'playing' ? [icon('play')] : phase === 'paused' ? [icon('pause')] : []));
        }
      }
      const track = core.state.currentTrack;
      const phase = ui.playbackPhase(currentKey, currentKey, core.state.trackLoading, core.audio.paused);
      const label = track ? I.Tf(phase === 'loading' ? 'Loading {0}…' : phase === 'playing' ? 'Playing {0}' : 'Paused {0}', track.title || I.T('Untitled')) : '';
      if (feedbackLive.textContent !== label) feedbackLive.textContent = label;
    }
    function trackRow(track, tracks, index) {
      const row = node('div', 'dusk-song');
      const start = button('Play', null, () => play(track, tracks, index), 'dusk-song-play'); start.replaceChildren(cover(track));
      start.setAttribute('aria-label', I.Tf('Play {0}', track.title || ''));
      const meta = node('span', 'dusk-song-meta'); meta.append(node('strong', '', track.title || I.T('Untitled'), true), node('small', '', track.artist || '', true));
      start.append(meta);
      const more = button('Track options', 'more', () => core.trackMenu(track, more));
      markTrack(start, track); row.append(start, more); return row;
    }
    function trackTile(track, tracks, index) {
      const b = button('Play', null, () => play(track, tracks, index), 'dusk-rail-tile');
      b.setAttribute('aria-label', I.Tf('Play {0}', track.title || ''));
      b.replaceChildren(cover(track, 'dusk-cover dusk-rail-cover'), node('strong', '', track.title || I.T('Untitled'), true), node('small', '', track.artist || '', true));
      return markTrack(b, track);
    }
    function section(title, action) {
      const sec = node('section', 'dusk-section');
      const head = node('div', 'dusk-section-head'); head.append(node('h2', '', title));
      if (action) head.append(button('See all', null, action, 'dusk-text-button'));
      sec.append(head); homeContent.append(sec); return sec;
    }
    function empty(title, detail, label, action) {
      const box = node('div', 'dusk-empty');
      box.append(node('h2', '', title), node('p', '', detail));
      if (action) box.append(button(label, null, action, 'dusk-primary-button'));
      return box;
    }
    function renderHome() {
      filters.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.filter === homeFilter)));
      homeContent.replaceChildren();
      const data = core.getHomeSnapshot();
      const recommendations = root.dataset.duskHideRecommendations !== 'true';
      const recent = root.dataset.duskHideRecent !== 'true';
      const artists = root.dataset.duskHideArtists !== 'true';
      if (homeFilter === 'for-you' && recent && data.recent.length) {
        const sec = section('Continue listening'); sec.classList.add('dusk-continuation');
        const grid = node('div', 'dusk-resume-grid');
        const track = data.recent[0];
        const resume = button('Play', null, () => {
          if (core.state.currentTrack && core.trackKey(core.state.currentTrack) === core.trackKey(track)) {
            if (!core.state.trackLoading) core.togglePlay();
          } else play(track, data.recent, 0);
        }, 'dusk-resume');
        const meta = node('span', 'dusk-resume-meta');
        meta.append(node('strong', '', track.title || I.T('Untitled'), true), node('small', '', track.artist || '', true));
        resume.replaceChildren(cover(track), meta); resume.setAttribute('aria-label', I.Tf('Play {0}', track.title || ''));
        resume.setAttribute('data-dusk-resume', '');
        grid.append(markTrack(resume, track));
        const playlist = ui.mostRecentPlaylist(core.state.playlists);
        if (playlist) {
          const open = button('Playlist', null, () => core.openPlaylist(playlist.id), 'dusk-resume');
          const info = node('span', 'dusk-resume-meta');
          info.append(node('strong', '', playlist.name, true), node('small', '', I.Tf('{0} tracks', playlist.tracks.length), true));
          open.replaceChildren(cover({ thumbnail: playlist.cover || core.thumb(playlist.tracks[0]) }), info);
          open.setAttribute('aria-label', playlist.name); grid.append(open);
        }
        sec.append(grid);
      }
      if (homeFilter === 'mixes') {
        if (data.mixes.length) {
          const grid = node('div', 'dusk-mix-grid');
          for (const mix of data.mixes) {
            if (!mix.tracks?.length) continue;
            const b = button('Play', null, () => play(mix.tracks[0], mix.tracks, 0), 'dusk-mix');
            b.replaceChildren(cover(mix.tracks[0]), node('strong', '', mix.title, true), node('small', '', (mix.artists || []).join(', '), true));
            b.setAttribute('aria-label', I.Tf('Play {0}', mix.title)); grid.append(markTrack(b, mix.tracks[0]));
          }
          homeContent.append(grid);
        } else homeContent.append(empty(data.loading ? 'Creating your mixes' : 'Your mixes start with you', 'Listen to a few songs and save your favorites. Your personal mixes will appear here.', 'Find music', () => route('discover')));
      } else if (recommendations || homeFilter === 'new') {
        const tracks = homeFilter === 'new' ? data.trending : data.wave.length ? data.wave : data.trending;
        if (tracks.length) {
          const hero = node('article', 'dusk-hero');
          const art = cover(tracks[0], 'dusk-hero-cover');
          const startHero = () => play(tracks[0], tracks, 0);
          art.addEventListener('click', (e) => { if (!e.target.closest('button')) startHero(); });
          const caption = node('div', 'dusk-hero-caption');
          const text = node('div');
          text.append(node('h2', '', tracks[0].title || I.T('Untitled'), true), node('p', '', tracks[0].artist || '', true));
          caption.append(text, button('Play recommendations', 'play', startHero));
          art.append(caption);
          hero.append(art);
          homeContent.append(markTrack(hero, tracks[0]));
          if (homeFilter === 'for-you' && tracks.length > 1) {
            const sec = section('Listen next');
            const rail = node('div', 'dusk-rail');
            tracks.slice(1, 14).forEach((track, i) => rail.append(trackTile(track, tracks, i + 1)));
            sec.append(rail);
          }
          if (homeFilter === 'new') { const sec = section('Trending now'); tracks.slice(1, 16).forEach((track,i) => sec.append(trackRow(track, tracks, i + 1))); }
        } else {
          homeContent.append(empty(data.loading ? 'Finding music for you' : 'Ready when you are', navigator.onLine === false ? 'You are offline. Your downloaded music is in your library.' : data.error ? 'Recommendations could not be loaded. Search for music or try again.' : 'Search for a song to start your collection.', data.loading ? 'Search music' : data.error ? 'Try again' : 'Search music', () => data.error && !data.loading ? core.refreshHome() : route('discover')));
        }
      }
      if (homeFilter === 'for-you' && recent) {
        const sec = section('Recently played', () => route('history'));
        if (data.recent.length) {
          const rail = node('div', 'dusk-rail');
          data.recent.slice(0, 10).forEach((track, i) => rail.append(trackTile(track, data.recent, i)));
          sec.append(rail);
        } else sec.append(node('p', 'dusk-muted', 'The songs you play will appear here.'));
      }
      if (homeFilter === 'for-you' && artists && data.artists.length) {
        const sec = section('Your artists', () => route('artists'));
        const row = node('div', 'dusk-artist-row');
        for (const artist of data.artists.slice(0, 8)) {
          const b = button('Artist', null, () => core.openArtist(artist), 'dusk-artist');
          b.replaceChildren(cover({ thumbnail: artist.avatar }), node('span', '', artist.name, true)); row.append(b);
        }
        sec.append(row);
      }
      if (!homeContent.children.length) homeContent.append(empty('Make yourself at home', 'Choose what appears here in the theme editor.', 'Settings', () => route('settings')));
      syncPlaybackFeedback();
    }
    function renderSearchHistory(focusQuery) {
      searchHint.replaceChildren();
      const queries = history.queries(), artists = history.artists();
      if (queries.length) {
        const head = node('div', 'dusk-section-head');
        head.append(node('h2', '', 'Recent searches'), button('Clear searches', null, () => { core.dismissSearch(); history.clearQueries(); renderSearchHistory(''); }, 'dusk-text-button'));
        searchHint.append(head);
        for (const query of queries) {
          const row = node('div', 'dusk-search-history-row');
          const run = button('Search', 'history', () => core.search(query), 'dusk-search-history-query');
          run.dataset.historyQuery = query;
          run.replaceChildren(icon('history'), node('span', '', query, true)); run.setAttribute('aria-label', I.Tf('Search for {0}', query));
          const remove = button('Remove search', 'close', () => {
            const index = queries.indexOf(query), next = queries[index + 1] || queries[index - 1] || '';
            history.removeQuery(query); renderSearchHistory(next);
          });
          remove.setAttribute('aria-label', I.Tf('Remove search for {0}', query));
          row.append(run, remove); searchHint.append(row);
        }
      }
      if (artists.length) {
        const section = node('section', 'dusk-search-artists'); section.append(node('h2', '', 'Recently visited artists'));
        for (const artist of artists) {
          const open = button('Artist', null, () => core.openArtist(artist), 'dusk-search-history-query');
          open.replaceChildren(cover({ thumbnail: artist.avatar }), node('span', '', artist.name, true));
          open.setAttribute('aria-label', artist.name); section.append(open);
        }
        searchHint.append(section);
      }
      if (!queries.length && !artists.length) searchHint.append(node('h2', '', 'Find music'), node('p', '', 'Search for songs, artists or albums.'));
      updateSearchHint();
      if (focusQuery !== undefined) {
        const next = [...searchHint.querySelectorAll('[data-history-query]')].find(el => el.dataset.historyQuery === focusQuery);
        (next || $('search-input'))?.focus();
      }
    }
    function renderLibrary() {
      libraryContent.replaceChildren();
      const shortcuts = node('div', 'dusk-library-shortcuts');
      for (const [label,name,target] of [['Liked songs','heart','favorites'],['Downloads & files','download','local'],['Albums','album','albums'],['Artists','artist','artists'],['Recently played','history','history']]) {
        const b = button(label, name, () => route(target), 'dusk-library-link'); b.append(icon('next')); shortcuts.append(b);
      }
      libraryContent.append(shortcuts);
      const head = node('div', 'dusk-section-head'); head.append(node('h2', '', 'Your playlists'), button('Create playlist', 'plus', () => $('btn-new-playlist').click())); libraryContent.append(head);
      if (!core.state.playlists.length) libraryContent.append(node('p', 'dusk-muted', 'Keep your favorite songs together. Create your first playlist.'));
      for (const playlist of core.state.playlists) {
        const b = button('Playlist', null, () => core.openPlaylist(playlist.id), 'dusk-playlist-link');
        b.setAttribute('aria-label', playlist.name);
        b.replaceChildren(cover({ thumbnail: playlist.cover || core.thumb(playlist.tracks?.[0]) }), node('strong', '', playlist.name, true), node('small', '', I.Tf('{0} tracks', playlist.tracks?.length || 0), true), icon('next')); libraryContent.append(b);
      }
    }

    // The existing sheet and transport become one accessible dialog while open.
    const playerHead = node('div', 'dusk-player-head');
    const playerTitle = node('span', '', 'Now playing'); playerTitle.id = 'dusk-player-title';
    const playerMore = button('Track options', 'more', () => { if (core.state.currentTrack) core.trackMenu(core.state.currentTrack, playerMore); });
    const close = button('Close player', 'down', () => core.closePlayer());
    playerHead.append(close, playerTitle, playerMore); panel.prepend(playerHead);
    const offline = button('Save offline', 'download', () => { if (core.state.currentTrack) core.download(core.state.currentTrack); }, 'dusk-offline-button');
    const playbackStatus = node('p', 'dusk-playback-status');
    playbackStatus.setAttribute('role', 'status');
    $('right-panel-artwork-box').append(offline, playbackStatus);
    let attemptedLoad = false;
    let streamFail = null;
    function streamFailMessage(code) {
      if (code === 'YT_LOGIN') return 'YouTube blocked this stream. Try another search result or play an offline track.';
      if (code === 'NETWORK') return "Couldn't reach the stream. Check your connection and try again.";
      return 'This source could not play the song. Try another result from search.';
    }
    function playbackState() {
      if (core.state.trackLoading) {
        attemptedLoad = true;
        streamFail = null;
        I.text(playbackStatus, 'Loading audio…');
      } else if (streamFail) {
        I.text(playbackStatus, streamFailMessage(streamFail));
      } else if (attemptedLoad && core.audio.readyState === 0) {
        I.text(playbackStatus, streamFailMessage(''));
      } else playbackStatus.textContent = '';
    }
    window.addEventListener('dusk:loading', playbackState);
    window.addEventListener('dusk:stream-error', (e) => {
      streamFail = (e.detail && e.detail.code) || 'YT_NO_STREAM';
      attemptedLoad = true;
      playbackState();
    });
    const seek = node('input', 'dusk-seek'); seek.type = 'range'; seek.min = '0'; seek.max = '0'; seek.step = '0.1'; seek.value = '0'; seek.disabled = true;
    seek.setAttribute('aria-label', I.T('Playback position')); seek.dataset.label = 'Playback position';
    $('scrubber-track').after(seek);
    seek.addEventListener('input', () => core.seek(Number(seek.value)));
    function updateSeek() {
      const duration = core.audio.duration;
      seek.disabled = !Number.isFinite(duration) || duration <= 0;
      seek.max = seek.disabled ? '0' : String(duration);
      seek.value = String(core.audio.currentTime || 0);
      seek.style.setProperty('--dusk-played', `${seek.disabled ? 0 : (core.audio.currentTime / duration * 100)}%`);
      seek.setAttribute('aria-valuetext', core.formatDuration(core.audio.currentTime || 0));
    }
    for (const event of ['timeupdate', 'durationchange', 'emptied', 'loadedmetadata']) core.audio.addEventListener(event, updateSeek);
    core.audio.addEventListener('playing', () => { attemptedLoad = false; playbackState(); });
    updateSeek();
    const footer = node('div', 'dusk-player-footer');
    for (const [key,label] of [['player','Player'],['lyrics','Lyrics'],['queue','Queue']]) {
      const b = button(label, null, () => { playerTab = key; core.openPlayer(key === 'queue' ? 'queue' : 'now'); }, 'dusk-player-tab'); b.dataset.playerTab = key; footer.append(b);
    }
    playbar.append(footer);
    const inertTargets = [main, header, nav, document.querySelector('.top-nav'), document.querySelector('.sidebar')];
    function syncDrawer({ open, tab: drawerTab }) {
      if (open && !drawerOpen) { previousFocus = document.activeElement; playerTab = drawerTab === 'queue' ? 'queue' : 'player'; panel.append(playbar); }
      if (drawerTab === 'queue') playerTab = 'queue';
      else if (playerTab === 'queue') playerTab = 'player';
      document.body.dataset.duskPlayerTab = playerTab;
      document.body.classList.toggle('np-open', open);
      footer.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.playerTab === playerTab)));
      inertTargets.forEach(el => { if (el) el.inert = open; });
      if (open) { panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-labelledby', playerTitle.id); }
      else { panel.removeAttribute('role'); panel.removeAttribute('aria-modal'); playerAnchor.after(playbar); }
      if (open !== drawerOpen) requestAnimationFrame(() => open ? close.focus({ preventScroll: true }) : previousFocus?.focus?.({ preventScroll: true }));
      drawerOpen = open;
    }
    panel.addEventListener('keydown', event => {
      if (event.key !== 'Tab' || !drawerOpen || document.querySelector('.modal-backdrop:not(.hidden), dialog[open]')) return;
      const buttons = [...panel.querySelectorAll('button, input, [tabindex="0"]')].filter(el => !el.disabled && el.getClientRects().length);
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    });
    function syncTrack() {
      const hasTrack = !!core.state.currentTrack;
      document.body.classList.toggle('dusk-has-track', hasTrack);
      const isLocal = core.state.currentTrack?.platform === 'local';
      offline.disabled = !hasTrack || isLocal;
      const offlineLabel = isLocal ? 'Available offline' : 'Save offline';
      I.text(offline.querySelector('span'), offlineLabel);
      offline.dataset.label = offlineLabel; offline.setAttribute('aria-label', I.T(offlineLabel));
      playerMore.disabled = !hasTrack;
      syncPlaybackFeedback();
      scheduleRender();
    }
    function scheduleRender() {
      if (renderFrame) return;
      renderFrame = requestAnimationFrame(() => { renderFrame = 0; if (view === 'dusk-home') renderHome(); if (view === 'dusk-library') renderLibrary(); });
    }
    function updateSearchHint() { searchHint.hidden = !$('search-results-container').classList.contains('hidden'); }
    new MutationObserver(updateSearchHint).observe($('search-results-container'), { attributes: true, attributeFilter: ['class'] });
    updateSearchHint();
    window.addEventListener('dusk:search', e => { history.rememberQuery(e.detail.query); renderSearchHistory(); });
    window.addEventListener('dusk:artist', e => { history.rememberArtist(e.detail); renderSearchHistory(); });
    window.addEventListener('dusk:loading', syncPlaybackFeedback);
    for (const event of ['play','playing','pause','ended','error']) core.audio.addEventListener(event, syncPlaybackFeedback);
    new MutationObserver(changes => {
      if (changes.some(change => [...change.addedNodes].some(item => item.nodeType === 1 && (item.matches('[data-dusk-track-key], .track-row') || item.querySelector('[data-dusk-track-key], .track-row'))))) syncPlaybackFeedback();
    }).observe(main, { childList: true, subtree: true });
    window.addEventListener('dusk:view', e => syncView(e.detail.view));
    window.addEventListener('dusk:drawer', e => syncDrawer(e.detail));
    window.addEventListener('dusk:track', syncTrack);
    for (const event of ['dusk:home','dusk:library','online','offline']) window.addEventListener(event, scheduleRender);
    new MutationObserver(scheduleRender).observe(root, { attributes: true, attributeFilter: ['data-dusk-hide-recent','data-dusk-hide-recommendations','data-dusk-hide-artists'] });
    window.addEventListener('dusk:i18n', () => {
      document.querySelectorAll('[data-label]').forEach(el => el.setAttribute('aria-label', I.T(el.dataset.label)));
      nav.setAttribute('aria-label', I.T('Main navigation'));
      filters.setAttribute('aria-label', I.T('Discover'));
      syncView(view);
      syncTrack();
      renderSearchHistory();
    });
    syncTrack();
    syncDrawer({ open: core.state.isRightPanelOpen, tab: core.state.drawerTab });
    route('dusk-home');
  }
  if (window.DuskCore) init(); else window.addEventListener('dusk:ready', init, { once: true });
})();
