import Foundation
import Capacitor
import Security

// Tiny metadata vault for playlists/favorites/themes. Lives in the Keychain so it can survive
// deleting and reinstalling Dusk. No audio files — only a JSON string, chunked if needed.
@objc(DuskLibraryVaultPlugin)
public class DuskLibraryVaultPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "DuskLibraryVaultPlugin"
    public let jsName = "DuskLibraryVault"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "write", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "read", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise),
    ]

    private let service = "io.github.zxypablo11.dusk.library"
    private let account = "vault"
    private let chunkSize = 1800

    @objc func write(_ call: CAPPluginCall) {
        guard let text = call.getString("value") else {
            call.reject("Nothing to save")
            return
        }
        if text.utf8.count > 600_000 {
            call.reject("Library backup is too large")
            return
        }
        do {
            try clearChunks()
            let chunks = chunk(text)
            try setItem(account: "\(account).count", value: String(chunks.count))
            for (i, part) in chunks.enumerated() {
                try setItem(account: "\(account).\(i)", value: part)
            }
            try setItem(account: account, value: chunks.count == 1 ? text : "")
            call.resolve(["ok": true, "bytes": text.utf8.count, "chunks": chunks.count])
        } catch {
            call.reject(error.localizedDescription)
        }
    }

    @objc func read(_ call: CAPPluginCall) {
        do {
            if let single = try getItem(account: account), !single.isEmpty {
                call.resolve(["value": single])
                return
            }
            guard let countRaw = try getItem(account: "\(account).count"),
                  let count = Int(countRaw), count > 0 else {
                call.resolve(["value": NSNull()])
                return
            }
            var parts: [String] = []
            parts.reserveCapacity(count)
            for i in 0..<count {
                guard let part = try getItem(account: "\(account).\(i)") else {
                    call.resolve(["value": NSNull()])
                    return
                }
                parts.append(part)
            }
            call.resolve(["value": parts.joined()])
        } catch {
            call.reject(error.localizedDescription)
        }
    }

    @objc func clear(_ call: CAPPluginCall) {
        do {
            try clearChunks()
            call.resolve(["ok": true])
        } catch {
            call.reject(error.localizedDescription)
        }
    }

    private func chunk(_ text: String) -> [String] {
        if text.utf8.count <= chunkSize { return [text] }
        var out: [String] = []
        var start = text.startIndex
        while start < text.endIndex {
            let end = text.index(start, offsetBy: chunkSize, limitedBy: text.endIndex) ?? text.endIndex
            out.append(String(text[start..<end]))
            start = end
        }
        return out
    }

    private func clearChunks() throws {
        if let countRaw = try getItem(account: "\(account).count"), let count = Int(countRaw) {
            for i in 0..<max(count, 0) {
                try deleteItem(account: "\(account).\(i)")
            }
        }
        try deleteItem(account: "\(account).count")
        try deleteItem(account: account)
    }

    private func setItem(account: String, value: String) throws {
        let data = Data(value.utf8)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(query as CFDictionary)
        var add = query
        add[kSecValueData as String] = data
        // ThisDeviceOnly so the vault stays on the phone; it can still survive app deletion.
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        let status = SecItemAdd(add as CFDictionary, nil)
        if status != errSecSuccess {
            throw NSError(domain: NSOSStatusErrorDomain, code: Int(status), userInfo: [NSLocalizedDescriptionKey: "Keychain write failed (\(status))"])
        }
    }

    private func getItem(account: String) throws -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        if status == errSecItemNotFound { return nil }
        if status != errSecSuccess {
            throw NSError(domain: NSOSStatusErrorDomain, code: Int(status), userInfo: [NSLocalizedDescriptionKey: "Keychain read failed (\(status))"])
        }
        guard let data = item as? Data, let text = String(data: data, encoding: .utf8) else { return nil }
        return text
    }

    private func deleteItem(account: String) throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        let status = SecItemDelete(query as CFDictionary)
        if status != errSecSuccess && status != errSecItemNotFound {
            throw NSError(domain: NSOSStatusErrorDomain, code: Int(status), userInfo: [NSLocalizedDescriptionKey: "Keychain delete failed (\(status))"])
        }
    }
}
