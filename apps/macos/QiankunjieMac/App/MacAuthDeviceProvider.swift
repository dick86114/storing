import Foundation
import QiankunjieAuth

struct MacAuthDeviceProvider {
    static let installationIDKey = "com.idickies.storing.macos.installation-id"

    private let infoDictionary: [String: Any]
    private let defaults: UserDefaults

    init(
        infoDictionary: [String: Any],
        defaults: UserDefaults
    ) {
        self.infoDictionary = infoDictionary
        self.defaults = defaults
    }

    init(
        bundle: Bundle = .main,
        defaults: UserDefaults = .standard
    ) {
        self.init(
            infoDictionary: bundle.infoDictionary ?? [:],
            defaults: defaults
        )
    }

    var currentDevice: AuthDevice {
        AuthDevice(
            id: installationID,
            name: "Mac",
            appVersion: appVersion
        )
    }

    private var installationID: String {
        if let storedID = defaults.string(forKey: Self.installationIDKey),
           !storedID.isEmpty {
            return storedID
        }

        let newID = UUID().uuidString
        defaults.set(newID, forKey: Self.installationIDKey)
        return newID
    }

    private var appVersion: String {
        if let shortVersion = infoDictionary["CFBundleShortVersionString"] as? String,
           !shortVersion.isEmpty {
            return shortVersion
        }
        if let buildVersion = infoDictionary["CFBundleVersion"] as? String,
           !buildVersion.isEmpty {
            return buildVersion
        }
        return "0"
    }
}
