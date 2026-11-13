import Foundation

struct DuskStreamError: LocalizedError {
    let message: String
    init(_ message: String) { self.message = message }
    var errorDescription: String? { message }
}

enum DuskStreamProtocol {
    struct Request {
        let method: String
        let path: String
        let range: String?
    }

    static func parseRequest(_ data: Data) throws -> Request {
        guard data.count <= 16384, let text = String(data: data, encoding: .utf8) else { throw DuskStreamError("Invalid HTTP request") }
        let lines = text.components(separatedBy: "\r\n")
        let first = (lines.first ?? "").split(separator: " ")
        guard first.count == 3, ["GET", "HEAD"].contains(String(first[0])), ["HTTP/1.0", "HTTP/1.1"].contains(String(first[2])), first[1].hasPrefix("/") else {
            throw DuskStreamError("Unsupported HTTP request")
        }
        var range: String?
        for line in lines.dropFirst() {
            guard let colon = line.firstIndex(of: ":") else { continue }
            if line[..<colon].lowercased() != "range" { continue }
            let value = line[line.index(after: colon)...].trimmingCharacters(in: .whitespaces)
            guard range == nil, value.range(of: "^bytes=[0-9]+-[0-9]*$", options: .regularExpression) != nil else { throw DuskStreamError("Invalid byte range") }
            let ends = value.dropFirst(6).split(separator: "-", omittingEmptySubsequences: false)
            guard let start = UInt64(ends[0]), ends[1].isEmpty || (UInt64(ends[1]).map { $0 >= start } ?? false) else { throw DuskStreamError("Invalid byte range") }
            range = value
        }
        return Request(method: String(first[0]), path: String(first[1]), range: range)
    }

    static func rewritePlaylist(_ text: String, base: URL, resource: (URL) throws -> String) throws -> String {
        guard text.hasPrefix("#EXTM3U"), text.utf8.count <= 1048576 else { throw DuskStreamError("Invalid HLS playlist") }
        let uri = try NSRegularExpression(pattern: "URI=\"([^\"]+)\"")
        func resolve(_ value: String) throws -> String {
            guard let url = URL(string: value, relativeTo: base)?.absoluteURL, url.scheme?.lowercased() == "https", url.host != nil else { throw DuskStreamError("Invalid HLS media URL") }
            return try resource(url)
        }
        return try text.components(separatedBy: "\n").map { raw in
            let line = raw.trimmingCharacters(in: .whitespacesAndNewlines)
            if line.hasPrefix("#EXT-X-KEY:") || line.hasPrefix("#EXT-X-SESSION-KEY:") {
                guard line.range(of: "(?:^|[:,])METHOD=NONE(?:,|$)", options: .regularExpression) != nil else { throw DuskStreamError("Encrypted HLS is not supported") }
            }
            if line.isEmpty { return "" }
            if !line.hasPrefix("#") { return try resolve(line) }
            let value = NSMutableString(string: line)
            for match in uri.matches(in: line, range: NSRange(location: 0, length: value.length)).reversed() {
                let target = (line as NSString).substring(with: match.range(at: 1))
                value.replaceCharacters(in: match.range(at: 1), with: try resolve(target))
            }
            return value as String
        }.joined(separator: "\n")
    }
}
