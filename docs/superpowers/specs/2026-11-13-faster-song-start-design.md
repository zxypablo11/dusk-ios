# Faster iPhone song start

Approved in chat on 13 November 2026: cached tracks play immediately; new tracks start after a small buffer instead of waiting for the entire download. Preserve the existing download path as a fallback and test cancellation and offline storage.

## Approach

Preloading more complete songs would only hide the delay for guesses and use extra data. Stream the existing audio-only HLS rendition through a loopback native proxy instead. It retains the resolver's HTTP headers and caches individual segments so playback and the background offline download share requests. Keep the existing HTML audio element and its queue, controls, interruption handling and MediaSession integration.

## Constraints

- iPhone first; desktop and Android retain their existing paths.
- No new npm dependencies and no visual or website changes.
- Check the existing file cache before resolving a stream.
- Use the old download route for unsupported sources, explicit retries, failed streaming and builds without the native plugin.
- Cancellation must never attach a previously selected song. Sessions are bounded and released after playback and caching finish.
- Preserve automatic offline caching; never report a partial song as cached.
- The proxy accepts only opaque session/resource identifiers bound to HTTPS media URLs. Bind to loopback; reject encrypted playlists and invalid requests.
- Actual perceived startup latency and background behavior still require an iPhone test.
