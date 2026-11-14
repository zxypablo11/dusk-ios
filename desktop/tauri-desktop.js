// Patches the shared Dusk www bundle for Tauri: HTTP proxy + electronAPI desktop subset.
(function () {
  const g = globalThis;
  if (!g.__TAURI_INTERNALS__ && !g.__TAURI__) return;

  const invoke = (cmd, args) => {
    const core = g.__TAURI__ && g.__TAURI__.core;
    if (core && typeof core.invoke === 'function') return core.invoke(cmd, args || {});
    return g.__TAURI_INTERNALS__.invoke(cmd, args || {});
  };

  const plainHeaders = (h) => {
    if (!h) return {};
    if (h instanceof Headers) return Object.fromEntries(h.entries());
    return { ...h };
  };

  async function toPlain(input, init = {}) {
    if (typeof Request !== 'undefined' && input instanceof Request) {
      const body = init.body !== undefined
        ? init.body
        : ['GET', 'HEAD'].includes(input.method) ? undefined : await input.clone().text();
      return [input.url, {
        method: init.method || input.method,
        headers: { ...plainHeaders(input.headers), ...plainHeaders(init.headers) },
        body,
        signal: init.signal || input.signal
      }];
    }
    return [String(input), { ...init, headers: plainHeaders(init.headers) }];
  }

  const REQUEST_DEADLINE_MS = 30000;

  g.__duskFetch = async (input, init) => {
    const [url, opts] = await toPlain(input, init);
    const method = (opts.method || 'GET').toUpperCase();
    let body = opts.body;
    if (body != null && typeof body !== 'string') {
      if (body instanceof ArrayBuffer) body = new TextDecoder().decode(body);
      else if (typeof Blob !== 'undefined' && body instanceof Blob) body = await body.text();
      else body = String(body);
    }
    const payload = {
      url,
      method,
      headers: opts.headers || {},
      body: body == null ? null : String(body)
    };
    const timeout = typeof AbortSignal !== 'undefined' && AbortSignal.timeout
      ? AbortSignal.timeout(REQUEST_DEADLINE_MS)
      : null;
    if (opts.signal && opts.signal.aborted) throw new DOMException('The operation was aborted.', 'AbortError');

    const run = invoke('proxy_fetch', { req: payload }).then((r) => {
      const bytes = Uint8Array.from(atob(r.bodyBase64), (c) => c.charCodeAt(0));
      return new Response(r.status === 204 ? null : bytes, {
        status: r.status,
        headers: r.headers || {}
      });
    });

    if (!timeout) return run;
    let timer;
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`request timed out: ${url.slice(0, 80)}`)), REQUEST_DEADLINE_MS + 1000);
    });
    try {
      return await Promise.race([run, deadline]);
    } finally {
      clearTimeout(timer);
    }
  };

  function patchElectronApi() {
    const base = g.electronAPI || {};
    const visibilityListeners = [];
    document.addEventListener('visibilitychange', () => {
      visibilityListeners.forEach((cb) => {
        try { cb(!document.hidden); } catch (e) {}
      });
    });

    g.electronAPI = {
      ...base,
      isWindows: true,
      isMobile: false,
      serverToken: base.serverToken || '',
      minimizeWindow: () => { invoke('minimize_window').catch(() => {}); },
      maximizeWindow: () => { invoke('maximize_window').catch(() => {}); },
      closeWindow: () => { invoke('close_window').catch(() => {}); },
      getServerPort: base.getServerPort || (async () => 38472),
      getGpuCompositing: async () => 'enabled',
      onWindowVisibility: (cb) => { if (typeof cb === 'function') visibilityListeners.push(cb); },
      setZoomFactor: () => {},
      getZoomFactor: () => 1,
      getAppVersion: base.getAppVersion || (async () => {
        try { return await invoke('app_version'); } catch (e) { return '0.1.0'; }
      }),
      getDataDir: base.getDataDir || (async () => {
        try {
          const dir = await invoke('get_data_dir');
          return { dir, defaultDir: dir, isCustom: false };
        } catch (e) {
          return { dir: 'App data', defaultDir: '', isCustom: false };
        }
      }),
      openExternal: (u) => { invoke('open_external', { url: String(u || '') }).catch(() => {}); },
      copyText: async (text) => {
        try {
          await navigator.clipboard.writeText(String(text || ''));
          return true;
        } catch (e) {
          return false;
        }
      },
      restartApp: () => { location.reload(); },
      trimMemory: () => {},
      setTrayOnClose: () => {},
      getHwAccel: async () => true,
      setHwAccel: () => {},
      setMediaKeys: () => {},
      mediaKeysActive: () => {},
      discordPresenceUpdate: (trackInfo) => {
        invoke('discord_presence_update', { track: trackInfo || {} })
          .catch((e) => { try { console.warn('[dusk] discord presence', e); } catch (_) {} });
      },
      discordPresenceClear: () => {
        invoke('discord_presence_clear')
          .catch((e) => { try { console.warn('[dusk] discord clear', e); } catch (_) {} });
      },
      logError: () => {},
      openLogsFolder: () => {},
      getDiagnostics: async () => ({}),
      getAudioOutputInfo: async () => ({}),
      getLauncherInfo: async () => ({}),
      listPlugins: async () => [],
      setPluginEnabled: () => {},
      disableAllPlugins: () => {},
      openPluginsFolder: () => {},
      removePlugin: () => {},
      importPlugins: async () => [],
      toggleMiniWindow: async () => false,
      setMiniLyrics: async () => false,
      googleLogin: async () => ({ ok: false }),
      googleLogout: async () => ({}),
      googleAuthStatus: async () => ({ signedIn: false }),
      googleImportLibrary: async () => ({ tracks: [] }),
      saveTextFile: async (payload = {}) => {
        try {
          const name = payload.defaultName || payload.name || 'dusk.txt';
          const contents = String(payload.content != null ? payload.content : (payload.contents || ''));
          if (!contents) return { success: false, error: 'Nothing to save' };
          const path = await invoke('save_text_file_dialog', {
            defaultName: name,
            contents
          });
          if (!path) return { canceled: true };
          return { success: true, path };
        } catch (e) {
          return { success: false, error: String(e) };
        }
      },
      readDirSize: async (path) => {
        try {
          return await invoke('read_dir_size', { path: String(path || '') });
        } catch (e) {
          return 0;
        }
      },
      welcomeFinish: () => {},
      onWelcomeResult: () => {},
      onMediaCommand: () => {}
    };
  }

  try {
    if (localStorage.getItem('dusk_perf_mode') === null) {
      const legacy = localStorage.getItem('muriel_perf_mode');
      localStorage.setItem('dusk_perf_mode', legacy !== null ? legacy : '1');
    }
  } catch (e) {}

  if (g.electronAPI) patchElectronApi();
  else {
    const timer = setInterval(() => {
      if (g.electronAPI) {
        clearInterval(timer);
        patchElectronApi();
      }
    }, 20);
    setTimeout(() => clearInterval(timer), 10000);
  }

  // mobile-bridge.js always tags the shared www as phone; clear it for desktop chrome.
  document.documentElement.classList.remove('is-mobile');
  document.documentElement.classList.add('is-tauri', 'is-windows');
})();
