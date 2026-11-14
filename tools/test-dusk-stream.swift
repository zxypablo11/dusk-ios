import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

private func check(_ value: @autoclosure () -> Bool, _ message: String) throws {
    if !value() { throw DuskStreamError(message) }
}

private final class FakeMedia: URLProtocol {
    static var requests: [String] = []
    static var sawUserAgent = false
    override class func canInit(with request: URLRequest) -> Bool { request.url?.host == "media.example" }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        let url = request.url!
        Self.requests.append(url.path)
        Self.sawUserAgent = Self.sawUserAgent || request.value(forHTTPHeaderField: "User-Agent") == "resolver"
        let playlist = "#EXTM3U\n#EXT-X-TARGETDURATION:5\n#EXTINF:5,\nfirst.aac\n#EXTINF:5,\nsecond.aac\n#EXT-X-ENDLIST\n"
        var data = url.path.hasSuffix(".m3u8") ? Data(playlist.utf8) : Data([0xff, 0xf1, 1, 2, 3])
        var headers = ["Content-Type": url.path.hasSuffix(".m3u8") ? "application/vnd.apple.mpegurl" : "audio/aac"]
        let partial = request.value(forHTTPHeaderField: "Range") == "bytes=0-1"
        if partial {
            headers["Content-Range"] = "bytes 0-1/\(data.count)"
            data = Data(data.prefix(2))
        }
        let response = HTTPURLResponse(url: url, statusCode: partial ? 206 : 200, httpVersion: "HTTP/1.1", headerFields: headers)!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: data)
        client?.urlProtocolDidFinishLoading(self)
    }
    override func stopLoading() {}
}

@main
struct DuskStreamTests {
    static func main() async throws {
        let base = URL(string: "https://media.example/path/audio.m3u8")!
        var resources: [String] = []
        let rewritten = try DuskStreamProtocol.rewritePlaylist("#EXTM3U\n#EXT-X-MAP:URI=\"init.mp4\"\n#EXTINF:5,\n../one.aac\nhttps://media.example/two.aac\n", base: base) { url in
            resources.append(url.absoluteString)
            return "http://localhost:123/opaque/\(resources.count)"
        }
        try check(resources == ["https://media.example/path/init.mp4", "https://media.example/one.aac", "https://media.example/two.aac"], "relative URLs and init segments")
        try check(rewritten.contains("URI=\"http://localhost:123/opaque/1\""), "initialization URI rewritten")
        try check(!rewritten.contains("media.example"), "playlist never sends media outside the proxy")
        for text in ["#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI=\"key\"\n", "#EXTM3U\nhttp://localhost/private.aac\n", "not a playlist"] {
            var rejected = false
            do { _ = try DuskStreamProtocol.rewritePlaylist(text, base: base) { $0.absoluteString } } catch { rejected = true }
            try check(rejected, "refuses encrypted, non-HTTPS or invalid playlists")
        }
        let request = try DuskStreamProtocol.parseRequest(Data("GET /stream/s/r HTTP/1.1\r\nHost: localhost\r\nRange: bytes=1-9\r\n\r\n".utf8))
        try check(request.path == "/stream/s/r" && request.range == "bytes=1-9", "valid request and byte range")
        let suffix = try DuskStreamProtocol.parseRequest(Data("GET /stream/s/r HTTP/1.1\r\nRange: bytes=-9\r\n\r\n".utf8))
        try check(suffix.range == "bytes=-9", "valid suffix byte range")
        for text in ["POST / HTTP/1.1\r\n\r\n", "GET / HTTP/1.1\r\nRange: bytes=1-2,4-5\r\n\r\n", "GET / HTTP/1.1\r\nRange: bytes=-0\r\n\r\n", "GET / HTTP/1.1\r\nRange: bytes=9-1\r\n\r\n", "GET / HTTP/1.1\r\nRange: bytes=-18446744073709551616\r\n\r\n", String(repeating: "x", count: 17000)] {
            var rejected = false
            do { _ = try DuskStreamProtocol.parseRequest(Data(text.utf8)) } catch { rejected = true }
            try check(rejected, "refuses unsupported methods, multipart ranges and oversized requests")
        }

        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [FakeMedia.self]
        try check(DuskStreamProxy.isMediaURL(URL(string: "https://rr1.googlevideo.com/a")!), "allows YouTube media hosts")
        try check(DuskStreamProxy.isMediaURL(URL(string: "https://playback.media-streaming.soundcloud.cloud/track/a.m3u8")!), "allows the extractor's SoundCloud AAC host")
        try check(!DuskStreamProxy.isMediaURL(URL(string: "https://googlevideo.com.evil.example/a")!), "rejects lookalike media hosts")
        try check(!DuskStreamProxy.isMediaURL(URL(string: "https://localhost/a")!), "rejects local upstream URLs")
        let proxy = DuskStreamProxy(session: URLSession(configuration: config), allowURL: { $0.scheme == "https" && $0.host == "media.example" })
        let stream: DuskStreamProxy.Stream = try await withCheckedThrowingContinuation { continuation in
            proxy.start(url: base, headers: ["User-Agent": "resolver"]) { continuation.resume(with: $0) }
        }
        try check(FakeMedia.requests == ["/path/audio.m3u8"], "starting only fetches the playlist, not the complete song")
        let (playlistData, _) = try await URLSession.shared.data(from: stream.url)
        let playlist = String(decoding: playlistData, as: UTF8.self)
        var probe = URLRequest(url: stream.url)
        probe.setValue("bytes=0-1", forHTTPHeaderField: "Range")
        let (probeData, _) = try await URLSession.shared.data(for: probe)
        try check(String(decoding: probeData, as: UTF8.self).contains("http://localhost:"), "a range probe cannot bypass playlist rewriting")
        let urls = playlist.split(separator: "\n").filter { !$0.hasPrefix("#") }.map { URL(string: String($0))! }
        let (first, _) = try await URLSession.shared.data(from: urls[0])
        try check(first == Data([0xff, 0xf1, 1, 2, 3]), "first audio segment is playable without the second")
        _ = try await URLSession.shared.data(from: urls[0])
        try check(FakeMedia.requests.filter { $0 == "/path/first.aac" }.count == 1, "playback and offline download share segment requests")
        try check(!FakeMedia.requests.contains("/path/second.aac"), "no full-song download blocks first audio")
        try check(FakeMedia.sawUserAgent, "resolver headers reach the media server")
        proxy.stop(id: stream.id)
        let (_, stoppedResponse) = try await URLSession.shared.data(from: stream.url)
        try check((stoppedResponse as? HTTPURLResponse)?.statusCode == 404, "released sessions no longer expose resources")
        proxy.shutdown()
        print("Dusk native streaming tests passed")
    }
}
