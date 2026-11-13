// iPhone HLS starts with a playlist, while the existing downloader fills the offline cache later.
// The native proxy shares segments between those two readers, retaining the extractor's headers.
const abortError = () => Object.assign(new Error('Playback request aborted'), { name: 'AbortError' });
function keyOf(target) {
  const text = String(target || '');
  const video = text.match(/[?&]v=([\w-]{11})(?:[&#]|$)/);
  return video ? `youtube:${video[1]}` : text;
}
function guarded(promise, signal, dispose) {
  return new Promise((resolve,reject) => {
    let ended = false;
    const abort = () => { if (!ended) { ended=true; reject(abortError()); } };
    if (signal) {
      if (signal.aborted) abort(); else signal.addEventListener('abort',abort,{ once:true });
    }
    Promise.resolve(promise).then(value => {
      if (ended) { if (dispose) dispose(value); return; }
      ended=true; if (signal) signal.removeEventListener('abort',abort); resolve(value);
    },error => {
      if (ended) return;
      ended=true; if (signal) signal.removeEventListener('abort',abort); reject(error);
    });
  });
}

function createStreamPlayback({ call, resolveAudio, plugin, log=()=>{}, schedule=setTimeout, cancel=clearTimeout }) {
  const streams=new Map(), sources=new Map();
  const stop = entry => {
    if (!streams.delete(entry.id)) return;
    if (entry.signal) entry.signal.removeEventListener('abort',entry.abort);
    if (sources.get(entry.key) === entry) sources.delete(entry.key);
    Promise.resolve().then(() => plugin.stop({ id:entry.id })).catch(error => log('warn',`stream cleanup: ${error.message}`));
  };
  function release(id) {
    const entry=streams.get(id); if (!entry) return;
    entry.released=true;
    if (entry.timer !== null) { cancel(entry.timer); entry.timer=null; }
    if (!entry.caching) stop(entry);
  }
  async function lookup(url, init={}) {
    const parsed=new URL(url);
    const q=parsed.searchParams;
    if (['fresh','next','cache','cached_only'].some(name => q.get(name)==='1') || q.get('platform')==='local') return call(url,init);
    const signal=init.signal;
    if (signal && signal.aborted) throw abortError();
    const cachedUrl=new URL(url); cachedUrl.searchParams.set('cached_only','1');
    const cached=await guarded(call(cachedUrl.href,init),signal);
    if (cached.aborted) throw abortError();
    let data;
    try { data=JSON.parse(cached.body); } catch (_) { return call(url,init); }
    if (data.success) return cached;
    if (data.code!=='NOT_CACHED') return call(url,init);
    try {
      const target=q.get('url') || `https://www.youtube.com/watch?v=${q.get('id') || ''}`;
      const audio=await guarded(resolveAudio(target),signal);
      if (audio.kind!=='hls' || !/^https:\/\//i.test(audio.url)) return call(url,init);
      const stream=await guarded(plugin.start({ url:audio.url,headers:audio.headers || {} }),signal,
        value => { if (value && value.id) Promise.resolve(plugin.stop({ id:value.id })).catch(()=>{}); });
      if (!stream || !stream.id || !/^http:\/\/localhost:\d+\//.test(stream.url)) {
        if (stream && stream.id) await plugin.stop({ id:stream.id });
        throw Error('invalid native stream');
      }
      const entry={ id:stream.id,url:stream.url,key:keyOf(target),audio,lookupUrl:url,signal,released:false,caching:false,timer:null,started:false };
      entry.abort=()=>release(entry.id);
      streams.set(entry.id,entry); sources.set(entry.key,entry);
      if (signal) {
        if (signal.aborted) { release(entry.id); throw abortError(); }
        signal.addEventListener('abort',entry.abort,{ once:true });
      }
      return { status:200,headers:{ 'content-type':'application/json' },body:JSON.stringify({ success:true,isLocal:false,isHls:true,streamUrl:stream.url,mobileStreamId:entry.id }) };
    } catch (error) {
      if (error.name==='AbortError' || (signal && signal.aborted)) throw abortError();
      log('warn',`stream startup failed, using download: ${error.message}`);
      return call(url,init);
    }
  }
  function started(id) {
    const entry=streams.get(id);
    if (!entry || entry.started || entry.released) return;
    entry.started=true;
    entry.timer=schedule(() => {
      entry.timer=null;
      if (entry.released) return;
      entry.caching=true;
      const url=new URL(entry.lookupUrl); url.searchParams.set('cache','1');
      // No playback abort signal here: after listening for a few seconds, finish saving this song.
      Promise.resolve().then(() => call(url.href)).then(response => {
        if (response.status>=400) log('warn',`stream offline cache failed (${response.status})`);
      },error => log('warn',`stream offline cache failed: ${error.message}`)).finally(() => {
        entry.caching=false; if (entry.released) stop(entry);
      });
    },3000);
  }
  function downloadSource(target) {
    const entry=sources.get(keyOf(target));
    return entry ? { ...entry.audio,url:entry.url,headers:{} } : null;
  }
  return { lookup,started,release,downloadSource };
}
module.exports={ createStreamPlayback };
