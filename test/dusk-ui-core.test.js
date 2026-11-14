'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHistory, playbackPhase } = require('../mobile/dusk-ui-core');
const P = require('../profiles-core');
const fs = require('node:fs');
const vm = require('node:vm');
function storage() {
  const values = new Map();
  return { getItem:key=>values.get(key) ?? null, setItem:(key,value)=>values.set(key,String(value)), removeItem:key=>values.delete(key), values };
}

test('completed queries persist with case-insensitive deduplication and latest spelling', () => {
  const store=storage(), history=createHistory(store);
  history.rememberQuery('  Billie   Eilish  ');
  history.rememberQuery('Nina Simone');
  history.rememberQuery('billie eilish');
  assert.deepEqual(createHistory(store).queries(),['billie eilish','Nina Simone']);
});
test('recent searches are bounded and each can be removed or cleared', () => {
  const history=createHistory(storage());
  for (let i=0;i<12;i++) history.rememberQuery('Song '+i);
  assert.deepEqual(history.queries(),['Song 11','Song 10','Song 9','Song 8','Song 7','Song 6','Song 5','Song 4']);
  history.removeQuery('song 9');
  assert.equal(history.queries().includes('Song 9'),false);
  history.clearQueries(); assert.deepEqual(history.queries(),[]);
});
test('empty, malformed and oversized queries cannot pollute search history', () => {
  const history=createHistory(storage());
  for (const value of ['', '   ', null, {}, 'x'.repeat(161)]) history.rememberQuery(value);
  assert.deepEqual(history.queries(),[]);
});
test('corrupt history and unavailable storage do not prevent UI use', () => {
  for (const value of ['invalid','{}','[null,3,"",{"query":"x"}]']) {
    const store=storage(); store.setItem('dusk_recent_searches_v1',value);
    assert.deepEqual(createHistory(store).queries(),[]);
  }
  const history=createHistory({getItem(){throw Error('blocked');},setItem(){throw Error('full');},removeItem(){throw Error('blocked');}});
  assert.doesNotThrow(()=>{history.rememberQuery('Miles Davis');history.removeQuery('Miles Davis');history.clearQueries();});
  assert.deepEqual(history.queries(),[]);
});
test('successfully visited artists stay bounded and preserve distinct artist IDs', () => {
  const history=createHistory(storage());
  history.rememberArtist({name:'Phoenix',id:'one',avatar:'https://example.com/one.jpg'});
  history.rememberArtist({name:'Phoenix',id:'two'});
  history.rememberArtist({name:'Phoenix',id:'one',avatar:'https://example.com/new.jpg'});
  assert.deepEqual(history.artists().map(a=>a.id),['one','two']);
  assert.equal(history.artists()[0].avatar,'https://example.com/new.jpg');
  history.rememberArtist({name:'',id:'bad'});
  for(let i=0;i<8;i++) history.rememberArtist({name:'Artist '+i,id:String(i)});
  assert.equal(history.artists().length,6);
  assert.equal(history.artists()[0].name,'Artist 7');
});
test('search and artist history are separate for each profile', () => {
  const values=new Map(), first=P.view(values,'default'), second=P.view(values,'second');
  const store=view=>({getItem:key=>view.getItem(key),setItem:(key,value)=>view.setItem(key,value),removeItem:key=>view.removeItem(key)});
  const a=createHistory(store(first)),b=createHistory(store(second));
  a.rememberQuery('Björk'); a.rememberArtist({name:'Björk',id:'artist'});
  assert.deepEqual(b.queries(),[]); assert.deepEqual(b.artists(),[]);
  b.rememberQuery('Daft Punk');
  assert.deepEqual(a.queries(),['Björk']); assert.deepEqual(b.queries(),['Daft Punk']);
});
test('loading wins over the paused element used while preparing audio', () => {
  assert.equal(playbackPhase('song','song',true,true),'loading');
  assert.equal(playbackPhase('song','song',false,true),'paused');
  assert.equal(playbackPhase('song','song',false,false),'playing');
});
test('a quick selection change removes the previous song state', () => {
  assert.equal(playbackPhase('old','new',true,true),'idle');
  assert.equal(playbackPhase('new','new',true,true),'loading');
  assert.equal(playbackPhase('','',true,true),'idle');
});
test('loading subscribers see the new selection before audio preparation completes', () => {
  const source=fs.readFileSync(require.resolve('../app.js'),'utf8');
  const setter=source.slice(source.indexOf('  function setTrackLoading(on)'),source.indexOf('  // every failure path asks this'));
  const from=source.indexOf('    state.loadToken++;',source.indexOf('  async function playTrack('));
  const selection=source.slice(from,source.indexOf('    if (queueList)',from));
  const state={currentTrack:{id:'old'},trackLoading:false,loadToken:1};
  const track={id:'new'}, events=new EventTarget();
  let observed;
  events.addEventListener('dusk:loading',()=>{observed=state.currentTrack.id;});
  vm.runInNewContext(setter+selection,{state,track,context:null,startIndex:-1,advancing:false,SKIP_CONTEXTS:new Set(),Event,window:events,AbortController,emitPluginEvent(){},onTrackAudioTrackChange(){}});
  assert.equal(observed,'new');
});
