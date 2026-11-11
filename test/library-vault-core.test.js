'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const V = require('../library-vault-core.js');

const YT = 'dQw4w9WgXcQ';

test('vault keeps playlist metadata and drops audio blobs and local paths', () => {
  const playlists = JSON.stringify([{
    id: 'pl_1',
    name: 'Mix',
    cover: 'data:image/png;base64,aaaa',
    tracks: [
      { title: 'Song', artist: 'A', id: YT, platform: 'youtube', url: `https://www.youtube.com/watch?v=${YT}`, thumbnail: `https://i.ytimg.com/vi/${YT}/hqdefault.jpg` },
      { title: 'Local', artist: 'B', id: 'local_abc123def456', platform: 'local', url: 'file:///tmp/song.m4a', thumbnail: 'data:image/jpeg;base64,bb' },
      { title: 'SC', artist: 'C', id: '99', platform: 'soundcloud', url: 'https://soundcloud.com/c/sc' },
    ],
  }]);
  const vault = V.makeVault(new Map([
    ['devsize_playlists', playlists],
    ['devsize_favorites', JSON.stringify([{ title: 'Fav', artist: 'A', id: YT, platform: 'youtube' }])],
    ['devsize_history', JSON.stringify([{ title: 'Old', artist: 'Z', id: YT, platform: 'youtube', thumbnail: 'data:image/png;base64,xx' }])],
    ['dusk_themes_v1', JSON.stringify({ version: 1, active: 'graphite' })],
    ['muriel_ui_lang', 'de'],
  ]));
  assert.equal(vault.kind, 'dusk-library-vault');
  assert.equal(vault.version, 1);
  const pl = JSON.parse(vault.data.devsize_playlists);
  assert.equal(pl[0].tracks[0].id, YT);
  assert.equal(pl[0].tracks[0].platform, 'youtube');
  assert.equal(pl[0].cover, undefined);
  assert.equal(pl[0].tracks[1].platform, 'local');
  assert.equal(pl[0].tracks[1].url, undefined);
  assert.equal(pl[0].tracks[1].thumbnail, undefined);
  assert.equal(pl[0].tracks[2].url, 'https://soundcloud.com/c/sc');
  const hist = JSON.parse(vault.data.devsize_history);
  assert.ok(!String(hist[0].thumbnail || '').startsWith('data:'));
  assert.match(hist[0].thumbnail, /^https:\/\/i\.ytimg\.com\//);
  assert.equal(vault.data.muriel_ui_lang, 'de');
  assert.ok(vault.data.dusk_themes_v1.includes('graphite'));
});

test('readVault roundtrips and rejects junk', () => {
  const made = V.makeVault(new Map([
    ['devsize_playlists', JSON.stringify([{ id: 'pl_a', name: 'A', tracks: [{ title: 'T', artist: 'X', id: YT, platform: 'youtube' }] }])],
    ['devsize_favorites', '[]'],
  ]));
  const read = V.readVault(made);
  assert.equal(read.counts.playlists, 1);
  assert.ok(read.entries.devsize_playlists);
  assert.throws(() => V.readVault({ kind: 'nope' }), /isn't a Dusk library backup/);
  assert.throws(() => V.parseVaultText('not json'), /isn't a Dusk library backup/);
});

test('isEmptyLibrary detects empty profiles', () => {
  assert.equal(V.isEmptyLibrary(() => null), true);
  assert.equal(V.isEmptyLibrary((k) => (k === 'devsize_playlists' ? '[]' : null)), true);
  assert.equal(V.isEmptyLibrary((k) => (k === 'devsize_favorites' ? JSON.stringify([{ title: 'a', id: YT, platform: 'youtube' }]) : null)), false);
});
