'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createStreamPlayback } = require('../mobile/stream-playback');

const URL = 'http://127.0.0.1:38472/api/stream-info?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3Dabcdefghijk&id=abcdefghijk&platform=youtube';
const target = 'https://www.youtube.com/watch?v=abcdefghijk';
const source = { kind: 'hls', url: 'https://manifest.googlevideo.com/audio.m3u8', headers: { 'User-Agent': 'resolver' }, ext: 'aac' };
const reply = data => ({ status: 200, headers: {}, body: JSON.stringify(data) });
const tick = () => new Promise(setImmediate);
function deferred() { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return { promise, resolve, reject }; }
function harness(options = {}) {
  const calls = [], starts = [], stops = [], timers = new Map();
  let timerId = 0;
  const call = async (url, init) => { calls.push({ url, init }); return options.call ? options.call(url,init) : reply(url.includes('cached_only=1') ? { success:false, code:'NOT_CACHED' } : { success:true, isLocal:true, streamUrl:'file' }); };
  const player = createStreamPlayback({
    call,
    resolveAudio: async value => { starts.push(['resolve', value]); return options.resolve ? options.resolve(value) : source; },
    plugin: {
      start: async value => { starts.push(['native', value]); return options.start ? options.start(value) : { id:'s1', url:'http://localhost:1234/s1/master.m3u8' }; },
      stop: async value => { stops.push(value.id); },
    },
    schedule: fn => { timers.set(++timerId, fn); return timerId; },
    cancel: id => timers.delete(id),
    log() {},
  });
  const runTimers = () => { for (const [id, fn] of [...timers]) { timers.delete(id); fn(); } };
  return { player, calls, starts, stops, runTimers };
}

test('cached songs return without resolving or starting a remote stream', async () => {
  const h = harness({ call: async () => reply({ success:true,isLocal:true,streamUrl:'cached' }) });
  const response = await h.player.lookup(URL);
  assert.equal(JSON.parse(response.body).streamUrl, 'cached');
  assert.equal(h.calls.length,1); assert.equal(h.starts.length,0);
});

test('a new song gets its HLS source without waiting for the complete audio download', async () => {
  const completeDownload = deferred();
  const h = harness({ call: async url => url.includes('cached_only=1') ? reply({ success:false,code:'NOT_CACHED' }) : completeDownload.promise });
  const answer = JSON.parse((await h.player.lookup(URL)).body);
  assert.equal(answer.isHls,true); assert.equal(answer.isLocal,false); assert.equal(answer.mobileStreamId,'s1');
  assert.equal(answer.streamUrl,'http://localhost:1234/s1/master.m3u8');
  assert.equal(h.calls.length,1, 'no full download blocks the tap');
  assert.deepEqual(h.starts[1][1], { url:source.url, headers:source.headers });
  h.player.release('s1'); await tick();
});

test('unsupported sources and native failures fall back to the existing download', async () => {
  for (const options of [{ resolve:async () => ({ url:'https://x/song.mp3',ext:'mp3' }) },{ start:async () => { throw Error('plugin unavailable'); } },{ resolve:async () => { throw Error('resolver failed'); } }]) {
    const h=harness(options);
    assert.equal(JSON.parse((await h.player.lookup(URL)).body).isLocal,true);
    assert.equal(h.calls.at(-1).url,URL);
  }
});

test('fresh retries, queue prefetches and cache requests retain the old path', async () => {
  for (const suffix of ['&fresh=1','&next=1','&cache=1','&cached_only=1']) {
    const h=harness(); await h.player.lookup(URL+suffix);
    assert.equal(h.calls.length,1); assert.equal(h.starts.length,0);
  }
});

test('aborting during resolution never starts a native player or fallback download', async () => {
  const pending=deferred(), controller=new AbortController();
  const h=harness({ resolve:() => pending.promise });
  const run=h.player.lookup(URL,{ signal:controller.signal }); await tick(); controller.abort();
  await assert.rejects(run,{ name:'AbortError' }); pending.resolve(source); await tick();
  assert.equal(h.starts.length,1); assert.equal(h.calls.length,1);
});

test('aborting native startup releases a late session and never attaches it', async () => {
  const pending=deferred(), controller=new AbortController();
  const h=harness({ start:() => pending.promise });
  const run=h.player.lookup(URL,{ signal:controller.signal }); await tick(); controller.abort();
  await assert.rejects(run,{ name:'AbortError' });
  pending.resolve({ id:'late',url:'http://localhost:1/late/master.m3u8' }); await tick();
  assert.deepEqual(h.stops,['late']); assert.equal(h.calls.length,1);
});

test('offline cache uses the same proxied segments once playback has started', async () => {
  const cache=deferred();
  const h=harness({ call:async url => url.includes('cached_only=1') ? reply({ success:false,code:'NOT_CACHED' }) : cache.promise });
  await h.player.lookup(URL); h.player.started('s1'); h.player.started('s1'); h.runTimers(); await tick();
  assert.equal(h.calls.length,2); assert.match(h.calls[1].url,/cache=1/);
  const download=h.player.downloadSource(target);
  assert.equal(download.url,'http://localhost:1234/s1/master.m3u8'); assert.deepEqual(download.headers,{});
  h.player.release('s1'); await tick(); assert.deepEqual(h.stops,[], 'cache still needs the proxy');
  cache.resolve(reply({ success:true })); await tick();
  assert.deepEqual(h.stops,['s1']); assert.equal(h.player.downloadSource(target),null);
});

test('a quick skip cancels scheduled caching and releases the streaming session', async () => {
  const h=harness(); await h.player.lookup(URL); h.player.started('s1'); h.player.release('s1');
  h.runTimers(); await tick();
  assert.equal(h.calls.length,1); assert.deepEqual(h.stops,['s1']);
});

test('a cache failure still releases the previous session', async () => {
  const cache=deferred();
  const h=harness({ call:async url => url.includes('cached_only=1') ? reply({ success:false,code:'NOT_CACHED' }) : cache.promise });
  await h.player.lookup(URL); h.player.started('s1'); h.runTimers(); await tick(); h.player.release('s1');
  cache.reject(Error('full storage')); await tick();
  assert.deepEqual(h.stops,['s1']);
});

test('cache-only server lookup never starts a complete audio download on a miss', async () => {
  const text=fs.readFileSync(require.resolve('../server.js'),'utf8');
  const start=text.indexOf('async function handleStreamInfo('), end=text.indexOf('const artistInFlight',start);
  let downloads=0,body;
  const handle=vm.runInNewContext(text.slice(start,end)+'\nhandleStreamInfo',{
    cleanTrackId:v=>v, findCachedFile:async()=>null,findDownloadedFile:async()=>null,
    streamUrlCache:new Map(),youtubeExtractTarget:url=>({url,youtube:true}),STREAM_VIA_CACHE:true,
    downloadProcs:new Map(),downloadTrackToDisk:async()=>{downloads++;},withToken:v=>v,PORT:38472,
    alternativeUploads:async()=>[],soundcloudFallback:async()=>null,streamFailCode:()=>'',streamFailMessage:()=>'',
  });
  await handle({on(){}},{writeHead(){},end(v){body=JSON.parse(v);}},target,'abcdefghijk','youtube','','',0,'',false,true);
  assert.equal(downloads,0); assert.equal(body.code,'NOT_CACHED');
});

test('a native stream failure after playback started retries the download and restores position', () => {
  const text=fs.readFileSync(require.resolve('../app.js'),'utf8');
  const from=text.indexOf('  function retryMobileStream('), to=text.indexOf('  async function attachStream(',from);
  assert.ok(from>=0, 'native stream failures need a mid-song fallback');
  let loading=false, retried=false;
  const track={id:'a'}, handlers=new Map();
  const audio={currentTime:37,duration:120,addEventListener:(name,fn)=>handlers.set(name,fn),removeEventListener:name=>handlers.delete(name)};
  const context={mobileStreamId:'s',state:{loadToken:2,currentTrack:track},el:{nativeAudio:audio},setTrackLoading:value=>{loading=value;},retryFresh:()=>{retried=true;return true;}};
  const retry=vm.runInNewContext(text.slice(from,to)+'\nretryMobileStream',context);
  assert.equal(retry(2,track),true); assert.equal(loading,true); assert.equal(retried,true);
  audio.currentTime=0; handlers.get('loadedmetadata')(); assert.equal(audio.currentTime,37);
  assert.equal(handlers.size,0);
  assert.equal(retry(1,track),false, 'an error from an old selection cannot restart it');
});
