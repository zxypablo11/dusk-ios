import Foundation
import Network

// A loopback-only HLS proxy. AVPlayer and the offline downloader reuse the same small responses.
// No remote URL is accepted over HTTP: every resource was registered by the app or its playlist.
final class DuskStreamProxy: NSObject, URLSessionTaskDelegate {
    struct Stream { let id: String; let url: URL }
    private struct Reply { let status: Int; let headers: [String: String]; let data: Data }
    private final class Media {
        let id = UUID().uuidString
        let headers: [String: String]
        var resources: [String: URL]
        var identifiers: [String: String]
        init(url: URL, headers: [String: String]) {
            self.headers = headers
            resources = ["master.m3u8": url]
            identifiers = [url.absoluteString: "master.m3u8"]
        }
    }

    private let queue = DispatchQueue(label: "io.dusk.stream")
    private let allowURL: (URL) -> Bool
    private var network: URLSession!
    private var listener: NWListener?
    private var port: UInt16?
    private var waiting: [(Result<Void, Error>) -> Void] = []
    private var media: [String: Media] = [:]
    private var cache: [String: Reply] = [:]
    private var cacheOrder: [String] = []
    private var cacheBytes = 0
    private var pending: [String: [(Result<Reply, Error>) -> Void]] = [:]
    private var tasks: [String: URLSessionDataTask] = [:]
    private var connections: [ObjectIdentifier: NWConnection] = [:]

    static func isMediaURL(_ url: URL) -> Bool {
        guard url.scheme?.lowercased() == "https", let host = url.host?.lowercased(), url.user == nil, url.password == nil else { return false }
        return ["googlevideo.com", "sndcdn.com", "media-streaming.soundcloud.cloud"].contains { host == $0 || host.hasSuffix("." + $0) }
    }

    init(session: URLSession? = nil, allowURL: @escaping (URL) -> Bool = DuskStreamProxy.isMediaURL) {
        self.allowURL = allowURL
        super.init()
        if let session = session { network = session }
        else {
            let config = URLSessionConfiguration.ephemeral
            config.timeoutIntervalForRequest = 15
            config.timeoutIntervalForResource = 30
            config.httpMaximumConnectionsPerHost = 6
            network = URLSession(configuration: config, delegate: self, delegateQueue: nil)
        }
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
        completionHandler(request.url.map(allowURL) == true ? request : nil)
    }

    func start(url: URL, headers: [String: String], completion: @escaping (Result<Stream, Error>) -> Void) {
        queue.async {
            guard self.allowURL(url), self.media.count < 4 else { completion(.failure(DuskStreamError("Stream source unavailable"))); return }
            self.ensureListener { result in
                switch result {
                case .failure(let error): completion(.failure(error))
                case .success:
                    guard self.media.count < 4 else { completion(.failure(DuskStreamError("Too many active streams"))); return }
                    let allowed = Set(["user-agent", "accept", "accept-language", "referer", "origin"])
                    let cleanHeaders = headers.filter { allowed.contains($0.key.lowercased()) && !$0.value.contains("\r") && !$0.value.contains("\n") }
                    let entry = Media(url: url, headers: cleanHeaders)
                    self.media[entry.id] = entry
                    self.fetch(entry, resource: "master.m3u8", range: nil) { response in
                        switch response {
                        case .success(let reply):
                            guard reply.data.starts(with: Data("#EXTM3U".utf8)), let address = self.address(entry, resource: "master.m3u8") else {
                                self.remove(entry.id); completion(.failure(DuskStreamError("Not an HLS playlist"))); return
                            }
                            completion(.success(Stream(id: entry.id, url: address)))
                        case .failure(let error): self.remove(entry.id); completion(.failure(error))
                        }
                    }
                }
            }
        }
    }

    func stop(id: String) { queue.async { self.remove(id) } }
    func shutdown() {
        queue.async {
            for id in Array(self.media.keys) { self.remove(id) }
            for connection in self.connections.values { connection.cancel() }
            self.connections.removeAll()
            self.listener?.cancel(); self.listener = nil; self.port = nil
            self.network.invalidateAndCancel()
        }
    }

    private func ensureListener(_ completion: @escaping (Result<Void, Error>) -> Void) {
        if port != nil { completion(.success(())); return }
        waiting.append(completion)
        if listener != nil { return }
        do {
            let parameters = NWParameters.tcp
            parameters.requiredLocalEndpoint = .hostPort(host: "127.0.0.1", port: .any)
            let server = try NWListener(using: parameters)
            listener = server
            server.newConnectionHandler = { [weak self] connection in self?.accept(connection) }
            server.stateUpdateHandler = { [weak self, weak server] state in
                guard let self = self, let server = server, self.listener === server else { return }
                switch state {
                case .ready:
                    self.port = server.port?.rawValue
                    self.finishWaiting(self.port == nil ? .failure(DuskStreamError("No stream port")) : .success(()))
                case .failed(let error): self.listener = nil; self.port = nil; server.cancel(); self.finishWaiting(.failure(error))
                default: break
                }
            }
            server.start(queue: queue)
            queue.asyncAfter(deadline: .now() + 5) { [weak self, weak server] in
                guard let self = self, let server = server, self.listener === server, self.port == nil else { return }
                self.listener = nil; server.cancel(); self.finishWaiting(.failure(DuskStreamError("Stream startup timed out")))
            }
        } catch { listener = nil; finishWaiting(.failure(error)) }
    }
    private func finishWaiting(_ result: Result<Void, Error>) {
        let callbacks = waiting; waiting.removeAll()
        for callback in callbacks { callback(result) }
    }
    private func address(_ entry: Media, resource: String) -> URL? {
        guard let port = port else { return nil }
        return URL(string: "http://localhost:\(port)/stream/\(entry.id)/\(resource)")
    }
    private func resource(_ url: URL, in entry: Media) throws -> String {
        guard allowURL(url) else { throw DuskStreamError("HLS resource outside media hosts") }
        let id: String
        if let existing = entry.identifiers[url.absoluteString] { id = existing }
        else {
            guard entry.resources.count < 10000 else { throw DuskStreamError("Too many HLS resources") }
            id = UUID().uuidString + "." + (url.pathExtension.isEmpty ? "media" : url.pathExtension)
            entry.resources[id] = url; entry.identifiers[url.absoluteString] = id
        }
        guard let address = address(entry, resource: id) else { throw DuskStreamError("Stream closed") }
        return address.absoluteString
    }

    private func fetch(_ entry: Media, resource: String, range: String?, completion: @escaping (Result<Reply, Error>) -> Void) {
        guard media[entry.id] === entry, let url = entry.resources[resource] else { completion(.failure(DuskStreamError("Stream closed"))); return }
        // Playlists must be complete to rewrite their URLs. Share open segment requests with the cache.
        let isPlaylist = resource == "master.m3u8" || url.pathExtension.lowercased() == "m3u8"
        let range = isPlaylist || range == "bytes=0-" ? nil : range
        let key = entry.id + "|" + resource + "|" + (range ?? "")
        if let reply = cache[key] { completion(.success(reply)); return }
        if pending[key] != nil { pending[key]?.append(completion); return }
        pending[key] = [completion]
        var request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 15)
        for (name, value) in entry.headers { request.setValue(value, forHTTPHeaderField: name) }
        if let range = range { request.setValue(range, forHTTPHeaderField: "Range") }
        let task = network.dataTask(with: request) { [weak self] data, response, error in
            guard let self = self else { return }
            self.queue.async {
                self.tasks.removeValue(forKey: key)
                guard let callbacks = self.pending.removeValue(forKey: key) else { return }
                let result: Result<Reply, Error>
                do {
                    if let error = error { throw error }
                    guard self.media[entry.id] === entry, let http = response as? HTTPURLResponse, [200, 206].contains(http.statusCode), let data = data, data.count <= 4194304 else { throw DuskStreamError("Media request failed") }
                    var body = data
                    var headers: [String: String] = [:]
                    for (name, value) in http.allHeaderFields {
                        let key = String(describing: name).lowercased()
                        if ["content-type", "content-range", "accept-ranges"].contains(key) { headers[key] = String(describing: value) }
                    }
                    if data.starts(with: Data("#EXTM3U".utf8)) {
                        let playlist = try DuskStreamProtocol.rewritePlaylist(String(decoding: data, as: UTF8.self), base: http.url ?? url) { try self.resource($0, in: entry) }
                        body = Data(playlist.utf8); headers["content-type"] = "application/vnd.apple.mpegurl"
                    }
                    let reply = Reply(status: http.statusCode, headers: headers, data: body)
                    self.remember(reply, key: key)
                    result = .success(reply)
                } catch { result = .failure(error) }
                for callback in callbacks { callback(result) }
            }
        }
        tasks[key] = task; task.resume()
    }
    private func remember(_ reply: Reply, key: String) {
        cache[key] = reply; cacheOrder.append(key); cacheBytes += reply.data.count
        while cacheBytes > 33554432, !cacheOrder.isEmpty {
            let oldest = cacheOrder.removeFirst()
            if let evicted = cache.removeValue(forKey: oldest) { cacheBytes -= evicted.data.count }
        }
    }
    private func remove(_ id: String) {
        guard media.removeValue(forKey: id) != nil else { return }
        let prefix = id + "|"
        for key in Array(tasks.keys) where key.hasPrefix(prefix) {
            tasks.removeValue(forKey: key)?.cancel()
            let callbacks = pending.removeValue(forKey: key) ?? []
            for callback in callbacks { callback(.failure(DuskStreamError("Stream closed"))) }
        }
        for key in Array(cache.keys) where key.hasPrefix(prefix) {
            if let reply = cache.removeValue(forKey: key) { cacheBytes -= reply.data.count }
        }
        cacheOrder.removeAll { $0.hasPrefix(prefix) }
    }

    private func accept(_ connection: NWConnection) {
        let id = ObjectIdentifier(connection)
        connections[id] = connection
        connection.stateUpdateHandler = { [weak self, weak connection] state in
            if case .failed = state { self?.connections.removeValue(forKey: id); connection?.cancel() }
            if case .cancelled = state { self?.connections.removeValue(forKey: id) }
        }
        connection.start(queue: queue)
        let deadline = DispatchWorkItem { connection.cancel() }
        queue.asyncAfter(deadline: .now() + 8, execute: deadline)
        read(connection, buffer: Data(), deadline: deadline)
    }
    private func read(_ connection: NWConnection, buffer: Data, deadline: DispatchWorkItem) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 16384) { [weak self] data, _, ended, error in
            guard let self = self else { connection.cancel(); return }
            var bytes = buffer; if let data = data { bytes.append(data) }
            if bytes.count > 16384 { deadline.cancel(); self.send(connection, status: 400, body: Data()); return }
            if bytes.range(of: Data("\r\n\r\n".utf8)) != nil {
                deadline.cancel()
                do {
                    let request = try DuskStreamProtocol.parseRequest(bytes)
                    let parts = request.path.split(separator: "/")
                    guard parts.count == 3, parts[0] == "stream", let entry = self.media[String(parts[1])], entry.resources[String(parts[2])] != nil else {
                        self.send(connection, status: 404, body: Data()); return
                    }
                    self.fetch(entry, resource: String(parts[2]), range: request.range) { result in
                        switch result {
                        case .success(let reply): self.send(connection, status: reply.status, headers: reply.headers, body: reply.data, head: request.method == "HEAD")
                        case .failure: self.send(connection, status: 502, body: Data())
                        }
                    }
                } catch { self.send(connection, status: 400, body: Data()) }
            } else if ended || error != nil { deadline.cancel(); connection.cancel() }
            else { self.read(connection, buffer: bytes, deadline: deadline) }
        }
    }
    private func send(_ connection: NWConnection, status: Int, headers: [String: String] = [:], body: Data, head: Bool = false) {
        let reason = [200: "OK", 206: "Partial Content", 400: "Bad Request", 404: "Not Found", 502: "Bad Gateway"][status] ?? "Error"
        var text = "HTTP/1.1 \(status) \(reason)\r\nContent-Length: \(body.count)\r\nConnection: close\r\nAccess-Control-Allow-Origin: *\r\n"
        for (name, value) in headers where !value.contains("\r") && !value.contains("\n") { text += "\(name): \(value)\r\n" }
        var bytes = Data((text + "\r\n").utf8)
        if !head { bytes.append(body) }
        connection.send(content: bytes, completion: .contentProcessed { _ in connection.cancel() })
    }
}
