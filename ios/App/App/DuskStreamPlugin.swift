import Foundation
import Capacitor

@objc(DuskStreamPlugin)
public class DuskStreamPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "DuskStreamPlugin"
    public let jsName = "DuskStream"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
    ]
    private let proxy = DuskStreamProxy()

    @objc func start(_ call: CAPPluginCall) {
        guard let value = call.getString("url"), let url = URL(string: value) else { call.reject("Invalid stream URL"); return }
        var headers: [String: String] = [:]
        for (name, value) in call.getObject("headers") ?? [:] {
            if let value = value as? String { headers[name] = value }
        }
        proxy.start(url: url, headers: headers) { result in
            switch result {
            case .success(let stream): call.resolve(["id": stream.id, "url": stream.url.absoluteString])
            case .failure(let error): call.reject(error.localizedDescription)
            }
        }
    }
    @objc func stop(_ call: CAPPluginCall) {
        if let id = call.getString("id") { proxy.stop(id: id) }
        call.resolve()
    }
    deinit { proxy.shutdown() }
}
